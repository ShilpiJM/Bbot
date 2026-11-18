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
    Two-pass canvas to dynamically calculate and print exact 'Page X of Y' on all pages,
    along with corporate headers, footers, and optional diagonal watermark.
    """
    watermark: Optional[str] = None
    doc_author: str = "TRPW bbot"

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

        # 1. Diagonal Watermark across the center
        watermark_text = getattr(self, "watermark", None)
        watermark_image = getattr(self, "watermark_image", None)

        # 1a. Custom Image Watermark (centered logo / stamp)
        if watermark_image and os.path.exists(watermark_image):
            try:
                self.saveState()
                img_w = 260
                img_h = 260
                center_x = (letter[0] - img_w) / 2.0
                center_y = (letter[1] - img_h) / 2.0
                if hasattr(self, 'setFillAlpha'):
                    self.setFillAlpha(0.18)
                self.drawImage(watermark_image, center_x, center_y, width=img_w, height=img_h, mask='auto', preserveAspectRatio=True)
                self.restoreState()
            except Exception as e:
                logger.warning(f"Could not render watermark image: {e}")

        # 1b. Custom Text Watermark (with dynamic font sizing)
        if watermark_text:
            self.saveState()
            text_str = str(watermark_text).strip().upper()
            if len(text_str) <= 12:
                font_size = 50
            elif len(text_str) <= 22:
                font_size = 36
            else:
                font_size = max(18, int(500 / len(text_str)))
            self.setFont("Helvetica-Bold", font_size)
            self.setFillColor(colors.HexColor("#94A3B8"), alpha=0.14)
            self.translate(letter[0] / 2.0, letter[1] / 2.0)
            self.rotate(42)
            self.drawCentredString(0, 0, text_str)
            self.restoreState()

        # 2. Corporate Header (Top left: TRPW STRATEGIC PARTNERS, Top right: Classification / bbot doc)
        self.setFont("Helvetica-Bold", 8)
        self.setFillColor(colors.HexColor("#0F172A"))
        self.drawString(40, letter[1] - 25, "TRPW STRATEGIC PARTNERS")
        self.setFont("Helvetica", 8)
        self.setFillColor(colors.HexColor("#64748B"))
        classification_label = f"[{watermark_text.upper()}] • " if watermark_text else ""
        self.drawRightString(letter[0] - 40, letter[1] - 25, f"{classification_label}bbot Intelligence Document")
        self.setStrokeColor(colors.HexColor("#E2E8F0"))
        self.setLineWidth(0.6)
        self.line(40, letter[1] - 28, letter[0] - 40, letter[1] - 28)

        # 3. Corporate Footer (Bottom left: timestamp & author, Bottom right: Page X of Y)
        now_str = datetime.now().strftime("%Y-%m-%d %H:%M")
        author_name = getattr(self, "doc_author", "TRPW bbot")
        self.drawString(40, 24, f"Generated {now_str} • Author: {author_name} • Confidential & Proprietary")
        page_str = f"Page {self._pageNumber} of {page_count}"
        self.drawRightString(letter[0] - 40, 24, page_str)
        self.setStrokeColor(colors.HexColor("#E2E8F0"))
        self.setLineWidth(0.6)
        self.line(40, 34, letter[0] - 40, 34)
        self.restoreState()


def get_numbered_canvas_class(watermark: Optional[str] = None, watermark_image: Optional[str] = None, author: str = "TRPW bbot"):
    class DynamicNumberedCanvas(NumberedCanvas):
        pass
    DynamicNumberedCanvas.watermark = watermark
    DynamicNumberedCanvas.watermark_image = watermark_image
    DynamicNumberedCanvas.doc_author = author
    return DynamicNumberedCanvas


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
        author: str = "TRPW bbot",
        watermark: Optional[str] = None,
        watermark_image: Optional[str] = None,
        include_signoff: bool = False
    ) -> Dict[str, Any]:
        """
        Builds a high-resolution, presentation-grade PDF from Markdown content.
        Supports corporate branding, dynamic watermark (Confidential, Draft, Approved, custom text, or image logo),
        and executive sign-off governance block.
        """
        file_id = f"pdf_{uuid.uuid4().hex[:12]}"
        safe_hint = re.sub(r"[^a-zA-Z0-9_\-]", "_", filename_hint).strip("_") or "document"
        filename = f"{safe_hint}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.pdf"
        file_path = self.storage_dir / f"{file_id}.pdf"

        # Resolve image watermark if provided as base64 data URL
        temp_img_file = None
        resolved_watermark_img = None
        if watermark_image and isinstance(watermark_image, str):
            if watermark_image.startswith("data:image"):
                import base64, tempfile
                try:
                    header, encoded = watermark_image.split(",", 1)
                    img_data = base64.b64decode(encoded)
                    suffix = ".png" if "png" in header else ".jpg"
                    tfile = tempfile.NamedTemporaryFile(delete=False, suffix=suffix)
                    tfile.write(img_data)
                    tfile.close()
                    temp_img_file = tfile.name
                    resolved_watermark_img = temp_img_file
                except Exception as e:
                    logger.warning(f"Failed to decode base64 watermark image: {e}")
            elif os.path.exists(watermark_image):
                resolved_watermark_img = watermark_image

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

        # Governance & Sign-off Block
        if include_signoff:
            story.append(Spacer(1, 16))
            signoff_data = [
                ["Role / Governance Stage", "Stakeholder / Owner", "Status / Verification", "Date"],
                ["Prepared By (Author)", author, "Generated via bbot AI", today_full],
                ["Reviewed By", "Department Head / Partner", "Pending Sign-off", "—"],
                ["Governance / Compliance", "Legal & Quality Assurance", "Compliant", today_full],
            ]
            signoff_table = Table(
                signoff_data,
                colWidths=[130, 160, 140, 102],
                style=TableStyle([
                    ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#0F172A")),
                    ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                    ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                    ("FONTSIZE", (0, 0), (-1, -1), 8),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
                    ("TOPPADDING", (0, 0), (-1, -1), 5),
                    ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#CBD5E1")),
                    ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.HexColor("#F8FAFC"), colors.white]),
                ])
            )
            story.append(KeepTogether([
                Paragraph("<b>Document Governance & Executive Sign-off</b>", h2_style),
                Spacer(1, 4),
                signoff_table
            ]))

        # Dynamic canvas maker with branding, text watermark & image logo
        canvas_class = get_numbered_canvas_class(
            watermark=watermark, 
            watermark_image=resolved_watermark_img, 
            author=author
        )

        # Build document with guaranteed fallback
        doc = SimpleDocTemplate(
            str(file_path),
            pagesize=letter,
            leftMargin=40,
            rightMargin=40,
            topMargin=42,
            bottomMargin=42,
        )
        try:
            try:
                doc.build(story, canvasmaker=canvas_class)
            except Exception as build_err:
                logger.warning(f"ReportLab rich build failed: {build_err}. Falling back to plain text PDF.")
                fallback_story = [
                    Paragraph(f"<b>{html.escape(title)}</b>", title_style),
                    Paragraph(f"Author: {html.escape(author)} &nbsp;|&nbsp; Date: {today_full}", subtitle_style),
                    HRFlowable(width="100%", thickness=1, color=colors.HexColor("#CBD5E1"), spaceAfter=14),
                ]
                for para in content.split("\n\n"):
                    if para.strip():
                        clean_para = html.escape(re.sub(r"<[^>]+>", "", para.strip()))
                        fallback_story.append(Paragraph(clean_para.replace("\n", "<br/>"), body_style))
                        fallback_story.append(Spacer(1, 6))
                doc.build(fallback_story, canvasmaker=canvas_class)
        finally:
            if temp_img_file and os.path.exists(temp_img_file):
                try:
                    os.remove(temp_img_file)
                except Exception:
                    pass

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
