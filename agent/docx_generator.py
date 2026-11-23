"""
VISION AI — Python OpenXML DOCX Document Generator & Parser
Standards-compliant Office Open XML (.docx) generator with zero external dependencies.
Supports: Headings, Subheadings, Paragraphs, Formatted Tables, Styles, and AST Verification.
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
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
</Types>"""

ROOT_RELS_XML = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>"""

DOCUMENT_RELS_XML = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rIdStyles" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>"""

STYLES_XML = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:docDefaults>
    <w:rPrDefault>
      <w:rPr>
        <w:rFonts w:ascii="Segoe UI" w:hAnsi="Segoe UI" w:cs="Segoe UI"/>
        <w:sz w:val="22"/>
        <w:color w:val="1F2937"/>
      </w:rPr>
    </w:rPrDefault>
  </w:docDefaults>
  <w:style w:type="paragraph" w:styleId="Heading1">
    <w:name w:val="heading 1"/>
    <w:rPr>
      <w:b/>
      <w:sz w:val="36"/>
      <w:color w:val="0F172A"/>
    </w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Heading2">
    <w:name w:val="heading 2"/>
    <w:rPr>
      <w:b/>
      <w:sz w:val="28"/>
      <w:color w:val="1E293B"/>
    </w:rPr>
  </w:style>
