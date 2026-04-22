# ─── Base stage ──────────────────────────────────────────────────
FROM python:3.11-slim AS base

WORKDIR /app

# System dependencies for OCR and PDF processing
RUN apt-get update && apt-get install -y --no-install-recommends \
    tesseract-ocr \
    tesseract-ocr-eng \
    poppler-utils \
    libglib2.0-0 \
    libsm6 \
    libxext6 \
    libxrender-dev \
    libgomp1 \
    curl \
    && rm -rf /var/lib/apt/lists/*

# ─── Dependencies ────────────────────────────────────────────────
FROM base AS dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# ─── Production stage ────────────────────────────────────────────
FROM dependencies AS production

COPY app/ ./app/

# Create non-root user
RUN addgroup --gid 1001 --system python && \
    adduser --uid 1001 --system --gid 1001 python && \
    mkdir -p /app/uploads && \
    chown -R python:python /app

USER python

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "2"]
