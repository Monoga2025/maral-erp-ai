#!/usr/bin/env python3
"""Render the Markdown source of John's MARAL OS guide to a styled PDF."""

from __future__ import annotations

import argparse
import re
from pathlib import Path
from xml.sax.saxutils import escape

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (
    BaseDocTemplate,
    Frame,
    KeepTogether,
    PageTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
)

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_INPUT = ROOT / "docs/USER_GUIDES/MARAL_OS_John.md"
DEFAULT_OUTPUT = ROOT / "docs/USER_GUIDES/MARAL_OS_Guia_John.pdf"
NAVY = colors.HexColor("#17365D")
BLUE = colors.HexColor("#2167A5")
GOLD = colors.HexColor("#D5A33A")
INK = colors.HexColor("#243247")
MUTED = colors.HexColor("#607187")
PALE_BLUE = colors.HexColor("#EEF5FB")
PALE_GOLD = colors.HexColor("#FFF7E5")


def register_fonts() -> tuple[str, str]:
    candidates = [
        (Path("C:/Windows/Fonts/arial.ttf"), Path("C:/Windows/Fonts/arialbd.ttf")),
        (Path("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"), Path("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf")),
        (Path("/usr/share/fonts/truetype/liberation2/LiberationSans-Regular.ttf"), Path("/usr/share/fonts/truetype/liberation2/LiberationSans-Bold.ttf")),
    ]
    for regular, bold in candidates:
        if regular.is_file() and bold.is_file():
            pdfmetrics.registerFont(TTFont("GuideSans", str(regular)))
            pdfmetrics.registerFont(TTFont("GuideSans-Bold", str(bold)))
            return "GuideSans", "GuideSans-Bold"
    raise RuntimeError("No supported Arial, DejaVu Sans, or Liberation Sans fonts were found")


def inline_markup(text: str) -> str:
    text = escape(text, {'"': '&quot;'})
    links: list[str] = []

    def save_link(match: re.Match[str]) -> str:
        label, url = match.group(1), match.group(2)
        token = f"LINKTOKEN{len(links)}TOKEN"
        links.append(f'<link href="{escape(url, {chr(34): "&quot;"})}" color="#2167A5"><u>{label}</u></link>')
        return token

    text = re.sub(r"\[([^\]]+)\]\((https?://[^)]+)\)", save_link, text)
    text = re.sub(r"\*\*(.+?)\*\*", r"<b>\1</b>", text)
    text = re.sub(r"`([^`]+)`", r'<font name="GuideSans-Bold">\1</font>', text)
    for index, link in enumerate(links):
        text = text.replace(f"LINKTOKEN{index}TOKEN", link)
    return text


def styles(regular: str, bold: str) -> dict[str, ParagraphStyle]:
    base = getSampleStyleSheet()["BodyText"]
    return {
        "title": ParagraphStyle("GuideTitle", parent=base, fontName=bold, fontSize=25, leading=31, textColor=NAVY, spaceAfter=12, alignment=TA_LEFT),
        "subtitle": ParagraphStyle("GuideSubtitle", parent=base, fontName=regular, fontSize=12, leading=17, textColor=MUTED, spaceAfter=12),
        "h1": ParagraphStyle("GuideH1", parent=base, fontName=bold, fontSize=18, leading=23, textColor=NAVY, spaceBefore=10, spaceAfter=9, keepWithNext=True),
        "h2": ParagraphStyle("GuideH2", parent=base, fontName=bold, fontSize=13, leading=17, textColor=BLUE, spaceBefore=8, spaceAfter=5, keepWithNext=True),
        "body": ParagraphStyle("GuideBody", parent=base, fontName=regular, fontSize=10.5, leading=15, textColor=INK, spaceAfter=6, splitLongWords=1, allowWidows=0, allowOrphans=0),
        "bullet": ParagraphStyle("GuideBullet", parent=base, fontName=regular, fontSize=10.3, leading=14.8, textColor=INK, leftIndent=14, firstLineIndent=-9, spaceAfter=4, splitLongWords=1),
        "quote": ParagraphStyle("GuideQuote", parent=base, fontName=regular, fontSize=10.3, leading=14.8, textColor=NAVY, leftIndent=3, rightIndent=3, spaceAfter=0),
        "small": ParagraphStyle("GuideSmall", parent=base, fontName=regular, fontSize=8.2, leading=11, textColor=MUTED),
    }


