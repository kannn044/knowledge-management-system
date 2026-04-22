"""
Embedding service using sentence-transformers.
Full implementation will be completed in Phase 3.
"""
import logging
from typing import List

logger = logging.getLogger(__name__)


class EmbedderService:
    def __init__(self, model_name: str = "all-MiniLM-L6-v2", device: str = "cpu"):
        self.model_name = model_name
        self.device = device
        self._model = None
        self._ready = False
        self._load_model()

    def _load_model(self):
        try:
            from sentence_transformers import SentenceTransformer
            self._model = SentenceTransformer(self.model_name, device=self.device)
            self._ready = True
            logger.info(f"✅ Sentence-Transformer loaded: {self.model_name}")
        except Exception as e:
            logger.error(f"❌ Failed to load embedding model: {e}")
            self._ready = False

    def is_ready(self) -> bool:
        return self._ready

    def encode(self, texts: List[str] | str) -> List[List[float]]:
        """Encode text(s) to embeddings."""
        if not self._ready or self._model is None:
            raise RuntimeError("Embedding model not loaded")

        if isinstance(texts, str):
            texts = [texts]

        embeddings = self._model.encode(texts, convert_to_numpy=True)
        return embeddings.tolist()

    def encode_single(self, text: str) -> List[float]:
        """Encode a single string to an embedding vector."""
        return self.encode([text])[0]

    @property
    def dimension(self) -> int:
        """Return embedding dimension (384 for MiniLM-L6-v2)."""
        return 384
