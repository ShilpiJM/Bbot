import logging
import urllib.request
import urllib.parse
import xml.etree.ElementTree as ET
import html
import re
from datetime import datetime
from typing import List, Dict, Any

logger = logging.getLogger(__name__)

try:
    from ddgs import DDGS
except ImportError:
    try:
        from duckduckgo_search import DDGS
    except ImportError:
        DDGS = None


class WebSearchService:
    def __init__(self):
        self._enabled = True

    def _fetch_live_news_rss(self, query: str = "", max_results: int = 5) -> List[Dict[str, str]]:
        """
        Fetches live real-time news via Google News RSS and secondary resilient RSS feeds
        (100% Free, zero API key required, real-time up to the minute).
        """
        results: List[Dict[str, str]] = []
        clean_q = (query or "").strip().lower()

        # Normalize common typos
        clean_q = re.sub(r'\b(afairs|afair)\b', 'affairs', clean_q)
        clean_q = re.sub(r'\b(curent|curant)\b', 'current', clean_q)

        # Check if query is looking for today's breaking news / general current affairs
        general_news_cues = ["current affair", "current affairs", "today", "news", "breaking", "headlines", "aaj", "khabar", "latest news", "top news", "affair", "affairs"]
        is_general_today = not clean_q or any(cue in clean_q for cue in ["today", "current", "headlines", "breaking", "aaj ki", "now", "affair"])

        target_urls = []
        if is_general_today and any(cue in clean_q for cue in general_news_cues):
            target_urls.append("https://news.google.com/rss?hl=en-IN&gl=IN&ceid=IN:en")
            target_urls.append("https://timesofindia.indiatimes.com/rssfeedstopstories.cms")
            target_urls.append("https://feeds.feedburner.com/ndtvnews-top-stories")
        else:
            # Topic-specific news search
            search_term = clean_q or "news"
            target_urls.append(f"https://news.google.com/rss/search?q={urllib.parse.quote(search_term)}&hl=en-IN&gl=IN&ceid=IN:en")
            target_urls.append("https://news.google.com/rss?hl=en-IN&gl=IN&ceid=IN:en")

        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
        }

        for feed_url in target_urls:
            try:
                req = urllib.request.Request(feed_url, headers=headers)
                with urllib.request.urlopen(req, timeout=10) as resp:
                    root = ET.fromstring(resp.read())

                for it in root.findall(".//item")[:max_results]:
                    title = it.find("title").text if it.find("title") is not None else ""
                    link = it.find("link").text if it.find("link") is not None else ""
                    pub = it.find("pubDate").text if it.find("pubDate") is not None else ""
                    desc = it.find("description").text if it.find("description") is not None else ""
                    source_tag = it.find("source")
                    source_name = source_tag.text if source_tag is not None else ""
                    desc_clean = re.sub(r"<[^<]+?>", "", html.unescape(desc or "")).strip()

                    if title:
                        body_text = f"{desc_clean} (Published: {pub})" if pub else desc_clean
                        results.append({
                            "title": title,
                            "href": link,
                            "source": source_name,
                            "published": pub,
                            "body": body_text or title,
                        })
                if results:
                    logger.info(f"News RSS ({feed_url}) returned {len(results)} live articles for '{query}'")
                    break
            except Exception as e:
                logger.warning(f"News RSS fetch failed for {feed_url}: {e}")
                continue

        return results

    def search(self, query: str, max_results: int = 5) -> List[Dict[str, str]]:
        """
        Executes a live web and real-time news search (Free, zero API key required).
        Combines Google News RSS for real-time daily events with DuckDuckGo for general web search.
        """
        clean_query = query.strip()
        if not clean_query:
            clean_query = "latest news today"

        # Normalize common spelling variations
        normalized_query = re.sub(r'\b(afairs|afair)\b', 'affairs', clean_query, flags=re.IGNORECASE)
        normalized_query = re.sub(r'\b(curent|curant)\b', 'current', normalized_query, flags=re.IGNORECASE)

        logger.info(f"Performing live web search for: '{normalized_query}' (max_results={max_results})")
        results: List[Dict[str, str]] = []
        clean_lower = normalized_query.lower()

        # Check if the query is a pure creative, coding, or drafting task that does not need web search
        creation_cues = [
            "write a", "write an", "write code", "code a", "create a", "draft a",
            "generate a", "bna do", "bana do", "likh do", "likh kar do", "script",
            "leave application", "template", "poem", "story", "solve", "how to write"
        ]
        has_realtime_cue = any(kw in clean_lower for kw in [
            "today", "latest", "current", "news", "breaking", "price", "recent",
            "who is", "who won", "weather", "aaj", "now", "2026", "update"
        ])
        if not has_realtime_cue and any(c in clean_lower for c in creation_cues):
            logger.info(f"Query '{clean_query}' identified as creative/generation task; skipping web search for maximum responsiveness.")
            return []

        # Check if the query is asking about current affairs, news, today's events, or breaking updates
        news_keywords = ["current affair", "current affairs", "today", "news", "breaking", "headline", "headlines", "aaj", "khabar", "latest", "recent", "what happened"]
        is_news_intent = any(kw in clean_lower for kw in news_keywords)

        # 1. If user is asking for current affairs / news, fetch live news feed first
        if is_news_intent:
            news_items = self._fetch_live_news_rss(clean_query, max_results=max_results)
            results.extend(news_items)

        # 2. Query DuckDuckGo text search across resilient engines
        if len(results) < max_results and DDGS is not None:
            try:
                with DDGS() as ddgs:
                    for backend in ["auto", "yahoo", "duckduckgo", "wikipedia"]:
                        try:
                            raw = list(ddgs.text(clean_query, backend=backend, max_results=max_results))
                            if raw:
                                for r in raw:
                                    title = r.get("title", "").strip()
                                    body = r.get("body", "").strip()
                                    href = r.get("href", "") or r.get("url", "")
                                    if title or body:
                                        results.append({"title": title or "Source", "body": body, "href": href})
                                if results:
                                    break
                        except Exception as engine_err:
                            logger.debug(f"Search backend '{backend}' failed for '{clean_query}': {engine_err}")
                            continue

                    # Fallback to DDGS news if still empty
                    if not results:
                        try:
                            raw_news = list(ddgs.news(clean_query, max_results=max_results))
                            for r in raw_news:
                                title = r.get("title", "").strip()
                                body = r.get("body", "").strip()
                                href = r.get("url", "") or r.get("href", "")
                                if title or body:
                                    results.append({"title": title or "News Source", "body": body, "href": href})
                        except Exception as news_err:
                            logger.debug(f"DDGS news fallback failed: {news_err}")
            except Exception as ddg_err:
                logger.warning(f"DuckDuckGo search error: {ddg_err}")

        # 3. If still empty, use Google News search as ultimate fallback
        if not results:
            results = self._fetch_live_news_rss(clean_query, max_results=max_results)

        # Deduplicate results by URL or title
        deduped: List[Dict[str, str]] = []
        seen = set()
        for item in results:
            key = item.get("href") or item.get("title")
            if key and key not in seen:
                seen.add(key)
                deduped.append(item)

        final_results = deduped[:max_results]
        logger.info(f"Web search resolved {len(final_results)} live results for '{clean_query}'")
        return final_results

    def format_for_prompt(self, results: List[Dict[str, str]]) -> str:
        """
        Formats search results into an authoritative grounded context for the LLM.
        """
        if not results:
            return ""

        today_str = datetime.now().strftime("%A, %d %B %Y")
        formatted_lines = [
            f"### REAL-TIME WEB & LIVE NEWS SOURCES (TODAY: {today_str}):",
            "The following real-time sources were fetched live from the internet right now.",
            "Use these real-time sources to provide an accurate, up-to-date, comprehensive answer for the user.",
            "Cite the sources with clickable markdown links, e.g. [Source Title](URL).",
            "",
        ]

        for i, res in enumerate(results, start=1):
            title = res.get("title", f"Source {i}")
            href = res.get("href", "")
            pub = res.get("published", "")
            body = res.get("body", "").strip()

            formatted_lines.append(f"[{i}] {title}")
            if pub:
                formatted_lines.append(f"Published: {pub}")
            if href:
                formatted_lines.append(f"URL: {href}")
            if body:
                formatted_lines.append(f"Summary / Excerpt: {body}")
            formatted_lines.append("")

        formatted_lines.append("---")
        return "\n".join(formatted_lines)


# Singleton instance
_search_service = None

def get_web_search_service() -> WebSearchService:
    global _search_service
    if _search_service is None:
        _search_service = WebSearchService()
    return _search_service
