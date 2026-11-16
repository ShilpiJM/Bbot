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

    def generate_docx(self, content: str, title: str = "Intelligence Report", filename_hint: str = "bbot_document") -> Dict[str, Any]:
        """
        Builds an executive Word document (.docx) from markdown text, headings, lists, and tables.
        """
        doc = Document()

        # Set page margins (1 inch)
        for section in doc.sections:
            section.top_margin = Inches(0.8)
            section.bottom_margin = Inches(0.8)
            section.left_margin = Inches(0.8)
            section.right_margin = Inches(0.8)

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

        # Save docx
        file_id = str(uuid.uuid4())
        safe_hint = re.sub(r"[^\w\-]", "_", filename_hint).strip("_") or "bbot_document"
        filename = f"{safe_hint}_{file_id[:8]}.docx"
        file_path = self.export_dir / filename
        doc.save(str(file_path))

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
