"""
Semantic search endpoint — Phase 3 full implementation.
"""
import time
import logging
from fastapi import APIRouter, Request, HTTPException
from pydantic import BaseModel
from typing import Optional, List

logger = logging.getLogger(__name__)
router = APIRouter()


class SearchFilters(BaseModel):
    department: Optional[str] = None
    file_type: Optional[str] = None


class SearchRequest(BaseModel):
    query: str
    top_k: int = 10
    filters: Optional[SearchFilters] = None


class SearchResultItem(BaseModel):
    document_id: str
    chunk_text: str
    similarity_score: float
    chunk_index: int
    metadata: dict


class SearchResponse(BaseModel):
    results: List[SearchResultItem]
    total: int
    query_time_ms: float


@router.post("/", response_model=SearchResponse)
async def semantic_search(payload: SearchRequest, request: Request):
    """
    Embed the query and perform cosine similarity search over ChromaDB.
    """
    embedder = getattr(request.app.state, "embedder", None)
    chroma = getattr(request.app.state, "chroma", None)

    if not embedder or not embedder.is_ready():
        raise HTTPException(status_code=503, detail="Embedding model not ready")
    if not chroma or not chroma.is_ready():
        raise HTTPException(status_code=503, detail="ChromaDB not connected")

    if not payload.query.strip():
        raise HTTPException(status_code=400, detail="Query cannot be empty")

    start = time.perf_counter()

    # Build ChromaDB where filter (metadata filtering)
    where_filter = None
    if payload.filters:
        conditions = []
        if payload.filters.department:
            conditions.append({"department": {"$eq": payload.filters.department}})
        if payload.filters.file_type:
            conditions.append({"file_type": {"$eq": payload.filters.file_type}})
        if len(conditions) == 1:
            where_filter = conditions[0]
        elif len(conditions) > 1:
            where_filter = {"$and": conditions}

    # Embed the query
    query_embedding = embedder.encode_single(payload.query)

    # Query ChromaDB
    raw = chroma.query(
        query_embedding=query_embedding,
        n_results=payload.top_k,
        where=where_filter,
    )

    # Parse results
    results: List[SearchResultItem] = []
    if raw and raw.get("ids") and raw["ids"][0]:
        ids = raw["ids"][0]
        documents = raw.get("documents", [[]])[0]
        metadatas = raw.get("metadatas", [[]])[0]
        distances = raw.get("distances", [[]])[0]

        for i, chunk_id in enumerate(ids):
            meta = metadatas[i] if i < len(metadatas) else {}
            # ChromaDB cosine distance → similarity score (1 - distance)
            distance = distances[i] if i < len(distances) else 1.0
            similarity = round(1.0 - distance, 4)

            results.append(SearchResultItem(
                document_id=meta.get("document_id", ""),
                chunk_text=documents[i] if i < len(documents) else "",
                similarity_score=similarity,
                chunk_index=meta.get("chunk_index", 0),
                metadata=meta,
            ))

    elapsed_ms = round((time.perf_counter() - start) * 1000, 2)
    logger.info(
        f"Search '{payload.query[:60]}' → {len(results)} results in {elapsed_ms}ms"
    )

    return SearchResponse(
        results=results,
        total=len(results),
        query_time_ms=elapsed_ms,
    )
