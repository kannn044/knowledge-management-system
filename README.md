# Knowledge Management System (KMS)

A full-stack, self-hosted knowledge management platform that lets teams upload documents, extract text via OCR, generate semantic embeddings, and query their knowledge base with natural-language search.

---

## Table of Contents

- [Features](#features)
- [Architecture](#architecture)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Prerequisites](#prerequisites)
- [Getting Started](#getting-started)
  - [Environment Variables](#environment-variables)
  - [Running with Docker (Recommended)](#running-with-docker-recommended)
  - [Running Locally (Development)](#running-locally-development)
- [Database](#database)
- [API Documentation](#api-documentation)
- [Testing](#testing)
- [Deployment](#deployment)
- [Make Commands](#make-commands)

---

## Features

- **Document Management** — Upload `.txt`, `.md`, and `.pdf` files with metadata tracking
- **OCR Processing** — Automatic text extraction from scanned PDFs via Tesseract
- **Semantic Search** — Natural-language queries powered by sentence-transformer embeddings and ChromaDB vector similarity
- **Authentication** — JWT-based auth (access + refresh tokens) and Google OAuth2 sign-in
- **Role-Based Access Control** — Admin, Staff, and Viewer roles with per-route guards
- **Async Processing** — BullMQ + Redis job queue for background document ingestion
- **Audit Logging** — Tamper-evident logs for all sensitive operations
- **Admin Panel** — User management, document oversight, and system health views
- **Rate Limiting** — Per-IP and per-endpoint limits via `express-rate-limit`
- **Observability** — Structured logging (Winston), Sentry error tracking, Swagger UI docs

---

## Architecture

```
Browser (React SPA)
        │ HTTPS / JWT Bearer
        ▼
Node.js + Express (API Gateway)
   ├── Auth Controller  (JWT, Google OAuth2)
   ├── User Controller  (RBAC)
   ├── Document Controller (Upload, Status)
   └── Search Controller   (RAG Query)
        │                        │
        ▼                        ▼
   PostgreSQL            Python FastAPI Microservice
   (Users, Docs,          ├── OCR  (Tesseract)
    Audit Logs,           ├── Embedding (sentence-transformers)
    Tokens)               └── ChromaDB (Vector Store)
        │
        ▼
     Redis + BullMQ
     (Job Queue)
```

**Document Upload Flow:** File → Express validation → PostgreSQL (`processing`) → BullMQ → Python OCR + chunking → embeddings → ChromaDB → callback → PostgreSQL (`ready`)

**Search Flow:** Query → Express → Python embedding → ChromaDB cosine similarity → top-k chunks → enriched with PostgreSQL metadata → response

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, TypeScript, Vite, Tailwind CSS, React Query, React Hook Form, Zod |
| Backend | Node.js, Express, TypeScript, Prisma ORM |
| Database | PostgreSQL 16 |
| Vector Store | ChromaDB |
| Queue | BullMQ + Redis 7 |
| AI / ML Service | FastAPI, sentence-transformers (`all-MiniLM-L6-v2`), Tesseract OCR |
| Auth | JWT (access 15 min / refresh 7 days), Google OAuth2, bcrypt |
| Infrastructure | Docker, Docker Compose, Nginx |
| Observability | Winston, Sentry, Swagger UI |

---

## Project Structure

```
kms/
├── backend/            # Node.js + Express API
│   ├── prisma/         # Prisma schema & seed
│   └── src/
│       ├── config/     # DB, env, logger, passport, Redis, Sentry, Swagger
│       ├── controllers/
│       ├── middleware/ # Auth, RBAC, rate limiter, upload, validation
│       ├── routes/
│       └── services/   # Auth, document, email, queue, search, storage
├── frontend/           # React SPA
│   └── src/
│       ├── components/
│       ├── context/    # AuthContext
│       ├── hooks/
│       ├── pages/      # Auth, Dashboard, Documents, Admin
│       └── services/   # Axios API clients
├── python-service/     # FastAPI AI microservice
│   └── app/
│       ├── routers/    # /health, /process, /search
│       └── services/   # OCR, chunker, embedder, vector store
├── nginx/              # Reverse proxy config
├── scripts/            # DB init SQL, deploy & server-setup scripts
├── docker-compose.yml
├── docker-compose.prod.yml
└── Makefile
```

---

## Prerequisites

- [Docker](https://docs.docker.com/get-docker/) & Docker Compose v2
- [Node.js](https://nodejs.org/) 20+ (for local dev only)
- [Python](https://www.python.org/) 3.11+ (for local dev only)

---

## Getting Started

### Environment Variables

Copy the example files and fill in your values:

```bash
cp kms/backend/.env.example kms/backend/.env
cp kms/python-service/.env.example kms/python-service/.env
```

**Backend `.env` key variables:**

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `JWT_ACCESS_SECRET` | Secret for access tokens |
| `JWT_REFRESH_SECRET` | Secret for refresh tokens |
| `REDIS_URL` | Redis connection URL |
| `GOOGLE_CLIENT_ID` | Google OAuth2 client ID |
| `GOOGLE_CLIENT_SECRET` | Google OAuth2 client secret |
| `INTERNAL_API_SECRET` | Shared secret between Node and Python services |
| `PYTHON_SERVICE_URL` | URL of the Python microservice |

**Python service `.env` key variables:**

| Variable | Description |
|---|---|
| `CHROMA_HOST` | ChromaDB host |
| `CHROMA_PORT` | ChromaDB port |
| `NODE_CALLBACK_URL` | Node.js internal callback URL |
| `INTERNAL_API_SECRET` | Shared secret (must match backend) |

---

### Running with Docker (Recommended)

```bash
cd kms

# Start all services (PostgreSQL, Redis, ChromaDB, Backend, Python, Frontend, Nginx)
make up

# Run database migrations and seed initial data
make migrate
make seed
```

The application will be available at `http://localhost`.

To view logs:

```bash
make logs          # all services
make logs-backend  # backend only
make logs-python   # python service only
```

---

### Running Locally (Development)

**1. Start infrastructure services:**

```bash
cd kms
docker-compose up -d postgres redis chromadb
```

**2. Backend:**

```bash
cd kms/backend
npm install
npx prisma migrate dev
npm run db:seed
npm run dev        # starts on http://localhost:3001
```

**3. Python service:**

```bash
cd kms/python-service
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8002
```

**4. Frontend:**

```bash
cd kms/frontend
npm install
npm run dev        # starts on http://localhost:5173
```

---

## Database

Prisma is used for schema management and migrations.

```bash
# Generate Prisma client after schema changes
make migrate       # runs: prisma migrate dev

# Seed the database with default roles and an admin user
make seed

# Open the Prisma visual database browser
make studio

# Deploy migrations in production
make migrate-prod
```

**Core tables:** `roles`, `users`, `documents`, `audit_logs`, `refresh_tokens`

**User statuses:** `pending` → `waiting` → `active` / `disabled`

**Document statuses:** `uploaded` → `processing` → `ready` / `failed`

---

## API Documentation

Swagger UI is available at `http://localhost:3001/api/docs` when the backend is running.

Key route groups:

| Prefix | Description |
|---|---|
| `POST /api/auth/*` | Login, register, refresh, logout, Google OAuth |
| `GET/PATCH /api/users/*` | User profile and management (admin) |
| `POST/GET /api/documents/*` | Upload, list, download, delete documents |
| `POST /api/search` | Semantic search query |
| `GET /api/health` | Service health check |
| `POST /api/internal/*` | Internal service-to-service callbacks |

---

## Testing

**Backend (Jest):**

```bash
cd kms/backend
npm test                # run all tests
npm run test:coverage   # with coverage report
```

**Frontend (Vitest):**

```bash
cd kms/frontend
npm test
npm run test:coverage
```

**Python service (Pytest):**

```bash
cd kms/python-service
pytest
pytest tests/ -v
```

---

## Deployment

A production deployment uses the override compose file and Nginx as the reverse proxy:

```bash
cd kms
make prod-up    # docker-compose + docker-compose.prod.yml

# To tear down
make prod-down
```

The `scripts/server-setup.sh` script handles initial server provisioning (Docker install, firewall, etc.) and `scripts/deploy.sh` handles rolling updates.

---

## Make Commands

```
make help           Show all available commands
make up             Start all services (dev)
make down           Stop all services
make build          Rebuild Docker images (no cache)
make logs           Tail all service logs
make migrate        Run Prisma migrations
make migrate-prod   Deploy migrations to production
make seed           Seed initial database data
make studio         Open Prisma Studio
make shell-backend  Open shell in backend container
make shell-python   Open shell in python-service container
make shell-db       Open PostgreSQL shell
make prod-up        Start in production mode
make prod-down      Stop production services
make clean          Remove all containers and volumes
```