</w:styles>"""


def escape_xml(text: str) -> str:
    if text is None:
        return ""
    return (
        str(text)
        .replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace('"', "&quot;")
        .replace("'", "&apos;")
    )


def build_document_xml(title: str, subtitle: str, author: str, sections: list, tables: list = None) -> str:
    body_elements = []

    # Title
    if title:
        body_elements.append(
            f'<w:p><w:pPr><w:pStyle w:val="Heading1"/><w:jc w:val="center"/><w:spacing w:after="160"/></w:pPr>'
            f'<w:r><w:rPr><w:b/><w:sz w:val="44"/><w:color w:val="0F172A"/></w:rPr><w:t>{escape_xml(title)}</w:t></w:r></w:p>'
        )

    # Subtitle
    if subtitle:
        body_elements.append(
            f'<w:p><w:pPr><w:jc w:val="center"/><w:spacing w:after="120"/></w:pPr>'
            f'<w:r><w:rPr><w:i/><w:sz w:val="24"/><w:color w:val="475569"/></w:rPr><w:t>{escape_xml(subtitle)}</w:t></w:r></w:p>'
        )

    # Metadata banner (Author + Date)
    date_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    meta_text = f"Author: {author or 'VISION AI Local Agent'} | Generated: {date_str}"
    body_elements.append(
        f'<w:p><w:pPr><w:jc w:val="center"/><w:spacing w:after="300"/></w:pPr>'
        f'<w:r><w:rPr><w:sz w:val="18"/><w:color w:val="64748B"/></w:rPr><w:t>{escape_xml(meta_text)}</w:t></w:r></w:p>'
    )

    # Sections
    if sections:
        for sec in sections:
            heading = sec.get("heading")
            level = sec.get("level", 1)
            style_id = "Heading1" if level == 1 else "Heading2"
            sz_val = "32" if level == 1 else "26"

            if heading:
                body_elements.append(
                    f'<w:p><w:pPr><w:pStyle w:val="{style_id}"/><w:spacing w:before="240" w:after="100"/></w:pPr>'
                    f'<w:r><w:rPr><w:b/><w:sz w:val="{sz_val}"/><w:color w:val="0F172A"/></w:rPr><w:t>{escape_xml(heading)}</w:t></w:r></w:p>'
                )

            paragraphs = sec.get("paragraphs", [])
            for p in paragraphs:
                body_elements.append(
                    f'<w:p><w:pPr><w:spacing w:after="140" w:line="276" w:lineRule="auto"/></w:pPr>'
                    f'<w:r><w:t>{escape_xml(p)}</w:t></w:r></w:p>'
                )

    # Tables
    if tables:
        for tbl in tables:
            headers = tbl.get("headers", [])
            rows = tbl.get("rows", [])

            tbl_xml = ['<w:tbl><w:tblPr><w:tblBorders>'
                       '<w:top w:val="single" w:sz="6" w:space="0" w:color="CBD5E1"/>'
                       '<w:bottom w:val="single" w:sz="6" w:space="0" w:color="CBD5E1"/>'
                       '<w:insideH w:val="single" w:sz="4" w:space="0" w:color="E2E8F0"/>'
                       '<w:insideV w:val="none"/>'
                       '</w:tblBorders><w:tblCellMar>'
                       '<w:top w:w="120" w:type="dxa"/><w:bottom w:w="120" w:type="dxa"/>'
                       '<w:left w:w="180" w:type="dxa"/><w:right w:w="180" w:type="dxa"/>'
                       '</w:tblCellMar></w:tblPr>']

            # Header Row
            if headers:
                tbl_xml.append('<w:tr>')
                for h in headers:
                    tbl_xml.append(
                        f'<w:tc><w:tcPr><w:shd w:val="clear" w:color="auto" w:fill="F1F5F9"/></w:tcPr>'
                        f'<w:p><w:pPr><w:spacing w:after="0"/></w:pPr>'
                        f'<w:r><w:rPr><w:b/><w:color w:val="0F172A"/></w:rPr><w:t>{escape_xml(h)}</w:t></w:r></w:p></w:tc>'
                    )
                tbl_xml.append('</w:tr>')

            # Data Rows
            for idx, row in enumerate(rows):
                bg_color = "F8FAFC" if (idx % 2 == 1) else "FFFFFF"
                tbl_xml.append('<w:tr>')
                for cell in row:
                    tbl_xml.append(
                        f'<w:tc><w:tcPr><w:shd w:val="clear" w:color="auto" w:fill="{bg_color}"/></w:tcPr>'
                        f'<w:p><w:pPr><w:spacing w:after="0"/></w:pPr>'
                        f'<w:r><w:t>{escape_xml(str(cell))}</w:t></w:r></w:p></w:tc>'
                    )
                tbl_xml.append('</w:tr>')

            tbl_xml.append('</w:tbl>')
            body_elements.append("".join(tbl_xml))

    # Page properties (Standard Letter / A4 margin)
    body_elements.append(
        '<w:sectPr><w:pgSz w:w="12240" w:h="15840"/>'
        '<w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="720" w:footer="720" w:gutter="0"/>'
        '</w:sectPr>'
    )

    body_content = "".join(body_elements)
    return (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'
        '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">\n'
        f'<w:body>{body_content}</w:body>\n'
        '</w:document>'
    )


def create_docx(
    file_path: str,
    title: str = "VISION AI Technical Report",
    subtitle: str = "Verified Windows Agent Deliverable",
    author: str = "VISION AI Local Agent",
    sections: list = None,
    tables: list = None
) -> dict:
    abs_path = os.path.abspath(file_path)
    os.makedirs(os.path.dirname(abs_path), exist_ok=True)

    if sections is None:
        sections = [
            {
                "heading": "1. Executive Summary",
                "level": 1,
                "paragraphs": [
                    "This document was autonomously generated and verified by the VISION Python Local Agent.",
                    "All OpenXML standards, font styles, headings, and table properties are validated."
                ]
            }
        ]

    doc_xml = build_document_xml(title, subtitle, author, sections, tables)

    # Compile ZIP package
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as z:
        z.writestr("[Content_Types].xml", CONTENT_TYPES_XML)
        z.writestr("_rels/.rels", ROOT_RELS_XML)
        z.writestr("word/_rels/document.xml.rels", DOCUMENT_RELS_XML)
        z.writestr("word/styles.xml", STYLES_XML)
        z.writestr("word/document.xml", doc_xml)

    data = buf.getvalue()

    # Atomic write to disk
    tmp_path = f"{abs_path}.tmp_{os.getpid()}"
    with open(tmp_path, "wb") as f:
        f.write(data)
        f.flush()
        os.fsync(f.fileno())

    os.replace(tmp_path, abs_path)

    # Post-write verification
    sha256 = hashlib.sha256(data).hexdigest()
    stat = os.stat(abs_path)

    verification = verify_docx(abs_path)

    return {
        "success": verification["verified"],
        "verified": verification["verified"],
        "file_path": abs_path,
        "file_name": os.path.basename(abs_path),
        "size_bytes": stat.st_size,
        "sha256": sha256,
        "headings_count": verification.get("headings_count", len(sections)),
        "tables_count": verification.get("tables_count", len(tables or [])),
        "summary": f"Word document '{os.path.basename(abs_path)}' created and verified on disk ({stat.st_size} bytes)."
    }


def verify_docx(file_path: str, expected_headings: list = None) -> dict:
    abs_path = os.path.abspath(file_path)
    if not os.path.exists(abs_path):
        return {"verified": False, "error": f"File '{abs_path}' does not exist on disk."}

    size = os.path.getsize(abs_path)
    if size == 0:
        return {"verified": False, "error": "File size is 0 bytes."}

    try:
        with zipfile.ZipFile(abs_path, "r") as z:
            names = z.namelist()
            if "word/document.xml" not in names or "[Content_Types].xml" not in names:
                return {"verified": False, "error": "Missing essential OpenXML package files."}

            doc_xml = z.read("word/document.xml")
            root = ET.fromstring(doc_xml)
            ns = {"w": "http://schemas.openxmlformats.org/wordprocessingml/2006/main"}

            headings = []
            paragraphs = []
            tables_count = len(root.findall(".//w:tbl", ns))

            for p in root.findall(".//w:p", ns):
                p_text = "".join(t.text for t in p.findall(".//w:t", ns) if t.text)
                if p_text:
                    paragraphs.append(p_text)
                p_style = p.find(".//w:pPr/w:pStyle", ns)
                if p_style is not None and "Heading" in p_style.attrib.get(f"{{{ns['w']}}}val", ""):
                    headings.append(p_text)

            if expected_headings:
                for exp in expected_headings:
                    if not any(exp.lower() in h.lower() for h in headings):
                        return {
                            "verified": False,
                            "error": f"Expected heading '{exp}' was not found in document."
                        }

            with open(abs_path, "rb") as f:
                sha256 = hashlib.sha256(f.read()).hexdigest()

            return {
                "verified": True,
                "file_path": abs_path,
                "size_bytes": size,
                "sha256": sha256,
                "headings_count": len(headings),
                "headings": headings,
                "paragraphs_count": len(paragraphs),
                "tables_count": tables_count,
                "summary": f"Valid OpenXML document with {len(headings)} headings and {tables_count} tables."
            }
    except Exception as e:
        return {"verified": False, "error": f"DOCX parsing exception: {str(e)}"}

