"""
Document processing endpoint — full Phase 3 implementation.
Accepts a document, runs OCR → chunk → embed → ChromaDB pipeline,
then POSTs result back to Node.js callback.
"""
import asyncio
import logging
from fastapi import APIRouter, Request, BackgroundTasks, HTTPException
from pydantic import BaseModel
from typing import Optional

from app.services.pipeline import run_pipeline, notify_callback

logger = logging.getLogger(__name__)
router = APIRouter()


class ProcessMetadata(BaseModel):
    uploaded_by: str
    department: Optional[str] = None


class ProcessRequest(BaseModel):
    document_id: str
    file_path: str
    file_type: str  # 'txt' | 'md' | 'pdf'
    title: str
    metadata: ProcessMetadata


class ProcessResponse(BaseModel):
    accepted: bool
    document_id: str
    message: str


async def _process_and_callback(
    document_id: str,
    file_path: str,
    file_type: str,
    title: str,
    metadata: dict,
    embedder,
    chroma,
) -> None:
    """
    Background task: run full pipeline in a thread pool (CPU-bound),
    then notify Node.js via HTTP callback.
    """
    result = await asyncio.to_thread(
        run_pipeline,
        document_id, file_path, file_type, title, metadata, embedder, chroma
    )
    await notify_callback(document_id, result)


@router.post("/", response_model=ProcessResponse)
async def process_document(
    payload: ProcessRequest,
    background_tasks: BackgroundTasks,
    request: Request,
):
    """
    Accept a document for processing.
    Returns immediately with accepted=True; processing runs in the background.
    """
    embedder = getattr(request.app.state, "embedder", None)
    chroma = getattr(request.app.state, "chroma", None)

    if not embedder or not embedder.is_ready():
        raise HTTPException(status_code=503, detail="Embedding model not ready")
    if not chroma or not chroma.is_ready():
        raise HTTPException(status_code=503, detail="ChromaDB not connected")

    logger.info(f"Accepted processing request for document: {payload.document_id}")

    background_tasks.add_task(
        _process_and_callback,
        payload.document_id,
        payload.file_path,
        payload.file_type,
        payload.title,
        payload.metadata.dict(),
        embedder,
        chroma,
    )

    return ProcessResponse(
        accepted=True,
        document_id=payload.document_id,
        message="Document accepted for processing",
    )


@router.delete("/{document_id}")
async def delete_document_vectors(document_id: str, request: Request):
    """Remove all ChromaDB chunks for a document."""
    chroma = getattr(request.app.state, "chroma", None)
    if not chroma or not chroma.is_ready():
        raise HTTPException(status_code=503, detail="ChromaDB not connected")

    try:
        chroma.delete_document(document_id)
        logger.info(f"Deleted ChromaDB vectors for document: {document_id}")
        return {"success": True, "document_id": document_id}
    except Exception as e:
        logger.error(f"Failed to delete vectors for {document_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))
