from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    # Application
    app_name: str = "KMS Python Microservice"
    debug: bool = False
    host: str = "0.0.0.0"
    port: int = 8000

    # ChromaDB
    chroma_host: str = "chromadb"
    chroma_port: int = 8000
    chroma_collection: str = "kms_documents"

    # Node.js callback
    node_callback_url: str = "http://backend:3001/api/internal/callback"

    # Embedding model
    embedding_model: str = "all-MiniLM-L6-v2"
    embedding_device: str = "cpu"

    # Chunking
    chunk_size: int = 500
    chunk_overlap: int = 50

    # File paths
    upload_base_dir: str = "/app/uploads"

    # Internal auth
    internal_api_secret: str = "internal_secret_change_me"

    class Config:
        env_file = ".env"
        case_sensitive = False


@lru_cache()
def get_settings() -> Settings:
    return Settings()
