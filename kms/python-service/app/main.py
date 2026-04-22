from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import logging

from app.config import get_settings
from app.routers import process, search, health
from app.services.embedder import EmbedderService
from app.services.chroma import ChromaService

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)
settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initialize heavy services on startup."""
    logger.info("🚀 Starting KMS Python Microservice...")

    # Pre-load embedding model (avoids cold start on first request)
    logger.info(f"Loading embedding model: {settings.embedding_model}")
    app.state.embedder = EmbedderService(
        model_name=settings.embedding_model,
        device=settings.embedding_device,
    )
    logger.info("✅ Embedding model loaded")

    # Connect to ChromaDB
    app.state.chroma = ChromaService(
        host=settings.chroma_host,
        port=settings.chroma_port,
        collection_name=settings.chroma_collection,
    )
    logger.info("✅ ChromaDB connected")

    yield

    logger.info("Shutting down KMS Python Microservice...")


app = FastAPI(
    title=settings.app_name,
    version="1.0.0",
    description="OCR, embedding generation, and semantic search microservice for KMS",
    lifespan=lifespan,
)

# CORS (internal service — restrict in production)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routers
app.include_router(health.router, tags=["Health"])
app.include_router(process.router, prefix="/process", tags=["Processing"])
app.include_router(search.router, prefix="/search", tags=["Search"])