def on_page(canvas, doc) -> None:
    canvas.saveState()
    width, height = letter
    canvas.setFillColor(NAVY)
    canvas.rect(0, height - 8, width, 8, fill=1, stroke=0)
    canvas.setFillColor(GOLD)
    canvas.rect(0, height - 11, width, 3, fill=1, stroke=0)
    canvas.setStrokeColor(colors.HexColor("#DCE4ED"))
    canvas.line(doc.leftMargin, 0.55 * inch, width - doc.rightMargin, 0.55 * inch)
    canvas.setFont("GuideSans-Bold", 8)
    canvas.setFillColor(NAVY)
    canvas.drawString(doc.leftMargin, 0.36 * inch, "MARAL OS  ·  GUÍA PRÁCTICA PARA JOHN")
    canvas.setFont("GuideSans", 8)
    canvas.setFillColor(MUTED)
    canvas.drawRightString(width - doc.rightMargin, 0.36 * inch, f"{doc.page}")
    canvas.restoreState()


def make_callout(text: str, style: ParagraphStyle, background: colors.Color, width: float) -> Table:
    table = Table([[Paragraph(inline_markup(text), style)]], colWidths=[width])
    table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), background),
        ("BOX", (0, 0), (-1, -1), 0.65, GOLD if background == PALE_GOLD else colors.HexColor("#C9DDED")),
        ("LINEBEFORE", (0, 0), (0, -1), 3, GOLD if background == PALE_GOLD else BLUE),
        ("LEFTPADDING", (0, 0), (-1, -1), 10),
        ("RIGHTPADDING", (0, 0), (-1, -1), 9),
        ("TOPPADDING", (0, 0), (-1, -1), 8),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
    ]))
    return table


def parse_markdown(source: str, style: dict[str, ParagraphStyle], content_width: float) -> list:
    lines = source.splitlines()
    flow: list = []
    index = 0
    first_title = True
    while index < len(lines):
        line = lines[index].strip()
        if not line:
            index += 1
            continue
        if line.startswith("> "):
            parts = []
            while index < len(lines) and lines[index].strip().startswith("> "):
                parts.append(lines[index].strip()[2:])
                index += 1
            flow.append(make_callout(" ".join(parts), style["body"], PALE_GOLD, content_width))
            flow.append(Spacer(1, 8))
            continue
        if line.startswith("# "):
            if first_title:
                flow.append(Paragraph(inline_markup(line[2:]), style["title"]))
                first_title = False
            else:
                flow.append(Paragraph(inline_markup(line[2:]), style["h1"]))
            index += 1
            continue
        if line.startswith("## "):
            flow.append(Paragraph(inline_markup(line[3:]), style["h1"]))
            index += 1
            continue
        if line.startswith("### "):
            flow.append(Paragraph(inline_markup(line[4:]), style["h2"]))
            index += 1
            continue
        if line.startswith("- [ ] "):
            flow.append(Paragraph("□  " + inline_markup(line[6:]), style["bullet"]))
            index += 1
            continue
        if line.startswith("- "):
            flow.append(Paragraph("•  " + inline_markup(line[2:]), style["bullet"]))
            index += 1
            continue
        if re.match(r"^\d+\. ", line):
            match = re.match(r"^(\d+)\. (.*)$", line)
            assert match
            flow.append(Paragraph(f'<font name="GuideSans-Bold" color="#2167A5">{match.group(1)}.</font>  {inline_markup(match.group(2))}', style["bullet"]))
            index += 1
            continue
        if line == "---":
            flow.append(Spacer(1, 4))
            index += 1
            continue
        flow.append(Paragraph(inline_markup(line), style["body"]))
        index += 1
    return flow


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate John's MARAL OS PDF guide from its Markdown source.")
    parser.add_argument("--input", type=Path, default=DEFAULT_INPUT, help=f"Markdown source (default: {DEFAULT_INPUT})")
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT, help=f"Generated PDF destination (default: {DEFAULT_OUTPUT})")
    args = parser.parse_args()

    regular, bold = register_fonts()
    source = args.input.read_text(encoding="utf-8")
    args.output.parent.mkdir(parents=True, exist_ok=True)
    doc = BaseDocTemplate(
        str(args.output), pagesize=letter,
        leftMargin=0.78 * inch, rightMargin=0.78 * inch,
        topMargin=0.76 * inch, bottomMargin=0.78 * inch,
        title="MARAL OS · Guía práctica para John",
        author="MARAL OS",
        subject="Guía operativa basada en la interfaz actual de MARAL OS",
    )
    frame = Frame(doc.leftMargin, doc.bottomMargin, doc.width, doc.height, id="guide")
    doc.addPageTemplates([PageTemplate(id="main", frames=[frame], onPage=on_page)])
    doc.build(parse_markdown(source, styles(regular, bold), doc.width))
    print(f"Generated {args.output} from {args.input}")


if __name__ == "__main__":
    main()
