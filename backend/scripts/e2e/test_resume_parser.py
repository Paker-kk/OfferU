from __future__ import annotations

import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from app.services.resume_parser import _normalize_extracted_text, _parse_pdf_sync  # noqa: E402


def test_normalizer_merges_visual_wraps() -> None:
    raw = (
        "\u5de5\u4f5c\u7ecf\u5386\n"
        "\u4e2d\u56fd\u7535\u4fe1\u80a1\u4efd\u6709\u9650\u516c\u53f8\u4f5b\u5c71\u5206\u516c\u53f8\n"
        "\u8d1f\u8d23\u516c\u53f8\u5e74\u4f1a\u9886\u5bfcAI\u89c6\u9891\u5ba3\u4f20\u7247\u9879\u76ee\n"
        "\u6280\u672f\u8d1f\u8d23\u4eba\n"
        "\u2022 \u603b\u7ed3AI\u89c6\u9891\u6280\u672f\u89c4\u8303\u6d41\u7a0b"
    )
    assert _normalize_extracted_text(raw) == (
        "\u5de5\u4f5c\u7ecf\u5386\n"
        "\u4e2d\u56fd\u7535\u4fe1\u80a1\u4efd\u6709\u9650\u516c\u53f8\u4f5b\u5c71\u5206\u516c\u53f8 "
        "\u8d1f\u8d23\u516c\u53f8\u5e74\u4f1a\u9886\u5bfcAI\u89c6\u9891\u5ba3\u4f20\u7247\u9879\u76ee "
        "\u6280\u672f\u8d1f\u8d23\u4eba\n"
        "\u2022 \u603b\u7ed3AI\u89c6\u9891\u6280\u672f\u89c4\u8303\u6d41\u7a0b"
    )


def test_pymupdf_pdf_extraction_keeps_text() -> None:
    import fitz

    doc = fitz.open()
    page = doc.new_page(width=595, height=842)
    page.insert_text((72, 72), "WORK EXPERIENCE", fontsize=14)
    page.insert_text((72, 102), "OfferU Technology", fontsize=11)
    page.insert_text((72, 126), "Owned AI resume parser improvement", fontsize=11)
    page.insert_text((72, 150), "Technical lead", fontsize=11)
    page.insert_text((72, 174), "- Kept explicit bullet items", fontsize=11)
    pdf_bytes = doc.tobytes()
    doc.close()

    text = _parse_pdf_sync(pdf_bytes)
    assert "WORK EXPERIENCE" in text
    assert "OfferU Technology" in text
    assert "Technical lead" in text


if __name__ == "__main__":
    test_normalizer_merges_visual_wraps()
    test_pymupdf_pdf_extraction_keeps_text()
    print("resume parser tests passed")
