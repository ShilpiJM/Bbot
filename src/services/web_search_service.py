import logging
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
        self._enabled = DDGS is not None

    def search(self, query: str, max_results: int = 5) -> List[Dict[str, str]]:
        """
        Executes a live web search using DuckDuckGo (Free, no API key required).
        Uses a resilient multi-strategy search with backends and news fallback.
        Returns a list of dicts with: 'title', 'body', 'href'.
        """
        if not self._enabled:
            logger.warning("Web search requested but DDGS is not installed.")
            return []

        clean_query = query.strip()
        if not clean_query:
            return []

        logger.info(f"Performing live web search for: '{clean_query}' (max_results={max_results})")
        results: List[Dict[str, str]] = []

        try:
            with DDGS() as ddgs:
                # 1. Try standard text search with multiple backend fallbacks
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

                # 2. If text search returned nothing, fallback to live news search
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
                        logger.debug(f"News fallback search failed for '{clean_query}': {news_err}")

            # Deduplicate by URL or title
            deduped: List[Dict[str, str]] = []
            seen = set()
            for item in results:
                key = item.get("href") or item.get("title")
                if key and key not in seen:
                    seen.add(key)
                    deduped.append(item)

            final_results = deduped[:max_results]
            logger.info(f"Web search returned {len(final_results)} live results for '{clean_query}'")
            return final_results
        except Exception as e:
            logger.warning(f"Live web search failed for query '{clean_query}': {e}")
            return []

    def format_for_prompt(self, results: List[Dict[str, str]]) -> str:
        """
        Formats search results into an authoritative grounded context for the LLM.
        """
        if not results:
            return ""

        formatted_lines = [
            "### REAL-TIME WEB SEARCH RESULTS (GROUND TRUTH):",
            "Use the following real-time web sources to provide an accurate, up-to-date response.",
            "For every key factual claim, cite the source using clickable markdown links, e.g. [Source Title](URL).",
            "",
        ]

        for i, res in enumerate(results, start=1):
            title = res.get("title", f"Source {i}")
            href = res.get("href", "")
            body = res.get("body", "").strip()
            formatted_lines.append(f"[{i}] {title}")
            if href:
                formatted_lines.append(f"URL: {href}")
            if body:
                formatted_lines.append(f"Snippet: {body}")
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
