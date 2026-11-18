import os
import re
import uuid
import logging
from datetime import datetime
from pathlib import Path
from typing import Dict, Any, List

import docx
from docx import Document
from docx.shared import Inches, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.oxml import OxmlElement, parse_xml
from docx.oxml.ns import nsdecls, qn

logger = logging.getLogger(__name__)

EXPORT_DIR = Path("data/exports")


class DocxExportService:
    def __init__(self, export_dir: Path = EXPORT_DIR):
        self.export_dir = Path(export_dir)
        self.export_dir.mkdir(parents=True, exist_ok=True)

    def _set_cell_background(self, cell, fill_hex: str):
        shading = parse_xml(f'<w:shd {nsdecls("w")} w:fill="{fill_hex}"/>')
        cell._tc.get_or_add_tcPr().append(shading)

    def _set_cell_margins(self, cell, top=100, bottom=100, left=150, right=150):
        tcPr = cell._tc.get_or_add_tcPr()
        tcMar = OxmlElement('w:tcMar')
        for m, val in [('w:top', top), ('w:bottom', bottom), ('w:left', left), ('w:right', right)]:
            node = OxmlElement(m)
            node.set(qn('w:w'), str(val))
            node.set(qn('w:type'), 'dxa')
            tcMar.append(node)
        tcPr.append(tcMar)

    def generate_docx(
        self,
        content: str,
        title: str = "Intelligence Report",
        filename_hint: str = "bbot_document",
        watermark: str | None = None,
        watermark_image: str | None = None,
        include_signoff: bool = False
    ) -> Dict[str, Any]:
        """
        Builds an executive Word document (.docx) from markdown text, headings, lists, and tables.
        Supports corporate branding headers, classification watermarks, image logos, and governance sign-off.
        """
        temp_img_file = None
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
                except Exception:
                    pass
            elif os.path.exists(watermark_image):
                temp_img_file = watermark_image

        doc = Document()

        # Set page margins & corporate headers/footers
        for section in doc.sections:
            section.top_margin = Inches(0.8)
            section.bottom_margin = Inches(0.8)
            section.left_margin = Inches(0.8)
            section.right_margin = Inches(0.8)

            # Corporate Header
            hp = section.header.paragraphs[0]
            hp.alignment = WD_ALIGN_PARAGRAPH.RIGHT
            hrun = hp.add_run("TRPW STRATEGIC PARTNERS  •  bbot Intelligence")
            hrun.font.name = "Segoe UI"
            hrun.font.size = Pt(8)
            hrun.font.color.rgb = RGBColor(0x94, 0xA3, 0xB8)

            # Corporate Footer
            fp = section.footer.paragraphs[0]
            fp.alignment = WD_ALIGN_PARAGRAPH.LEFT
            classification_prefix = f"[{watermark.upper()}]  •  " if watermark else ""
            frun = fp.add_run(f"{classification_prefix}Confidential & Proprietary  •  Generated {datetime.now().strftime('%Y-%m-%d %H:%M')}")
            frun.font.name = "Segoe UI"
            frun.font.size = Pt(8)
            frun.font.color.rgb = RGBColor(0x94, 0xA3, 0xB8)

        # Custom Image Logo / Watermark
        if temp_img_file and os.path.exists(temp_img_file):
            try:
                logo_p = doc.add_paragraph()
                logo_p.alignment = WD_ALIGN_PARAGRAPH.CENTER
                logo_run = logo_p.add_run()
                logo_run.add_picture(temp_img_file, width=Inches(1.8))
                logo_p.paragraph_format.space_after = Pt(6)
            except Exception as e:
                logger.warning(f"Failed to add image to Word doc: {e}")

        # Classification Banner if watermark provided
        if watermark:
            banner_p = doc.add_paragraph()
            banner_p.alignment = WD_ALIGN_PARAGRAPH.CENTER
            badge_run = banner_p.add_run(f"✦  DOCUMENT CLASSIFICATION: {watermark.upper()}  ✦")
            badge_run.font.name = "Segoe UI"
            badge_run.font.size = Pt(9.5)
            badge_run.font.bold = True
            badge_run.font.color.rgb = RGBColor(0xDC, 0x26, 0x26) if "CONFIDENTIAL" in watermark.upper() else RGBColor(0xD9, 0x77, 0x06)
            banner_p.paragraph_format.space_after = Pt(4)

        # Title
        title_p = doc.add_paragraph()
        title_run = title_p.add_run(title)
        title_run.font.name = "Segoe UI"
        title_run.font.size = Pt(22)
        title_run.font.bold = True
        title_run.font.color.rgb = RGBColor(0x1E, 0x3A, 0x8A)  # Navy
        title_p.paragraph_format.space_after = Pt(2)

        # Subtitle
        sub_p = doc.add_paragraph()
        today_str = datetime.now().strftime("%A, %d %B %Y")
        sub_run = sub_p.add_run(f"bbot Intelligence Document  •  {today_str}")
        sub_run.font.name = "Segoe UI"
        sub_run.font.size = Pt(9.5)
        sub_run.font.color.rgb = RGBColor(0x64, 0x74, 0x8B)  # Slate
        sub_p.paragraph_format.space_after = Pt(16)

        # Parse content line by line
        lines = content.split("\n")
        in_table = False
        table_rows: List[List[str]] = []

        def flush_table():
            nonlocal table_rows
            if not table_rows:
                return
            col_count = max(len(r) for r in table_rows)
            tbl = doc.add_table(rows=len(table_rows), cols=col_count)
            tbl.alignment = WD_TABLE_ALIGNMENT.CENTER
            tbl.autofit = True

            for r_idx, row_data in enumerate(table_rows):
                is_header = (r_idx == 0)
                row_el = tbl.rows[r_idx]
                for c_idx in range(col_count):
                    cell = row_el.cells[c_idx]
                    val = row_data[c_idx] if c_idx < len(row_data) else ""
                    self._set_cell_margins(cell, top=120, bottom=120, left=150, right=150)
                    self._set_cell_background(cell, "1E3A8A" if is_header else ("F8FAFC" if r_idx % 2 == 0 else "FFFFFF"))

                    cell_p = cell.paragraphs[0]
                    cell_p.paragraph_format.space_before = Pt(2)
                    cell_p.paragraph_format.space_after = Pt(2)
                    cell_run = cell_p.add_run(val)
                    cell_run.font.name = "Segoe UI"
                    cell_run.font.size = Pt(9.5 if is_header else 9)
                    if is_header:
                        cell_run.font.bold = True
                        cell_run.font.color.rgb = RGBColor(0xFF, 0xFF, 0xFF)
                    else:
                        cell_run.font.color.rgb = RGBColor(0x0F, 0x17, 0x2A)

            p_space = doc.add_paragraph()
            p_space.paragraph_format.space_after = Pt(8)
            table_rows = []

        for line in lines:
            trimmed = line.strip()

            # Table row detection
            if trimmed.startswith("|") and trimmed.endswith("|"):
                inner = trimmed[1:-1].strip()
                if re.match(r"^[:\s\-]+(\|[:\s\-]+)*$", inner):
                    in_table = True
                    continue
                cells = [re.sub(r"[*_`]", "", c).strip() for c in trimmed[1:-1].split("|")]
                table_rows.append(cells)
                in_table = True
                continue
            else:
                if in_table:
                    flush_table()
                    in_table = False

            if not trimmed:
                continue

            # Heading 1 (# ...)
            if trimmed.startswith("# "):
                h = doc.add_paragraph()
                h.paragraph_format.space_before = Pt(14)
                h.paragraph_format.space_after = Pt(4)
                r = h.add_run(trimmed[2:].strip())
                r.font.name = "Segoe UI"
                r.font.size = Pt(15)
                r.font.bold = True
                r.font.color.rgb = RGBColor(0x1E, 0x3A, 0x8A)
            # Heading 2 (## ...)
            elif trimmed.startswith("## "):
                h = doc.add_paragraph()
                h.paragraph_format.space_before = Pt(12)
                h.paragraph_format.space_after = Pt(3)
                r = h.add_run(trimmed[3:].strip())
                r.font.name = "Segoe UI"
                r.font.size = Pt(13)
                r.font.bold = True
                r.font.color.rgb = RGBColor(0x0F, 0x17, 0x2A)
            # Heading 3 (### ...)
            elif trimmed.startswith("### "):
                h = doc.add_paragraph()
                h.paragraph_format.space_before = Pt(10)
                h.paragraph_format.space_after = Pt(2)
                r = h.add_run(trimmed[4:].strip())
                r.font.name = "Segoe UI"
                r.font.size = Pt(11)
                r.font.bold = True
                r.font.color.rgb = RGBColor(0x33, 0x41, 0x55)
            # Bullet point (- ... or * ...)
            elif re.match(r"^[-*•]\s+", trimmed):
                bullet_text = re.sub(r"^[-*•]\s+", "", trimmed)
                p = doc.add_paragraph(style='List Bullet')
                p.paragraph_format.space_before = Pt(1)
                p.paragraph_format.space_after = Pt(2)
                # Split inline bold (**bold**)
                parts = re.split(r"(\*\*.*?\*\*)", bullet_text)
                for part in parts:
                    if part.startswith("**") and part.endswith("**"):
                        r = p.add_run(part[2:-2])
                        r.font.bold = True
                    else:
                        r = p.add_run(part)
                    r.font.name = "Segoe UI"
                    r.font.size = Pt(10)
            else:
                # Regular paragraph
                p = doc.add_paragraph()
                p.paragraph_format.space_before = Pt(2)
                p.paragraph_format.space_after = Pt(6)
                parts = re.split(r"(\*\*.*?\*\*)", trimmed)
                for part in parts:
                    if part.startswith("**") and part.endswith("**"):
                        r = p.add_run(part[2:-2])
                        r.font.bold = True
                    else:
                        r = p.add_run(part)
                    r.font.name = "Segoe UI"
                    r.font.size = Pt(10)
                    r.font.color.rgb = RGBColor(0x0F, 0x17, 0x2A)

        if in_table:
            flush_table()

        # Governance & Sign-off Block
        if include_signoff:
            doc.add_paragraph().paragraph_format.space_before = Pt(16)
            h_sign = doc.add_paragraph()
            h_sign_run = h_sign.add_run("Document Governance & Executive Sign-off")
            h_sign_run.font.name = "Segoe UI"
            h_sign_run.font.size = Pt(13)
            h_sign_run.font.bold = True
            h_sign_run.font.color.rgb = RGBColor(0x0F, 0x17, 0x2A)

            sign_table = doc.add_table(rows=4, cols=4)
            sign_table.alignment = WD_TABLE_ALIGNMENT.CENTER
            headers = ["Role / Governance Stage", "Stakeholder / Owner", "Status / Verification", "Date"]
            for i, h in enumerate(headers):
                cell = sign_table.rows[0].cells[i]
                cell.text = h
                self._set_cell_background(cell, "0F172A")
                for r in cell.paragraphs[0].runs:
                    r.font.name = "Segoe UI"
                    r.font.bold = True
                    r.font.size = Pt(8.5)
                    r.font.color.rgb = RGBColor(0xFF, 0xFF, 0xFF)

            rows_data = [
                ["Prepared By (Author)", "bbot AI Intelligence", "Verified Draft", datetime.now().strftime("%Y-%m-%d")],
                ["Reviewed By", "Department Head / Partner", "Pending Sign-off", "—"],
                ["Governance / Compliance", "Legal & Quality Assurance", "Compliant", datetime.now().strftime("%Y-%m-%d")],
            ]
            for r_idx, row in enumerate(rows_data):
                for c_idx, val in enumerate(row):
                    cell = sign_table.rows[r_idx + 1].cells[c_idx]
                    cell.text = val
                    if r_idx % 2 == 0:
                        self._set_cell_background(cell, "F8FAFC")
                    for r in cell.paragraphs[0].runs:
                        r.font.name = "Segoe UI"
                        r.font.size = Pt(8.5)
                        r.font.color.rgb = RGBColor(0x1E, 0x29, 0x3B)

        # Save docx
        file_id = str(uuid.uuid4())
        safe_hint = re.sub(r"[^\w\-]", "_", filename_hint).strip("_") or "bbot_document"
        filename = f"{safe_hint}_{file_id[:8]}.docx"
        file_path = self.export_dir / filename
        doc.save(str(file_path))

        if temp_img_file and os.path.exists(temp_img_file):
            try:
                os.remove(temp_img_file)
            except Exception:
                pass

        logger.info(f"Generated Word export '{filename}' (size: {file_path.stat().st_size} bytes)")
        return {
            "file_id": file_id,
            "filename": filename,
            "download_url": f"/api/export/docx/{file_id}",
            "file_path": str(file_path),
            "size_bytes": file_path.stat().st_size,
        }

    def get_file_path(self, file_id: str) -> Path | None:
        """
        Locates the generated file by file_id.
        """
        for p in self.export_dir.glob(f"*_{file_id[:8]}.docx"):
            if p.is_file():
                return p
        return None


# Singleton
_docx_service = None

def get_docx_export_service() -> DocxExportService:
    global _docx_service
    if _docx_service is None:
        _docx_service = DocxExportService()
    return _docx_service
