from fastapi import APIRouter, Request
from pydantic import BaseModel

router = APIRouter()


class HealthResponse(BaseModel):
    status: str
    service: str
    model_loaded: bool
    chroma_connected: bool


@router.get("/health", response_model=HealthResponse)
async def health_check(request: Request):
    embedder = getattr(request.app.state, "embedder", None)
    chroma = getattr(request.app.state, "chroma", None)

    model_loaded = embedder is not None and embedder.is_ready()
    chroma_ok = chroma is not None and chroma.is_ready()

    return HealthResponse(
        status="healthy" if (model_loaded and chroma_ok) else "degraded",
        service="kms-python-microservice",
        model_loaded=model_loaded,
        chroma_connected=chroma_ok,
    )
