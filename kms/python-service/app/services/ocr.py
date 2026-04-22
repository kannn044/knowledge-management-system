"""
OCR & text extraction service — Full implementation in Phase 3.
"""
import logging
import os
from pathlib import Path
from typing import Optional

logger = logging.getLogger(__name__)


class OcrService:
    """
    Extracts text from .txt, .md, and .pdf files.
    For PDFs: tries direct extraction first, falls back to Tesseract OCR.
    """

    def extract_text(self, file_path: str, file_type: str) -> str:
        """Extract text based on file type."""
        path = Path(file_path)
        if not path.exists():
            raise FileNotFoundError(f"File not found: {file_path}")

        if file_type == "txt":
            return self._read_text_file(path)
        elif file_type == "md":
            return self._read_markdown_file(path)
        elif file_type == "pdf":
            return self._extract_pdf(path)
        else:
            raise ValueError(f"Unsupported file type: {file_type}")

    def _read_text_file(self, path: Path) -> str:
        return path.read_text(encoding="utf-8", errors="ignore")

    def _read_markdown_file(self, path: Path) -> str:
        # Return raw markdown — embeddings work well on it
        return path.read_text(encoding="utf-8", errors="ignore")

    def _extract_pdf(self, path: Path) -> str:
        """Try PyPDF2 direct extraction; fallback to Tesseract OCR."""
        text = self._pypdf_extract(path)

        # Heuristic: if extracted text is suspiciously short, use OCR
        if len(text.strip()) < 100:
            logger.info(f"Direct PDF extraction insufficient — using OCR for {path.name}")
            text = self._tesseract_extract(path)

        return text

    def _pypdf_extract(self, path: Path) -> str:
        try:
            import PyPDF2
            text_parts = []
            with open(path, "rb") as f:
                reader = PyPDF2.PdfReader(f)
                for page in reader.pages:
                    page_text = page.extract_text() or ""
                    text_parts.append(page_text)
            return "\n\n".join(text_parts)
        except Exception as e:
            logger.warning(f"PyPDF2 extraction failed: {e}")
            return ""

    def _tesseract_extract(self, path: Path) -> str:
        try:
            import pytesseract
            from pdf2image import convert_from_path
            from PIL import Image

            pages = convert_from_path(str(path), dpi=300, grayscale=True)
            text_parts = []
            for i, page in enumerate(pages):
                logger.debug(f"OCR page {i + 1}/{len(pages)}")
                page_text = pytesseract.image_to_string(page, lang="eng")
                text_parts.append(page_text)
            return "\n\n".join(text_parts)
        except Exception as e:
            logger.error(f"Tesseract OCR failed: {e}")
            raise
