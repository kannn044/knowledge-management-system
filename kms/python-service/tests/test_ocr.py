"""
Unit tests for OcrService — tests text extraction from .txt and .md files.
PDF OCR tests mock pytesseract to avoid requiring a Tesseract installation in CI.
"""
import pytest
from unittest.mock import patch, MagicMock
from app.services.ocr import OcrService


@pytest.fixture
def ocr():
    return OcrService()


class TestTextFileExtraction:
    def test_extracts_txt_content(self, ocr, tmp_txt_file):
        text = ocr.extract_text(tmp_txt_file, "txt")
        assert "Knowledge Management System" in text
        assert len(text) > 50

    def test_extracts_md_content(self, ocr, tmp_md_file):
        text = ocr.extract_text(tmp_md_file, "md")
        assert "KMS Test Document" in text
        assert len(text) > 50

    def test_raises_for_missing_file(self, ocr):
        with pytest.raises(FileNotFoundError):
            ocr.extract_text("/nonexistent/path/file.txt", "txt")

    def test_raises_for_unsupported_type(self, ocr, tmp_txt_file):
        with pytest.raises(ValueError, match="Unsupported file type"):
            ocr.extract_text(tmp_txt_file, "docx")

    def test_txt_handles_unicode(self, tmp_path, ocr):
        f = tmp_path / "unicode.txt"
        f.write_text("สวัสดี\nBonjour\n日本語テスト\n", encoding="utf-8")
        text = ocr.extract_text(str(f), "txt")
        assert "สวัสดี" in text
        assert "Bonjour" in text

    def test_txt_handles_empty_file(self, tmp_path, ocr):
        f = tmp_path / "empty.txt"
        f.write_text("", encoding="utf-8")
        text = ocr.extract_text(str(f), "txt")
        assert text == ""


class TestPdfDirectExtraction:
    def test_pdf_uses_pypdf2_first(self, tmp_path, ocr):
        """Verify PyPDF2 is attempted before falling back to Tesseract."""
        dummy_pdf = tmp_path / "test.pdf"
        dummy_pdf.write_bytes(b"%PDF-1.4 fake pdf content")

        with patch.object(ocr, "_pypdf_extract", return_value="Extracted PDF text") as mock_pypdf:
            text = ocr.extract_text(str(dummy_pdf), "pdf")
            mock_pypdf.assert_called_once()
            assert text == "Extracted PDF text"

    def test_pdf_falls_back_to_ocr_when_text_is_short(self, tmp_path, ocr):
        """If PyPDF2 returns < 100 chars, Tesseract OCR should be triggered."""
        dummy_pdf = tmp_path / "scanned.pdf"
        dummy_pdf.write_bytes(b"%PDF-1.4 fake")

        with patch.object(ocr, "_pypdf_extract", return_value="short"), \
             patch.object(ocr, "_tesseract_extract", return_value="Full OCR text from scanned document") as mock_ocr:
            text = ocr.extract_text(str(dummy_pdf), "pdf")
            mock_ocr.assert_called_once()
            assert "Full OCR text" in text

    def test_pdf_does_not_use_ocr_when_direct_extraction_succeeds(self, tmp_path, ocr):
        """If PyPDF2 returns sufficient text, Tesseract should NOT be called."""
        dummy_pdf = tmp_path / "digital.pdf"
        dummy_pdf.write_bytes(b"%PDF-1.4 fake")
        good_text = "This is well-extracted PDF content. " * 10  # > 100 chars

        with patch.object(ocr, "_pypdf_extract", return_value=good_text), \
             patch.object(ocr, "_tesseract_extract") as mock_ocr:
            ocr.extract_text(str(dummy_pdf), "pdf")
            mock_ocr.assert_not_called()


class TestTesseractExtraction:
    def test_tesseract_extract_uses_pdf2image_and_pytesseract(self, tmp_path, ocr):
        """Verify the OCR path calls pdf2image and pytesseract correctly."""
        dummy_pdf = tmp_path / "ocr_test.pdf"
        dummy_pdf.write_bytes(b"%PDF-1.4 fake")

        fake_image = MagicMock()
        with patch("app.services.ocr.convert_from_path", return_value=[fake_image]) as mock_convert, \
             patch("app.services.ocr.pytesseract") as mock_tesseract:
            mock_tesseract.image_to_string.return_value = "OCR extracted page text"

            # Need to import inside patch context
            from app.services.ocr import OcrService as _Ocr
            _ocr = _Ocr()
            from pathlib import Path
            text = _ocr._tesseract_extract(Path(str(dummy_pdf)))

            mock_convert.assert_called_once_with(str(dummy_pdf), dpi=300, grayscale=True)
            mock_tesseract.image_to_string.assert_called_once_with(fake_image, lang="eng")
            assert "OCR extracted page text" in text
