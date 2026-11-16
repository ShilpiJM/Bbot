import os
import re
import html
import uuid
import logging
from datetime import datetime
from pathlib import Path
from typing import List, Dict, Any, Optional

from reportlab.lib.pagesizes import letter
from reportlab.platypus import (
    SimpleDocTemplate,
    Paragraph,
    Spacer,
    HRFlowable,
    Table,
    TableStyle,
    Preformatted,
    KeepTogether,
)
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib import colors
from reportlab.pdfgen import canvas

logger = logging.getLogger(__name__)

PDF_STORAGE_DIR = Path("data/generated_pdfs")
PDF_STORAGE_DIR.mkdir(parents=True, exist_ok=True)


class NumberedCanvas(canvas.Canvas):
    """
    Two-pass canvas to dynamically calculate and print exact 'Page X of Y' on all pages.
    """
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._saved_page_states = []

    def showPage(self):
        self._saved_page_states.append(dict(self.__dict__))
        self._startPage()

    def save(self):
        num_pages = len(self._saved_page_states)
        for state in self._saved_page_states:
            self.__dict__.update(state)
            self.draw_page_decorations(num_pages)
            super().showPage()
        super().save()

    def draw_page_decorations(self, page_count: int):
        self.saveState()
        self.setFont("Helvetica", 8)
        self.setFillColor(colors.HexColor("#64748B"))
        
        # Header (Top right)
        self.drawRightString(letter[0] - 40, letter[1] - 25, "TRPW bbot • Intelligence Document")
        self.setStrokeColor(colors.HexColor("#E2E8F0"))
        self.setLineWidth(0.5)
        self.line(40, letter[1] - 28, letter[0] - 40, letter[1] - 28)

        # Footer (Bottom left: generated timestamp, Bottom right: Page X of Y)
        now_str = datetime.now().strftime("%Y-%m-%d %H:%M")
        self.drawString(40, 25, f"Generated on {now_str} • Confidential & Proprietary")
        page_str = f"Page {self._pageNumber} of {page_count}"
        self.drawRightString(letter[0] - 40, 25, page_str)
        self.line(40, 35, letter[0] - 40, 35)
        self.restoreState()


