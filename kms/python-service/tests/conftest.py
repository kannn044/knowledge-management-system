"""
Pytest configuration and shared fixtures for the KMS Python microservice tests.
"""
import os
import pytest
from unittest.mock import MagicMock

# ─── Override env vars before any app imports ──────────────────────────────────
os.environ.setdefault("CHROMA_HOST", "localhost")
os.environ.setdefault("CHROMA_PORT", "8000")
os.environ.setdefault("NODE_CALLBACK_URL", "http://localhost:3001/api/internal/callback")
os.environ.setdefault("INTERNAL_API_SECRET", "test_secret_32_chars_minimum_ok!!")
os.environ.setdefault("EMBEDDING_MODEL", "all-MiniLM-L6-v2")
os.environ.setdefault("EMBEDDING_DEVICE", "cpu")
os.environ.setdefault("CHUNK_SIZE", "500")
os.environ.setdefault("CHUNK_OVERLAP", "50")


@pytest.fixture
def mock_embedder():
    """A mock EmbedderService that returns fake 384-dim embeddings."""
    embedder = MagicMock()
    embedder.is_ready.return_value = True
    embedder.dimension = 384
    embedder.encode.side_effect = lambda texts: [[0.1] * 384 for _ in texts]
    embedder.encode_single.side_effect = lambda text: [0.1] * 384
    return embedder


@pytest.fixture
def mock_chroma():
    """A mock ChromaService that accepts writes and returns fake query results."""
    chroma = MagicMock()
    chroma.is_ready.return_value = True
    chroma.add_documents.return_value = True
    chroma.delete_document.return_value = True
    chroma.query.return_value = {
        "ids": [["doc1_chunk_0", "doc1_chunk_1"]],
        "documents": [["Sample text chunk one.", "Sample text chunk two."]],
        "metadatas": [
            [
                {"document_id": "doc-uuid-1", "chunk_index": 0, "file_type": "txt", "department": "IT"},
                {"document_id": "doc-uuid-1", "chunk_index": 1, "file_type": "txt", "department": "IT"},
            ]
        ],
        "distances": [[0.05, 0.15]],
    }
    return chroma


@pytest.fixture
def tmp_txt_file(tmp_path):
    """Creates a temporary plain text file for OCR/pipeline tests."""
    content = (
        "Knowledge Management System Test Document\n\n"
        "This document contains several paragraphs of text.\n"
        "It is used to verify that the text extraction and chunking pipeline works correctly.\n\n"
        "Section 2: Additional Content\n"
        "The quick brown fox jumps over the lazy dog.\n"
        "Pack my box with five dozen liquor jugs.\n"
    )
    f = tmp_path / "test_document.txt"
    f.write_text(content, encoding="utf-8")
    return str(f)


@pytest.fixture
def tmp_md_file(tmp_path):
    """Creates a temporary Markdown file for OCR/pipeline tests."""
    content = (
        "# KMS Test Document\n\n"
        "## Introduction\n\n"
        "This is a **markdown** document used for testing.\n\n"
        "## Section 2\n\n"
        "- Item one\n"
        "- Item two\n"
        "- Item three\n\n"
        "The system should extract this text correctly.\n"
    )
    f = tmp_path / "test_document.md"
    f.write_text(content, encoding="utf-8")
    return str(f)
