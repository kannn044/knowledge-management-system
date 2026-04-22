"""
Unit tests for the document processing pipeline orchestrator.
All external services (embedder, chroma) are mocked via fixtures in conftest.py.
"""
import pytest
import asyncio
from pathlib import Path
from unittest.mock import patch, AsyncMock

from app.services.pipeline import run_pipeline, notify_callback


class TestRunPipeline:
    def test_successful_pipeline_returns_ready_status(
        self, tmp_txt_file, mock_embedder, mock_chroma
    ):
        result = run_pipeline(
            document_id="doc-test-001",
            file_path=tmp_txt_file,
            file_type="txt",
            title="Test Document",
            metadata={"uploaded_by": "user-uuid-1", "department": "IT"},
            embedder=mock_embedder,
            chroma=mock_chroma,
        )
        assert result["status"] == "ready"
        assert result["chunk_count"] > 0
        assert "chroma_collection" in result

    def test_pipeline_calls_embedder_with_chunks(
        self, tmp_txt_file, mock_embedder, mock_chroma
    ):
        run_pipeline(
            document_id="doc-test-002",
            file_path=tmp_txt_file,
            file_type="txt",
            title="Test",
            metadata={"uploaded_by": "user-1"},
            embedder=mock_embedder,
            chroma=mock_chroma,
        )
        mock_embedder.encode.assert_called_once()
        encoded_texts = mock_embedder.encode.call_args[0][0]
        assert isinstance(encoded_texts, list)
        assert len(encoded_texts) > 0

    def test_pipeline_calls_chroma_add_documents(
        self, tmp_txt_file, mock_embedder, mock_chroma
    ):
        run_pipeline(
            document_id="doc-test-003",
            file_path=tmp_txt_file,
            file_type="txt",
            title="Test",
            metadata={"uploaded_by": "user-1"},
            embedder=mock_embedder,
            chroma=mock_chroma,
        )
        mock_chroma.add_documents.assert_called_once()
        call_kwargs = mock_chroma.add_documents.call_args
        # Verify chunk IDs follow expected naming pattern
        ids = call_kwargs[1]["ids"] if call_kwargs[1] else call_kwargs[0][0]
        assert all("doc-test-003" in cid for cid in ids)

    def test_pipeline_writes_extracted_txt_to_disk(
        self, tmp_txt_file, mock_embedder, mock_chroma
    ):
        run_pipeline(
            document_id="doc-test-004",
            file_path=tmp_txt_file,
            file_type="txt",
            title="Test",
            metadata={"uploaded_by": "user-1"},
            embedder=mock_embedder,
            chroma=mock_chroma,
        )
        extracted = Path(tmp_txt_file).parent / "extracted.txt"
        assert extracted.exists()
        assert extracted.stat().st_size > 0

    def test_pipeline_returns_failed_status_for_missing_file(
        self, mock_embedder, mock_chroma
    ):
        result = run_pipeline(
            document_id="doc-test-005",
            file_path="/nonexistent/file.txt",
            file_type="txt",
            title="Missing",
            metadata={"uploaded_by": "user-1"},
            embedder=mock_embedder,
            chroma=mock_chroma,
        )
        assert result["status"] == "failed"
        assert result["chunk_count"] == 0
        assert "error_message" in result

    def test_pipeline_works_with_markdown_file(
        self, tmp_md_file, mock_embedder, mock_chroma
    ):
        result = run_pipeline(
            document_id="doc-test-006",
            file_path=tmp_md_file,
            file_type="md",
            title="Markdown Doc",
            metadata={"uploaded_by": "user-1", "department": "HR"},
            embedder=mock_embedder,
            chroma=mock_chroma,
        )
        assert result["status"] == "ready"
        assert result["chunk_count"] > 0

    def test_pipeline_metadata_stored_in_chunks(
        self, tmp_txt_file, mock_embedder, mock_chroma
    ):
        """Verify chunk metadata includes document_id, file_type, department."""
        run_pipeline(
            document_id="doc-meta-test",
            file_path=tmp_txt_file,
            file_type="txt",
            title="Meta Test",
            metadata={"uploaded_by": "user-uuid-99", "department": "Finance"},
            embedder=mock_embedder,
            chroma=mock_chroma,
        )
        call_kwargs = mock_chroma.add_documents.call_args
        metadatas = call_kwargs[1].get("metadatas") or call_kwargs[0][3]

        for meta in metadatas:
            assert meta["document_id"] == "doc-meta-test"
            assert meta["file_type"] == "txt"
            assert meta["department"] == "Finance"
            assert meta["uploaded_by"] == "user-uuid-99"

    def test_pipeline_fails_gracefully_when_chroma_raises(
        self, tmp_txt_file, mock_embedder, mock_chroma
    ):
        mock_chroma.add_documents.side_effect = RuntimeError("ChromaDB unavailable")

        result = run_pipeline(
            document_id="doc-chroma-fail",
            file_path=tmp_txt_file,
            file_type="txt",
            title="Test",
            metadata={"uploaded_by": "user-1"},
            embedder=mock_embedder,
            chroma=mock_chroma,
        )
        assert result["status"] == "failed"
        assert "ChromaDB unavailable" in result["error_message"]


class TestNotifyCallback:
    @pytest.mark.asyncio
    async def test_sends_post_request_to_callback_url(self):
        result = {"status": "ready", "chunk_count": 5, "chroma_collection": "kms_documents"}

        with patch("app.services.pipeline.httpx.AsyncClient") as mock_client_cls:
            mock_client = AsyncMock()
            mock_client_cls.return_value.__aenter__.return_value = mock_client
            mock_resp = AsyncMock()
            mock_resp.raise_for_status = AsyncMock()
            mock_resp.status_code = 200
            mock_client.post.return_value = mock_resp

            await notify_callback("doc-callback-001", result)

            mock_client.post.assert_called_once()
            call_args = mock_client.post.call_args
            payload = call_args[1]["json"]
            assert payload["document_id"] == "doc-callback-001"
            assert payload["status"] == "ready"
            assert payload["chunk_count"] == 5

    @pytest.mark.asyncio
    async def test_does_not_raise_when_callback_fails(self):
        """Pipeline notification failure should be logged but not propagate."""
        with patch("app.services.pipeline.httpx.AsyncClient") as mock_client_cls:
            mock_client = AsyncMock()
            mock_client_cls.return_value.__aenter__.return_value = mock_client
            mock_client.post.side_effect = Exception("Network error")

            # Should not raise
            await notify_callback("doc-fail-callback", {"status": "ready", "chunk_count": 0})
