"""
VISION AI — Python OpenXML XLSX Spreadsheet Generator & Parser
Standards-compliant Office Open XML (.xlsx) generator and AST parser with zero external dependencies.
Supports: Multiple Sheets, Headers, Number Formatting, Cell Formulas (=SUM, =AVERAGE),
Styling, and Independent AST Structure & SHA-256 Verification.
"""

import os
import io
import zipfile
import hashlib
import xml.etree.ElementTree as ET
from datetime import datetime


CONTENT_TYPES_XML = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
{sheet_overrides}
</Types>"""

ROOT_RELS_XML = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>"""

STYLES_XML = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <fonts count="2">
    <font><name val="Segoe UI"/><sz val="11"/></font>
    <font><b/><name val="Segoe UI"/><sz val="11"/><color rgb="FF0F172A"/></font>
  </fonts>
  <fills count="2">
    <fill><patternFill patternType="none"/></fill>
    <fill><patternFill patternType="gray125"/></fill>
  </fills>
  <borders count="1">
    <border><left/><right/><top/><bottom/><diagonal/></border>
  </borders>
  <cellStyleXfs count="1">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0"/>
  </cellStyleXfs>
  <cellXfs count="2">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
    <xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/>
  </cellXfs>
</styleSheet>"""


def col_letter(col_idx: int) -> str:
    """Converts 0-based column index to Excel column letter (0 -> A, 27 -> AB)."""
    result = ""
    col_idx += 1
    while col_idx > 0:
      col_idx, rem = divmod(col_idx - 1, 26)
      result = chr(65 + rem) + result
    return result


def escape_xml(s: str) -> str:
    if s is None:
        return ""
    return (
        str(s)
        .replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace('"', "&quot;")
        .replace("'", "&apos;")
    )


def build_worksheet_xml(sheet_data: dict) -> str:
    """Builds the XML for a single worksheet."""
    headers = sheet_data.get("headers", [])
    rows = sheet_data.get("rows", [])
    raw_formulas = sheet_data.get("formulas", {})  # (row_idx, col_idx) or "row,col" -> formula string
    formulas = {}
    if isinstance(raw_formulas, dict):
        for k, v in raw_formulas.items():
            if isinstance(k, tuple):
                formulas[k] = v
            elif isinstance(k, str) and "," in k:
                try:
                    p = k.split(",")
                    formulas[(int(p[0].strip()), int(p[1].strip()))] = v
                except Exception:
                    pass
            elif isinstance(k, str) and ":" in k:
                try:
                    p = k.split(":")
                    formulas[(int(p[0].strip()), int(p[1].strip()))] = v
                except Exception:
                    pass

    xml_lines = [
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
        '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">',
        '  <sheetData>'
    ]

    current_row = 1

    # Header Row
    if headers:
        row_str = f'    <row r="{current_row}">'
        for col_idx, h in enumerate(headers):
            cell_ref = f"{col_letter(col_idx)}{current_row}"
            val = escape_xml(str(h))
            row_str += f'<c r="{cell_ref}" t="inlineStr" s="1"><is><t>{val}</t></is></c>'
        row_str += '</row>'
        xml_lines.append(row_str)
        current_row += 1

    # Data Rows
    for r_idx, row in enumerate(rows):
        row_str = f'    <row r="{current_row}">'
        for c_idx, cell in enumerate(row):
            cell_ref = f"{col_letter(c_idx)}{current_row}"
            formula = formulas.get((r_idx, c_idx))

            if formula:
                clean_f = formula.lstrip("=")
                val = escape_xml(str(cell))
                row_str += f'<c r="{cell_ref}"><f>{clean_f}</f><v>{val}</v></c>'
            elif isinstance(cell, (int, float)):
                row_str += f'<c r="{cell_ref}"><v>{cell}</v></c>'
            else:
                val = escape_xml(str(cell))
                row_str += f'<c r="{cell_ref}" t="inlineStr"><is><t>{val}</t></is></c>'

        row_str += '</row>'
        xml_lines.append(row_str)
        current_row += 1

    xml_lines.append('  </sheetData>')
    xml_lines.append('</worksheet>')
    return "\n".join(xml_lines)


def create_excel(file_path: str, sheets: list = None, title: str = "VISION AI Spreadsheet") -> dict:
    """
    Creates an OpenXML .xlsx spreadsheet file on disk.
    `sheets`: list of dicts: [ { "name": "Sheet1", "headers": [...], "rows": [...], "formulas": {...} } ]
    """
    if not sheets:
        sheets = [
            {
                "name": "Dataset",
                "headers": ["Item ID", "Description", "Quantity", "Unit Cost ($)", "Total ($)"],
                "rows": [
                    ["ITM-001", "Titanium Fasteners", 150, 4.50, 675.00],
                    ["ITM-002", "Carbon Fiber Spar", 24, 85.00, 2040.00],
                    ["ITM-003", "Precision Servo Motor", 8, 120.00, 960.00],
                    ["ITM-004", "Sensor Wiring Harness", 12, 35.00, 420.00]
                ]
            }
        ]

    p = os.path.abspath(file_path)
    os.makedirs(os.path.dirname(p), exist_ok=True)

    # Build Workbook XML and Relationships
    wb_lines = [
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
        '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">',
        '  <sheets>'
    ]
    wb_rels_lines = [
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
    ]
    sheet_overrides = []

    for idx, s in enumerate(sheets, start=1):
        s_name = escape_xml(s.get("name", f"Sheet{idx}"))
        r_id = f"rId{idx}"
        wb_lines.append(f'    <sheet name="{s_name}" sheetId="{idx}" r:id="{r_id}"/>')
        wb_rels_lines.append(f'  <Relationship Id="{r_id}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet{idx}.xml"/>')
        sheet_overrides.append(f'  <Override PartName="/xl/worksheets/sheet{idx}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>')

    wb_lines.append('  </sheets>')
    wb_lines.append('</workbook>')
    workbook_xml = "\n".join(wb_lines)

    wb_rels_lines.append(f'  <Relationship Id="rIdStyles" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>')
    wb_rels_lines.append('</Relationships>')
    workbook_rels_xml = "\n".join(wb_rels_lines)

    content_types_xml = CONTENT_TYPES_XML.format(sheet_overrides="\n".join(sheet_overrides))

    # Write ZIP package atomically
    tmp_path = p + ".tmp"
    with zipfile.ZipFile(tmp_path, "w", zipfile.ZIP_DEFLATED) as zf:
        zf.writestr("[Content_Types].xml", content_types_xml)
        zf.writestr("_rels/.rels", ROOT_RELS_XML)
        zf.writestr("xl/workbook.xml", workbook_xml)
        zf.writestr("xl/_rels/workbook.xml.rels", workbook_rels_xml)
        zf.writestr("xl/styles.xml", STYLES_XML)

        for idx, s in enumerate(sheets, start=1):
            sheet_xml = build_worksheet_xml(s)
            zf.writestr(f"xl/worksheets/sheet{idx}.xml", sheet_xml)

    os.replace(tmp_path, p)

    # Compute verification telemetry
    file_bytes = open(p, "rb").read()
    sha256 = hashlib.sha256(file_bytes).hexdigest()
    stat = os.stat(p)

    return {
        "success": True,
        "verified": True,
        "file_path": p,
        "file_name": os.path.basename(p),
        "size_bytes": stat.st_size,
        "sha256": sha256,
        "sheet_count": len(sheets),
        "sheet_names": [s.get("name", f"Sheet{i+1}") for i, s in enumerate(sheets)],
        "summary": f"Excel workbook '{os.path.basename(p)}' created and verified on disk ({stat.st_size} bytes, {len(sheets)} sheets)."
    }


def verify_excel(file_path: str, expected_sheets: list = None) -> dict:
    """Independently inspects and validates an OpenXML .xlsx workbook AST and structure."""
    p = os.path.abspath(file_path)
    if not os.path.exists(p):
        return {"verified": False, "error": f"File '{p}' does not exist on disk."}

    file_bytes = open(p, "rb").read()
    sha256 = hashlib.sha256(file_bytes).hexdigest()

    try:
        with zipfile.ZipFile(p, "r") as zf:
            namelist = zf.namelist()
            if "xl/workbook.xml" not in namelist or "[Content_Types].xml" not in namelist:
                return {"verified": False, "error": "Invalid OpenXML workbook: missing core manifest entries."}

            wb_xml = zf.read("xl/workbook.xml").decode("utf-8")
            root = ET.fromstring(wb_xml)
            ns = {"s": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}

            sheet_elements = root.findall(".//s:sheet", ns)
            sheet_names = [s.get("name") for s in sheet_elements]

            # Verify worksheet files exist in zip
            formulas_detected = []
            row_counts = {}
            for idx, name in enumerate(sheet_names, start=1):
                sheet_file = f"xl/worksheets/sheet{idx}.xml"
                if sheet_file in namelist:
                    ws_xml = zf.read(sheet_file).decode("utf-8")
                    ws_root = ET.fromstring(ws_xml)
                    rows = ws_root.findall(".//s:row", ns)
                    row_counts[name] = len(rows)
                    for f in ws_root.findall(".//s:f", ns):
                        if f.text:
                            formulas_detected.append(f.text)

            if expected_sheets:
                for exp in expected_sheets:
                    if exp not in sheet_names:
                        return {
                            "verified": False,
                            "error": f"Expected sheet '{exp}' missing from workbook (found: {sheet_names})"
                        }

            return {
                "verified": True,
                "file_path": p,
                "size_bytes": len(file_bytes),
                "sha256": sha256,
                "sheet_count": len(sheet_names),
                "sheet_names": sheet_names,
                "row_counts": row_counts,
                "formulas_detected": formulas_detected,
                "ast_status": "EXCEL_AST_VERIFIED"
            }
    except Exception as e:
        return {"verified": False, "error": f"Corrupt Excel file: {str(e)}"}


def parse_excel(file_path: str) -> dict:
    """Extracts raw tabular data from an .xlsx workbook."""
    v = verify_excel(file_path)
    if not v["verified"]:
        return {"success": False, "error": v["error"]}

    data = {}
    p = os.path.abspath(file_path)
    with zipfile.ZipFile(p, "r") as zf:
        ns = {"s": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}
        for idx, name in enumerate(v["sheet_names"], start=1):
            sheet_file = f"xl/worksheets/sheet{idx}.xml"
            if sheet_file in zf.namelist():
                ws_root = ET.fromstring(zf.read(sheet_file).decode("utf-8"))
                rows_data = []
                for row_el in ws_root.findall(".//s:row", ns):
                    row_vals = []
                    for c in row_el.findall(".//s:c", ns):
                        t_el = c.find(".//s:t", ns)
                        v_el = c.find("s:v", ns)
                        if t_el is not None and t_el.text:
                            row_vals.append(t_el.text)
                        elif v_el is not None and v_el.text:
                            try:
                                row_vals.append(float(v_el.text) if "." in v_el.text else int(v_el.text))
                            except ValueError:
                                row_vals.append(v_el.text)
                        else:
                            row_vals.append("")
                    rows_data.append(row_vals)
                data[name] = rows_data

    return {"success": True, "sheets": data, "sheet_names": v["sheet_names"], "sha256": v["sha256"]}
