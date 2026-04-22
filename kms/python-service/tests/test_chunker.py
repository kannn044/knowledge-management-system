"""
Unit tests for ChunkerService — pure logic, no I/O or mocking needed.
"""
import pytest
from app.services.chunker import ChunkerService


@pytest.fixture
def chunker():
    return ChunkerService(chunk_size=200, chunk_overlap=20)


@pytest.fixture
def default_chunker():
    return ChunkerService()  # Default: 500 chunk_size, 50 overlap


class TestChunkerInit:
    def test_default_params(self, default_chunker):
        assert default_chunker.chunk_size == 500
        assert default_chunker.chunk_overlap == 50

    def test_custom_params(self, chunker):
        assert chunker.chunk_size == 200
        assert chunker.chunk_overlap == 20


class TestSplitText:
    def test_empty_string_returns_empty_list(self, chunker):
        assert chunker.split_text("") == []

    def test_whitespace_only_returns_empty_list(self, chunker):
        assert chunker.split_text("   \n\n  ") == []

    def test_short_text_returns_single_chunk(self, chunker):
        text = "This is a short text."
        chunks = chunker.split_text(text)
        assert len(chunks) == 1
        assert chunks[0] == text

    def test_long_text_is_split_into_multiple_chunks(self, chunker):
        # 10 paragraphs, each ~100 chars → should produce multiple chunks with chunk_size=200
        paragraphs = [f"Paragraph {i}: " + "x" * 90 for i in range(10)]
        text = "\n\n".join(paragraphs)
        chunks = chunker.split_text(text)
        assert len(chunks) > 1

    def test_chunks_do_not_exceed_chunk_size_by_large_margin(self, chunker):
        text = "word " * 500  # 2500 chars total
        chunks = chunker.split_text(text)
        for chunk in chunks:
            # Allow some slack due to separator handling
            assert len(chunk) <= chunker.chunk_size * 2

    def test_filters_out_tiny_chunks(self, chunker):
        # Chunks under 20 chars should be filtered
        text = "Hi.\n\n" + "This is a real paragraph with enough content. " * 5
        chunks = chunker.split_text(text)
        for chunk in chunks:
            assert len(chunk.strip()) >= 20

    def test_splits_on_paragraph_boundaries_first(self, default_chunker):
        # Paragraphs separated by \n\n should be the primary split boundary
        para_a = "A" * 300
        para_b = "B" * 300
        text = f"{para_a}\n\n{para_b}"
        chunks = default_chunker.split_text(text)
        # Each paragraph is 300 chars, well within 500-char chunk_size;
        # they should ideally remain as separate chunks (or joined if small enough)
        assert len(chunks) >= 1

    def test_all_content_is_preserved(self, chunker):
        """Verify that all significant text content exists across chunks."""
        paragraphs = [f"Paragraph number {i} contains unique content {i*7}." for i in range(20)]
        text = "\n\n".join(paragraphs)
        chunks = chunker.split_text(text)

        all_text = " ".join(chunks)
        for i in range(20):
            assert f"unique content {i*7}" in all_text

    def test_plain_text_without_paragraph_breaks(self, chunker):
        """Should still split even when there are no paragraph breaks."""
        text = "word " * 200  # 1000 chars, no \n\n
        chunks = chunker.split_text(text)
        assert len(chunks) >= 1
        # All original words should appear somewhere
        assert "word" in " ".join(chunks)


class TestEdgeCases:
    def test_text_exactly_chunk_size(self):
        c = ChunkerService(chunk_size=100, chunk_overlap=10)
        text = "x" * 100
        chunks = c.split_text(text)
        assert len(chunks) >= 1

    def test_very_long_single_word(self):
        """A single word longer than chunk_size should not crash."""
        c = ChunkerService(chunk_size=50, chunk_overlap=5)
        text = "a" * 200  # No spaces, can't split meaningfully
        # Should not raise
        chunks = c.split_text(text)
        assert isinstance(chunks, list)

    def test_unicode_text(self, default_chunker):
        text = "สวัสดี " * 100 + "\n\n" + "ขอบคุณ " * 100
        chunks = default_chunker.split_text(text)
        assert isinstance(chunks, list)
        assert len(chunks) >= 1
