"""
ChromaDB client service.
Full implementation will be completed in Phase 3.
"""
import logging
from typing import List, Dict, Any, Optional

logger = logging.getLogger(__name__)


class ChromaService:
    def __init__(self, host: str, port: int, collection_name: str):
        self.host = host
        self.port = port
        self.collection_name = collection_name
        self._client = None
        self._collection = None
        self._ready = False
        self._connect()

    def _connect(self):
        try:
            import chromadb
            self._client = chromadb.HttpClient(host=self.host, port=self.port)
            self._client.heartbeat()  # Verify connection
            self._collection = self._client.get_or_create_collection(
                name=self.collection_name,
                metadata={"hnsw:space": "cosine"},
            )
            self._ready = True
            logger.info(f"✅ ChromaDB connected: {self.host}:{self.port} / {self.collection_name}")
        except Exception as e:
            logger.error(f"❌ ChromaDB connection failed: {e}")
            self._ready = False

    def is_ready(self) -> bool:
        return self._ready

    def add_documents(
        self,
        ids: List[str],
        embeddings: List[List[float]],
        documents: List[str],
        metadatas: List[Dict[str, Any]],
        batch_size: int = 100,
    ) -> bool:
        """Add document chunks to ChromaDB in batches."""
        if not self._ready or self._collection is None:
            raise RuntimeError("ChromaDB not connected")
        try:
            for i in range(0, len(ids), batch_size):
                batch_end = i + batch_size
                self._collection.add(
                    ids=ids[i:batch_end],
                    embeddings=embeddings[i:batch_end],
                    documents=documents[i:batch_end],
                    metadatas=metadatas[i:batch_end],
                )
            return True
        except Exception as e:
            logger.error(f"ChromaDB add_documents failed: {e}")
            raise

    def query(
        self,
        query_embedding: List[float],
        n_results: int = 10,
        where: Optional[Dict] = None,
    ) -> Dict[str, Any]:
        """Query for similar chunks."""
        if not self._ready or self._collection is None:
            raise RuntimeError("ChromaDB not connected")

        kwargs: Dict[str, Any] = {
            "query_embeddings": [query_embedding],
            "n_results": n_results,
            "include": ["documents", "metadatas", "distances"],
        }
        if where:
            kwargs["where"] = where

        return self._collection.query(**kwargs)

    def delete_document(self, document_id: str) -> bool:
        """Remove all chunks for a given document_id."""
        if not self._ready or self._collection is None:
            raise RuntimeError("ChromaDB not connected")
        try:
            self._collection.delete(where={"document_id": document_id})
            return True
        except Exception as e:
            logger.error(f"ChromaDB delete failed: {e}")
            raise