class PDFExportService:
    def __init__(self):
        self.storage_dir = PDF_STORAGE_DIR
        self.storage_dir.mkdir(parents=True, exist_ok=True)

    def _format_inline_markdown(self, text: str) -> str:
        """
        Converts markdown bold, italic, code, and links to ReportLab XML format.
        Sanitizes raw HTML tags so ReportLab parser never throws syntax errors.
        """
        # Standardize break tags to self-closing <br/>
        text = re.sub(r"<br\s*/?>", "<br/>", text, flags=re.I)
        # Escape raw ampersands not part of HTML entities
        text = re.sub(r"&(?!amp;|lt;|gt;|quot;|apos;)", "&amp;", text)
        # Strip unsupported block HTML tags that LLM might output inside tables or text
        text = re.sub(r"</?(?:div|p|span|section|header|footer|nav|h[1-6]|ul|ol|li|hr|img|table|thead|tbody|tr|td|th)[^>]*>", " ", text, flags=re.I)
        # Markdown links: [Title](URL) -> <a href='URL' color='#2563EB'><u>Title</u></a>
        text = re.sub(
            r"\[([^\]]+)\]\(([^)]+)\)",
            r"<a href='\2' color='#2563EB'><u>\1</u></a>",
            text
        )
        # Bold: **text** -> <b>text</b>
        text = re.sub(r"\*\*([^*]+)\*\*", r"<b>\1</b>", text)
        # Italic: *text* -> <i>text</i>
        text = re.sub(r"(?<!\*)\*([^*]+)\*(?!\*)", r"<i>\1</i>", text)
        # Inline code: `text` -> <font face='Courier' color='#0F766E'>text</font>
        text = re.sub(r"`([^`]+)`", r"<font face='Courier' color='#0F766E'><b>\1</b></font>", text)
        return text

    def generate_pdf(
        self,
        content: str,
        title: str = "Report Document",
        filename_hint: str = "report",
        author: str = "TRPW bbot"
    ) -> Dict[str, Any]:
        """
        Builds a high-resolution, presentation-grade PDF from Markdown content.
        Returns dict with file_id, filename, file_path, and download_url.
        """
        file_id = f"pdf_{uuid.uuid4().hex[:12]}"
        safe_hint = re.sub(r"[^a-zA-Z0-9_\-]", "_", filename_hint).strip("_") or "document"
        filename = f"{safe_hint}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.pdf"
        file_path = self.storage_dir / f"{file_id}.pdf"

        styles = getSampleStyleSheet()

        title_style = ParagraphStyle(
            "DocTitle",
            parent=styles["Heading1"],
            fontName="Helvetica-Bold",
            fontSize=18,
            leading=22,
            textColor=colors.HexColor("#0F172A"),
            spaceAfter=6,
        )

        subtitle_style = ParagraphStyle(
            "DocSubTitle",
            parent=styles["Normal"],
            fontName="Helvetica",
            fontSize=9,
            leading=12,
            textColor=colors.HexColor("#64748B"),
            spaceAfter=12,
        )

        h1_style = ParagraphStyle(
            "DocH1",
            parent=styles["Heading2"],
            fontName="Helvetica-Bold",
            fontSize=13,
            leading=16,
            textColor=colors.HexColor("#1E293B"),
            spaceBefore=14,
            spaceAfter=6,
            keepWithNext=True,
        )

        h2_style = ParagraphStyle(
            "DocH2",
            parent=styles["Heading3"],
            fontName="Helvetica-Bold",
            fontSize=11,
            leading=14,
            textColor=colors.HexColor("#334155"),
            spaceBefore=10,
            spaceAfter=4,
            keepWithNext=True,
        )

        body_style = ParagraphStyle(
            "DocBody",
            parent=styles["Normal"],
            fontName="Helvetica",
            fontSize=9.5,
            leading=13.5,
            textColor=colors.HexColor("#334155"),
            spaceAfter=6,
        )

        bullet_style = ParagraphStyle(
            "DocBullet",
            parent=body_style,
            leftIndent=14,
            firstLineIndent=-10,
            spaceAfter=4,
        )

        code_style = ParagraphStyle(
            "DocCode",
            parent=styles["Code"],
            fontName="Courier",
            fontSize=8,
            leading=11,
            textColor=colors.HexColor("#1E293B"),
            backColor=colors.HexColor("#F8FAFC"),
            borderColor=colors.HexColor("#E2E8F0"),
            borderWidth=0.5,
            borderPadding=6,
            spaceBefore=6,
            spaceAfter=6,
        )

        story: List[Any] = []

        # Document Header
        story.append(Paragraph(f"<b>{html.escape(title)}</b>", title_style))
        today_full = datetime.now().strftime("%A, %d %B %Y • %I:%M %p")
        story.append(Paragraph(f"Author: {html.escape(author)} &nbsp;|&nbsp; Date: {today_full}", subtitle_style))
        story.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor("#CBD5E1"), spaceAfter=14))

        # Parse content line by line
        lines = content.split("\n")
        in_code_block = False
        code_lines: List[str] = []

        in_table = False
        table_rows: List[List[str]] = []

        def safe_paragraph(txt: str, sty: ParagraphStyle) -> Paragraph:
            try:
                formatted = self._format_inline_markdown(txt)
                return Paragraph(formatted, sty)
            except Exception:
                cleaned = html.escape(re.sub(r"<[^>]+>", "", txt))
                return Paragraph(cleaned, sty)

        def flush_table():
            nonlocal in_table, table_rows
            if in_table and table_rows:
                try:
                    # Clean markdown separators e.g. |---|---|
                    clean_rows = []
                    for r in table_rows:
                        if all(re.match(r"^:?-+:?$", cell.strip()) for cell in r if cell.strip()):
                            continue
                        row_cells = [
                            safe_paragraph(cell.strip(), body_style)
                            for cell in r
                        ]
                        clean_rows.append(row_cells)

                    if clean_rows:
                        num_cols = max(len(r) for r in clean_rows)
                        col_w = 532 / max(1, num_cols)
                        t = Table(clean_rows, colWidths=[col_w] * num_cols)
                        t.setStyle(TableStyle([
                            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#0F172A")),
                            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                            ("ALIGN", (0, 0), (-1, -1), "LEFT"),
                            ("VALIGN", (0, 0), (-1, -1), "TOP"),
                            ("INNERGRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#E2E8F0")),
                            ("BOX", (0, 0), (-1, -1), 1, colors.HexColor("#CBD5E1")),
                            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#F8FAFC")]),
                            ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
                            ("TOPPADDING", (0, 0), (-1, -1), 5),
                        ]))
                        story.append(t)
                        story.append(Spacer(1, 8))
                except Exception as tbl_err:
                    logger.debug(f"Failed to render table in PDF: {tbl_err}")
            in_table = False
            table_rows = []

        for line in lines:
            trimmed = line.strip()

            # Handle code blocks
            if trimmed.startswith("```"):
                if in_code_block:
                    in_code_block = False
                    code_text = html.escape("\n".join(code_lines))
                    story.append(Preformatted(code_text, code_style))
                    code_lines = []
                else:
                    flush_table()
                    in_code_block = True
                    code_lines = []
                continue

            if in_code_block:
                code_lines.append(line)
                continue

            # Handle Markdown Tables
            if "|" in line and trimmed.startswith("|") and trimmed.endswith("|"):
                flush_table_cells = [c for c in line.split("|")[1:-1]]
                table_rows.append(flush_table_cells)
                in_table = True
                continue
            else:
                if in_table:
                    flush_table()

            if not trimmed:
                story.append(Spacer(1, 4))
                continue

            # Headings
            if trimmed.startswith("# "):
                story.append(safe_paragraph(trimmed[2:].strip(), h1_style))
            elif trimmed.startswith("## "):
                story.append(safe_paragraph(trimmed[3:].strip(), h1_style))
            elif trimmed.startswith("### "):
                story.append(safe_paragraph(trimmed[4:].strip(), h2_style))
            elif trimmed.startswith("#### "):
                story.append(safe_paragraph(trimmed[5:].strip(), h2_style))
            # Bullet points
            elif trimmed.startswith("- ") or trimmed.startswith("* ") or trimmed.startswith("• "):
                story.append(safe_paragraph(f"•&nbsp;{trimmed[2:].strip()}", bullet_style))
            elif re.match(r"^\d+\.\s+", trimmed):
                num_prefix = re.match(r"^\d+\.\s+", trimmed).group(0)
                story.append(safe_paragraph(f"{num_prefix}{trimmed[len(num_prefix):].strip()}", bullet_style))
            elif trimmed.startswith("---") or trimmed.startswith("***"):
                story.append(HRFlowable(width="100%", thickness=0.5, color=colors.HexColor("#E2E8F0"), spaceAfter=8, spaceBefore=8))
            else:
                story.append(safe_paragraph(trimmed, body_style))

        if in_table:
            flush_table()

        # Build document
        doc = SimpleDocTemplate(
            str(file_path),
            pagesize=letter,
            leftMargin=40,
            rightMargin=40,
            topMargin=42,
            bottomMargin=42,
        )
        doc.build(story, canvasmaker=NumberedCanvas)

        logger.info(f"Generated PDF file '{filename}' at {file_path} (size: {file_path.stat().st_size} bytes)")

        return {
            "file_id": file_id,
            "filename": filename,
            "download_url": f"/api/export/pdf/{file_id}",
            "file_path": str(file_path),
            "size_bytes": file_path.stat().st_size,
        }

    def get_pdf_path(self, file_id: str) -> Optional[Path]:
        """
        Retrieves file path safely by file_id, validating alphanumeric format.
        """
        if not re.match(r"^pdf_[a-zA-Z0-9]+$", file_id):
            return None
        target = self.storage_dir / f"{file_id}.pdf"
        if target.exists() and target.is_file():
            return target
        return None


# Singleton
_pdf_service = None

def get_pdf_export_service() -> PDFExportService:
    global _pdf_service
    if _pdf_service is None:
        _pdf_service = PDFExportService()
    return _pdf_service
