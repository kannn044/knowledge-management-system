"""
Document processing pipeline orchestrator.

Flow:
  1. Extract text (OCR or direct parse based on file type)
  2. Write extracted.txt alongside original file (for Node.js content endpoint)
  3. Chunk the text into overlapping segments
  4. Generate embeddings for each chunk
  5. Store embeddings + metadata in ChromaDB
  6. Notify Node.js backend via HTTP callback
"""
import logging
import time
from pathlib import Path
from typing import Optional
import httpx

from app.services.ocr import OcrService
from app.services.chunker import ChunkerService
from app.services.embedder import EmbedderService
from app.services.chroma import ChromaService
from app.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()


def run_pipeline(
    document_id: str,
    file_path: str,
    file_type: str,
    title: str,
    metadata: dict,
    embedder: EmbedderService,
    chroma: ChromaService,
) -> dict:
    """
    Run the full OCR → chunk → embed → store pipeline (synchronous).
    All operations (OCR, embedding, ChromaDB) are CPU-bound/synchronous.
    Returns a result dict that is sent to the Node.js callback.
    """
    start_time = time.time()
    ocr = OcrService()
    chunker = ChunkerService(
        chunk_size=settings.chunk_size,
        chunk_overlap=settings.chunk_overlap,
    )

    try:
        # ── Step 1: Extract text ──────────────────────────────────
        logger.info(f"[{document_id}] Extracting text from {file_type} file: {file_path}")
        text = ocr.extract_text(file_path, file_type)

        if not text.strip():
            raise ValueError("No text could be extracted from the document")

        # ── Step 2: Write extracted text to disk ──────────────────
        extracted_path = Path(file_path).parent / "extracted.txt"
        extracted_path.write_text(text, encoding="utf-8")
        logger.info(f"[{document_id}] Extracted {len(text)} chars → {extracted_path}")

        # ── Step 3: Chunk text ────────────────────────────────────
        chunks = chunker.split_text(text)
        if not chunks:
            raise ValueError("No chunks were generated from extracted text")
        logger.info(f"[{document_id}] Generated {len(chunks)} chunks")

        # ── Step 4: Generate embeddings ───────────────────────────
        logger.info(f"[{document_id}] Generating embeddings for {len(chunks)} chunks")
        embeddings = embedder.encode(chunks)

        # ── Step 5: Build ChromaDB records ────────────────────────
        chunk_ids = [f"{document_id}_chunk_{i}" for i in range(len(chunks))]
        chunk_metadatas = [
            {
                "document_id": document_id,
                "chunk_index": i,
                "file_name": Path(file_path).name,
                "title": title,
                "file_type": file_type,
                "uploaded_by": metadata.get("uploaded_by", ""),
                "department": metadata.get("department") or "",
            }
            for i in range(len(chunks))
        ]

        # ── Step 6: Store in ChromaDB ─────────────────────────────
        logger.info(f"[{document_id}] Storing {len(chunks)} chunks in ChromaDB")
        chroma.add_documents(
            ids=chunk_ids,
            embeddings=embeddings,
            documents=chunks,
            metadatas=chunk_metadatas,
        )

        elapsed = round((time.time() - start_time) * 1000)
        logger.info(f"[{document_id}] Pipeline complete in {elapsed}ms — {len(chunks)} chunks")

        return {
            "status": "ready",
            "chunk_count": len(chunks),
            "chroma_collection": settings.chroma_collection,
        }

    except Exception as e:
        logger.error(f"[{document_id}] Pipeline failed: {e}", exc_info=True)
        return {
            "status": "failed",
            "chunk_count": 0,
            "error_message": str(e),
        }


async def notify_callback(document_id: str, result: dict) -> None:
    """POST result back to Node.js internal callback endpoint."""
    payload = {
        "document_id": document_id,
        **result,
    }
    try:
        import os
        internal_secret = os.environ.get("INTERNAL_API_SECRET", "internal_secret_change_me")
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.post(
                settings.node_callback_url,
                json=payload,
                headers={"x-internal-secret": internal_secret},
            )
            resp.raise_for_status()
            logger.info(f"[{document_id}] Callback sent successfully (status={resp.status_code})")
    except Exception as e:
        logger.error(f"[{document_id}] Failed to send callback: {e}")
