"""
Text chunking service — Full implementation in Phase 3.
"""
import logging
from typing import List

logger = logging.getLogger(__name__)


class ChunkerService:
    """
    Recursive character text splitter.
    Splits on paragraphs, then sentences, then words to maintain semantic coherence.
    """

    def __init__(self, chunk_size: int = 500, chunk_overlap: int = 50):
        self.chunk_size = chunk_size
        self.chunk_overlap = chunk_overlap
        self._separators = ["\n\n", "\n", ". ", " ", ""]

    def split_text(self, text: str) -> List[str]:
        """Split text into overlapping chunks."""
        text = text.strip()
        if not text:
            return []

        chunks = self._recursive_split(text, self._separators)
        return [c for c in chunks if len(c.strip()) > 20]  # Filter tiny chunks

    def _recursive_split(self, text: str, separators: List[str]) -> List[str]:
        final_chunks: List[str] = []

        if len(text) <= self.chunk_size:
            return [text]

        separator = separators[-1]
        for sep in separators:
            if sep in text:
                separator = sep
                break

        parts = text.split(separator)
        current: List[str] = []
        current_len = 0

        for part in parts:
            part_len = len(part)

            if current_len + part_len + len(separator) > self.chunk_size and current:
                chunk = separator.join(current).strip()
                if chunk:
                    final_chunks.append(chunk)

                # Keep overlap
                overlap_parts: List[str] = []
                overlap_len = 0
                for p in reversed(current):
                    if overlap_len + len(p) < self.chunk_overlap:
                        overlap_parts.insert(0, p)
                        overlap_len += len(p)
                    else:
                        break
                current = overlap_parts
                current_len = overlap_len

            current.append(part)
            current_len += part_len + len(separator)

        if current:
            chunk = separator.join(current).strip()
            if chunk:
                final_chunks.append(chunk)

        return final_chunks
