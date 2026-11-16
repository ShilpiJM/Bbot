import os
import re
import uuid
import logging
from pathlib import Path
from typing import Dict, Any, List

import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter

logger = logging.getLogger(__name__)

EXPORT_DIR = Path("data/exports")


class ExcelExportService:
    def __init__(self, export_dir: Path = EXPORT_DIR):
        self.export_dir = Path(export_dir)
        self.export_dir.mkdir(parents=True, exist_ok=True)

    def _extract_tables_from_markdown(self, markdown_text: str) -> List[List[List[str]]]:
        """
        Parses all markdown tables in the provided text into lists of 2D string matrices.
        """
        tables: List[List[List[str]]] = []
        current_table: List[List[str]] = []
        in_table = False

        lines = markdown_text.split("\n")
        for line in lines:
            trimmed = line.strip()
            if trimmed.startswith("|") and trimmed.endswith("|"):
                # Check if it's separator row |---|---|
                inner = trimmed[1:-1].strip()
                if re.match(r"^[:\s\-]+(\|[:\s\-]+)*$", inner):
                    in_table = True
                    continue

                cells = [c.strip() for c in trimmed[1:-1].split("|")]
                # Strip inline bold/italic
                cells = [re.sub(r"[*_`]", "", c).strip() for c in cells]
                current_table.append(cells)
                in_table = True
            else:
                if in_table and current_table:
                    tables.append(current_table)
                    current_table = []
                    in_table = False

        if current_table:
            tables.append(current_table)

        return tables

    def generate_excel(self, content: str, title: str = "Data Export", filename_hint: str = "bbot_data") -> Dict[str, Any]:
        """
        Generates an enterprise-grade styled .xlsx workbook from markdown content or tables.
        """
        wb = openpyxl.Workbook()
        # Remove default sheet
        wb.remove(wb.active)

        tables = self._extract_tables_from_markdown(content)

        # Corporate styling
        header_fill = PatternFill(start_color="1E3A8A", end_color="1E3A8A", fill_type="solid")
        header_font = Font(name="Segoe UI", size=11, bold=True, color="FFFFFF")
        zebra_fill = PatternFill(start_color="F8FAFC", end_color="F8FAFC", fill_type="solid")
        white_fill = PatternFill(start_color="FFFFFF", end_color="FFFFFF", fill_type="solid")
        body_font = Font(name="Segoe UI", size=10, color="0F172A")
        thin_border = Border(
            left=Side(style="thin", color="CBD5E1"),
            right=Side(style="thin", color="CBD5E1"),
            top=Side(style="thin", color="CBD5E1"),
            bottom=Side(style="thin", color="CBD5E1"),
        )

        if tables:
            for t_idx, table_data in enumerate(tables, start=1):
                sheet_name = f"Table {t_idx}" if len(tables) > 1 else "Data Sheet"
                ws = wb.create_sheet(title=sheet_name)
                ws.views.sheetView[0].showGridLines = True

                for r_idx, row_values in enumerate(table_data, start=1):
                    ws.append(row_values)
                    is_header = (r_idx == 1)
                    row_fill = header_fill if is_header else (zebra_fill if r_idx % 2 == 0 else white_fill)
                    row_font = header_font if is_header else body_font

                    for c_idx in range(1, len(row_values) + 1):
                        cell = ws.cell(row=r_idx, column=c_idx)
                        cell.fill = row_fill
                        cell.font = row_font
                        cell.border = thin_border
                        cell.alignment = Alignment(
                            vertical="center",
                            horizontal="center" if is_header else "left",
                            wrap_text=True,
                        )

                # Set row heights
                ws.row_dimensions[1].height = 28
                for r in range(2, len(table_data) + 1):
                    ws.row_dimensions[r].height = 22

                # Auto-fit column widths
                for col in ws.columns:
                    col_letter = get_column_letter(col[0].column)
                    max_len = 0
                    for cell in col:
                        val_str = str(cell.value or "")
                        max_len = max(max_len, len(val_str))
                    ws.column_dimensions[col_letter].width = min(max(max_len + 5, 12), 50)
        else:
            # Fallback: Parse paragraphs and bullets into structured rows
            ws = wb.create_sheet(title="Summary")
            ws.views.sheetView[0].showGridLines = True
            ws.append(["Section", "Content"])

            for c_idx in [1, 2]:
                cell = ws.cell(row=1, column=c_idx)
                cell.fill = header_fill
                cell.font = header_font
                cell.border = thin_border
                cell.alignment = Alignment(horizontal="center", vertical="center")
            ws.row_dimensions[1].height = 26

            row_num = 2
            current_section = title or "Overview"
            for line in content.split("\n"):
                trimmed = line.strip()
                if not trimmed:
                    continue
                if trimmed.startswith("#"):
                    current_section = trimmed.lstrip("#* ").strip()
                else:
                    clean_text = re.sub(r"[*_`]", "", trimmed).lstrip("-•* ").strip()
                    ws.append([current_section, clean_text])
                    r_fill = zebra_fill if row_num % 2 == 0 else white_fill
                    for c_idx in [1, 2]:
                        c = ws.cell(row=row_num, column=c_idx)
                        c.fill = r_fill
                        c.font = body_font
                        c.border = thin_border
                        c.alignment = Alignment(vertical="center", wrap_text=True)
                    ws.row_dimensions[row_num].height = 22
                    row_num += 1

            ws.column_dimensions["A"].width = 25
            ws.column_dimensions["B"].width = 65

        # Save workbook
        file_id = str(uuid.uuid4())
        safe_hint = re.sub(r"[^\w\-]", "_", filename_hint).strip("_") or "bbot_data"
        filename = f"{safe_hint}_{file_id[:8]}.xlsx"
        file_path = self.export_dir / filename
        wb.save(file_path)

        logger.info(f"Generated Excel export '{filename}' (size: {file_path.stat().st_size} bytes)")
        return {
            "file_id": file_id,
            "filename": filename,
            "download_url": f"/api/export/excel/{file_id}",
            "file_path": str(file_path),
            "size_bytes": file_path.stat().st_size,
        }

    def get_file_path(self, file_id: str) -> Path | None:
        """
        Locates the generated file by file_id.
        """
        for p in self.export_dir.glob(f"*_{file_id[:8]}.xlsx"):
            if p.is_file():
                return p
        return None


# Singleton
_excel_service = None

def get_excel_export_service() -> ExcelExportService:
    global _excel_service
    if _excel_service is None:
        _excel_service = ExcelExportService()
    return _excel_service
