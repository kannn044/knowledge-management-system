# Knowledge Management System (KMS) — Technical Implementation Plan

**Version:** 1.0
**Date:** April 20, 2026
**Role:** Senior System Architect & Technical Project Manager

---

## 1. System Architecture & Data Flow

### 1.1 High-Level Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                        CLIENT (Browser)                             │
│          TypeScript + Tailwind CSS (Mobile-First SPA)               │
│  ┌──────────┐  ┌──────────┐  ┌───────────┐  ┌─────────────────┐   │
│  │  Auth UI  │  │Dashboard │  │ Doc Upload│  │ Semantic Search  │   │
│  └──────────┘  └──────────┘  └───────────┘  └─────────────────┘   │
└────────────────────────────┬────────────────────────────────────────┘
                             │ HTTPS / JWT Bearer Token
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│                NODE.JS + EXPRESS (TypeScript)                        │
│                     API Gateway Layer                                │
│  ┌─────────┐  ┌──────────┐  ┌───────────┐  ┌──────────────────┐   │
│  │Auth Ctrl │  │User Ctrl │  │ Doc Ctrl  │  │  Search Ctrl     │   │
│  │(JWT+OAuth│  │(RBAC)    │  │(Upload)   │  │  (RAG Query)     │   │
│  └────┬─────┘  └────┬─────┘  └─────┬─────┘  └───────┬──────────┘   │
│       │              │              │                │              │
│  ┌────▼──────────────▼──────────────▼────────────────▼──────────┐  │
│  │              Middleware Layer                                  │  │
│  │  JWT Verify │ RBAC Guard │ Rate Limiter │ File Validator      │  │
│  └──────────────────────────────────────────────────────────────┘  │
└──────────┬──────────────┬───────────────────┬──────────────────────┘
           │              │                   │
           ▼              │                   ▼
┌──────────────────┐      │      ┌─────────────────────────────────┐
│   PostgreSQL     │      │      │   Python Microservice            │
│                  │      │      │   (FastAPI)                      │
│  • Users         │      │      │                                  │
│  • Roles         │      │      │  ┌───────────┐  ┌────────────┐  │
│  • Documents     │      │      │  │ OCR Engine │  │ Embedding  │  │
│  • Audit Logs    │      │      │  │ (Tesseract)│  │ Generator  │  │
│  • Tokens        │      │      │  └─────┬─────┘  └──────┬─────┘  │
└──────────────────┘      │      │        │               │        │
                          │      │        ▼               ▼        │
                          │      │  ┌─────────────────────────┐    │
                          │      │  │      ChromaDB            │    │
                          │      │  │  (Vector Store)          │    │
                          │      │  │  • Document Embeddings   │    │
                          │      │  │  • Metadata Index        │    │
                          │      │  └─────────────────────────┘    │
                          │      └─────────────────────────────────┘
                          │
                          ▼
                ┌──────────────────┐
                │    EmailJS       │
                │  (Transactional) │
                │  • Verification  │
                │  • Activation    │
                │  • Password Reset│
                └──────────────────┘
```

### 1.2 Data Flow Narratives

**Document Upload Flow:**
1. Staff user uploads a file (`.txt`, `.md`, `.pdf`) via the frontend.
2. Express backend validates the file type, size, and user permissions (RBAC middleware).
3. File metadata is saved to PostgreSQL with status `processing`.
4. The backend dispatches the file to the **Python microservice** via an internal HTTP call or message queue.
5. Python microservice extracts text (using Tesseract OCR for scanned PDFs, direct parsing for `.txt`/`.md`).
6. Extracted text is chunked using a recursive character text splitter (chunk size ~500 tokens, overlap ~50 tokens).
7. Chunks are converted to vector embeddings via a sentence-transformer model (e.g., `all-MiniLM-L6-v2`).
8. Embeddings + metadata are stored in ChromaDB.
9. Python microservice calls back to Node.js to update document status to `ready` in PostgreSQL.

**Semantic Search Flow:**
1. User enters a natural-language query in the search UI.
2. Frontend sends the query to `POST /api/search`.
3. Node.js forwards the query to the Python microservice.
4. Python generates an embedding for the query using the same model.
5. ChromaDB performs a similarity search (cosine distance) and returns top-k relevant chunks.
6. Results include chunk text, similarity scores, and document metadata.
7. Node.js enriches results with document metadata from PostgreSQL and returns to the frontend.

**Authentication Flow (Email/Password):**
1. User submits credentials to `POST /api/auth/login`.
2. Backend verifies credentials against bcrypt-hashed password in PostgreSQL.
3. On success, issues a JWT access token (15-min expiry) and a refresh token (7-day expiry, stored in DB).
4. Frontend stores tokens (access in memory, refresh in httpOnly cookie).
5. All subsequent API calls include the access token in the `Authorization: Bearer` header.
6. Middleware decodes the JWT, attaches user + role to `req.user`, and RBAC guard checks permissions.

---

## 2. Database Schema (PostgreSQL)

### 2.1 Entity Relationship Diagram

```
┌──────────────┐       ┌──────────────────┐       ┌──────────────────┐
│    roles     │       │      users       │       │  refresh_tokens  │
├──────────────┤       ├──────────────────┤       ├──────────────────┤
│ id (PK)      │──1:N─▶│ id (PK, UUID)    │──1:N─▶│ id (PK)          │
│ name         │       │ email (UNIQUE)   │       │ user_id (FK)     │
│ description  │       │ password_hash    │       │ token_hash       │
│ created_at   │       │ first_name       │       │ expires_at       │
└──────────────┘       │ last_name        │       │ created_at       │
                       │ telephone        │       └──────────────────┘
                       │ department       │
                       │ job_title        │
                       │ role_id (FK)     │
                       │ status (ENUM)    │
                       │ email_verified   │
                       │ google_id        │
                       │ avatar_url       │
                       │ created_at       │
                       │ updated_at       │
                       └────────┬─────────┘
                                │
                         1:N    │    1:N
                    ┌───────────┼───────────┐
                    ▼                       ▼
          ┌──────────────────┐    ┌──────────────────┐
          │    documents     │    │   audit_logs     │
          ├──────────────────┤    ├──────────────────┤
          │ id (PK, UUID)    │    │ id (PK)          │
          │ title            │    │ user_id (FK)     │
          │ description      │    │ action           │
          │ file_name        │    │ resource_type    │
          │ file_path        │    │ resource_id      │
          │ file_type (ENUM) │    │ details (JSONB)  │
          │ file_size        │    │ ip_address       │
          │ status (ENUM)    │    │ created_at       │
          │ uploaded_by (FK) │    └──────────────────┘
          │ chroma_collection│
          │ chunk_count      │
          │ created_at       │
          │ updated_at       │
          └──────────────────┘
```

### 2.2 Table Definitions

**`roles`**
| Column      | Type         | Constraints        | Notes                          |
|-------------|-------------|--------------------|---------------------------------|
| id          | SERIAL       | PRIMARY KEY        |                                 |
| name        | VARCHAR(50)  | UNIQUE, NOT NULL   | 'admin', 'staff', 'viewer'      |
| description | TEXT         |                    |                                 |
| created_at  | TIMESTAMPTZ  | DEFAULT NOW()      |                                 |

**`users`**
| Column         | Type         | Constraints                 | Notes                           |
|----------------|-------------|-----------------------------|---------------------------------|
| id             | UUID         | PRIMARY KEY, DEFAULT uuid4  |                                 |
| email          | VARCHAR(255) | UNIQUE, NOT NULL            | Indexed                         |
| password_hash  | VARCHAR(255) |                             | Nullable for OAuth-only users   |
| first_name     | VARCHAR(100) | NOT NULL                    |                                 |
| last_name      | VARCHAR(100) | NOT NULL                    |                                 |
| telephone      | VARCHAR(20)  |                             |                                 |
| department     | VARCHAR(100) |                             |                                 |
| job_title      | VARCHAR(100) |                             |                                 |
| role_id        | INTEGER      | FK → roles.id, DEFAULT 3   | Default = viewer                |
| status         | ENUM         | NOT NULL, DEFAULT 'pending' | pending/waiting/active/disabled  |
| email_verified | BOOLEAN      | DEFAULT FALSE               |                                 |
| google_id      | VARCHAR(255) | UNIQUE                      | For Google OAuth                |
| avatar_url     | TEXT         |                             |                                 |
| created_at     | TIMESTAMPTZ  | DEFAULT NOW()               |                                 |
| updated_at     | TIMESTAMPTZ  | DEFAULT NOW()               |                                 |

**User Status Machine:**
```
  [Register] → pending → [Email Verified] → waiting → [Admin Approves] → active
                                                        [Admin Rejects] → disabled
```

**`documents`**
| Column            | Type         | Constraints                | Notes                                |
|-------------------|-------------|----------------------------|--------------------------------------|
| id                | UUID         | PRIMARY KEY                |                                      |
| title             | VARCHAR(255) | NOT NULL                   |                                      |
| description       | TEXT         |                            |                                      |
| file_name         | VARCHAR(255) | NOT NULL                   | Original filename                    |
| file_path         | TEXT         | NOT NULL                   | Storage path on server               |
| file_type         | ENUM         | NOT NULL                   | txt/md/pdf                           |
| file_size         | BIGINT       | NOT NULL                   | Bytes                                |
| status            | ENUM         | NOT NULL, DEFAULT 'uploaded'| uploaded/processing/ready/failed     |
| uploaded_by       | UUID         | FK → users.id              |                                      |
| chroma_collection | VARCHAR(255) |                            | ChromaDB collection name             |
| chunk_count       | INTEGER      | DEFAULT 0                  | Number of chunks generated           |
| error_message     | TEXT         |                            | Stores failure reason if status=failed|
| created_at        | TIMESTAMPTZ  | DEFAULT NOW()              |                                      |
| updated_at        | TIMESTAMPTZ  | DEFAULT NOW()              |                                      |

**`refresh_tokens`**
| Column     | Type         | Constraints           | Notes              |
|-----------|-------------|----------------------|---------------------|
| id        | SERIAL       | PRIMARY KEY           |                     |
| user_id   | UUID         | FK → users.id         | ON DELETE CASCADE   |
| token_hash| VARCHAR(255) | NOT NULL              | SHA-256 of token    |
| expires_at| TIMESTAMPTZ  | NOT NULL              |                     |
| created_at| TIMESTAMPTZ  | DEFAULT NOW()         |                     |

**`email_verification_tokens`**
| Column     | Type         | Constraints           | Notes              |
|-----------|-------------|----------------------|---------------------|
| id        | SERIAL       | PRIMARY KEY           |                     |
| user_id   | UUID         | FK → users.id         | ON DELETE CASCADE   |
| token     | VARCHAR(255) | UNIQUE, NOT NULL      | Random secure token |
| expires_at| TIMESTAMPTZ  | NOT NULL              | 24-hour expiry      |
| used      | BOOLEAN      | DEFAULT FALSE         |                     |
| created_at| TIMESTAMPTZ  | DEFAULT NOW()         |                     |

**`audit_logs`**
| Column        | Type         | Constraints           | Notes                     |
|--------------|-------------|----------------------|---------------------------|
| id           | BIGSERIAL    | PRIMARY KEY           |                           |
| user_id      | UUID         | FK → users.id         | Nullable for system events|
| action       | VARCHAR(100) | NOT NULL              | e.g., 'user.login', 'doc.upload' |
| resource_type| VARCHAR(50)  |                       | 'user', 'document', etc.  |
| resource_id  | UUID         |                       |                           |
| details      | JSONB        |                       | Flexible payload          |
| ip_address   | INET         |                       |                           |
| created_at   | TIMESTAMPTZ  | DEFAULT NOW()         | Indexed                   |

### 2.3 ChromaDB Collections

ChromaDB stores vector embeddings separately from PostgreSQL. Each document creates entries in a shared collection:

```
Collection: "kms_documents"
├── id:        chunk unique identifier (e.g., "{doc_uuid}_chunk_0")
├── embedding: float[] (384-dim for MiniLM-L6-v2)
├── document:  the raw text chunk
└── metadata:  {
      "document_id": UUID,
      "chunk_index": number,
      "file_name": string,
      "uploaded_by": UUID,
      "department": string,
      "created_at": ISO timestamp
    }
```

---

## 3. API Route Design

### 3.1 Authentication Routes — `/api/auth`

| Method | Endpoint                      | Access    | Description                                      |
|--------|-------------------------------|-----------|--------------------------------------------------|
| POST   | `/api/auth/register`          | Public    | Register new user; triggers verification email    |
| POST   | `/api/auth/login`             | Public    | Email/password login; returns JWT + refresh token |
| POST   | `/api/auth/google`            | Public    | Google OAuth callback; returns JWT                |
| POST   | `/api/auth/refresh`           | Public    | Exchange refresh token for new access token       |
| POST   | `/api/auth/logout`            | Auth      | Invalidate refresh token                          |
| GET    | `/api/auth/verify-email/:token`| Public   | Verify email; set status to 'waiting'             |
| POST   | `/api/auth/forgot-password`   | Public    | Generate temp password; send via EmailJS          |
| POST   | `/api/auth/change-password`   | Auth      | Change password (required after temp password)    |

### 3.2 User Management Routes — `/api/users`

| Method | Endpoint                      | Access    | Description                                      |
|--------|-------------------------------|-----------|--------------------------------------------------|
| GET    | `/api/users/profile`          | Auth      | Get current user profile                         |
| PUT    | `/api/users/profile`          | Auth      | Update own profile                               |
| GET    | `/api/users`                  | Admin     | List all users (with filters & pagination)       |
| GET    | `/api/users/pending`          | Admin     | List users with status 'waiting'                 |
| PATCH  | `/api/users/:id/approve`      | Admin     | Approve user → status 'active'; send email       |
| PATCH  | `/api/users/:id/reject`       | Admin     | Reject user → status 'disabled'; send email      |
| PATCH  | `/api/users/:id/role`         | Admin     | Change user role                                 |
| DELETE | `/api/users/:id`              | Admin     | Soft-delete/disable user                         |

### 3.3 Document Management Routes — `/api/documents`

| Method | Endpoint                            | Access       | Description                                      |
|--------|-------------------------------------|-------------|--------------------------------------------------|
| POST   | `/api/documents/upload`             | Staff+      | Upload file; triggers OCR & vectorization pipeline|
| GET    | `/api/documents`                    | Auth        | List documents (paginated, filterable by status)  |
| GET    | `/api/documents/:id`                | Auth        | Get document metadata + download link             |
| GET    | `/api/documents/:id/content`        | Auth        | Get extracted text content                        |
| DELETE | `/api/documents/:id`                | Staff+/Owner| Delete document + remove from ChromaDB            |
| GET    | `/api/documents/:id/status`         | Staff+      | Poll processing status                            |

### 3.4 Search Routes — `/api/search`

| Method | Endpoint                      | Access    | Description                                      |
|--------|-------------------------------|-----------|--------------------------------------------------|
| POST   | `/api/search`                 | Auth      | Semantic search query against ChromaDB            |
| GET    | `/api/search/suggestions`     | Auth      | Auto-complete / recent searches                   |

**Search Request Body:**
```json
{
  "query": "How to configure VPN for remote access?",
  "top_k": 10,
  "filters": {
    "department": "IT",
    "file_type": "pdf"
  }
}
```

**Search Response:**
```json
{
  "results": [
    {
      "document_id": "uuid",
      "title": "VPN Configuration Guide",
      "chunk_text": "To configure the VPN client...",
      "similarity_score": 0.92,
      "file_type": "pdf",
      "department": "IT",
      "uploaded_by": "John Doe",
      "created_at": "2026-04-15T10:30:00Z"
    }
  ],
  "total": 10,
  "query_time_ms": 145
}
```

### 3.5 Admin / System Routes — `/api/admin`

| Method | Endpoint                      | Access    | Description                                      |
|--------|-------------------------------|-----------|--------------------------------------------------|
| GET    | `/api/admin/dashboard`        | Admin     | System stats (user counts, doc counts, etc.)     |
| GET    | `/api/admin/audit-logs`       | Admin     | Query audit log with filters                     |
| POST   | `/api/admin/settings`         | Admin     | Update global settings (max upload size, etc.)   |

### 3.6 Middleware Stack

```
Request
  │
  ├─▶ cors()
  ├─▶ helmet()
  ├─▶ express.json({ limit: '1mb' })
  ├─▶ rateLimiter (100 req/15min per IP for auth routes)
  ├─▶ requestLogger (morgan + audit_logs)
  ├─▶ authenticateJWT (decode & verify token)
  ├─▶ requireRole(['admin', 'staff']) — RBAC guard
  ├─▶ validateRequest (Zod schema validation)
  └─▶ Controller → Service → Repository
```

---

## 4. Phased Implementation Roadmap

### Phase 1: Foundation & Environment Setup (Sprint 1 — Week 1-2)

**Goal:** Project scaffolding, database, and dev environment.

| Task | Details | Priority |
|------|---------|----------|
| 1.1 Initialize monorepo | Create `/frontend` (Vite + React + TS + Tailwind) and `/backend` (Express + TS) | High |
| 1.2 Docker Compose | PostgreSQL 16, ChromaDB, Python microservice, Node.js backend | High |
| 1.3 PostgreSQL schema | Run migration scripts for all tables (use `node-pg-migrate` or Prisma) | High |
| 1.4 Backend boilerplate | Express app, TypeScript config, ESLint, Prettier, environment variables | High |
| 1.5 Frontend boilerplate | Vite + React 18, Tailwind config, routing (React Router v6), mobile-first layout | High |
| 1.6 Python microservice scaffold | FastAPI app with health-check endpoint, Dockerfile | Medium |
| 1.7 CI pipeline | GitHub Actions for lint, type-check, and test on PR | Medium |

**Deliverable:** All services start locally with `docker-compose up`. Health checks pass.

---

### Phase 2: Authentication & User Management (Sprint 2 — Week 3-4)

**Goal:** Complete auth system with JWT, Google OAuth, and the registration/approval flow.

| Task | Details | Priority |
|------|---------|----------|
| 2.1 JWT auth service | `bcrypt` password hashing, access/refresh token generation, token rotation | High |
| 2.2 Auth middleware | `authenticateJWT` middleware, `requireRole` RBAC guard | High |
| 2.3 Registration endpoint | Input validation (Zod), create user with status `pending`, generate email token | High |
| 2.4 Email verification | Verification link generation, `/verify-email/:token` endpoint | High |
| 2.5 EmailJS integration | Service wrapper for sending verification, activation, and reset emails | High |
| 2.6 Google OAuth | Passport.js Google Strategy, link Google accounts to existing users | High |
| 2.7 Forgot password flow | Generate random temp password, send via EmailJS, force change on login | Medium |
| 2.8 Admin: user management UI | Pending users list, approve/reject buttons, role assignment | Medium |
| 2.9 Frontend: login page | Email/password form, Google login button, register/forgot-password links | High |
| 2.10 Frontend: registration page | Multi-field form with validation, success/waiting screen | High |
| 2.11 Frontend: protected routes | Route guard HOC, redirect to login, role-based sidebar rendering | High |

**Deliverable:** Users can register → verify email → wait for admin → get activated → log in.

---

### Phase 3: OCR & Document Upload Pipeline (Sprint 3 — Week 5-7)

**Goal:** End-to-end document ingestion, OCR, chunking, and vectorization.

| Task | Details | Priority |
|------|---------|----------|
| 3.1 File upload endpoint | Multer middleware, file-type validation (.txt, .md, .pdf), size limits (50MB) | High |
| 3.2 File storage service | Store uploaded files to disk (or S3-compatible like MinIO) | High |
| 3.3 Python: text extraction | `.txt` → direct read, `.md` → markdown parser, `.pdf` → PyPDF2 + Tesseract OCR | High |
| 3.4 Python: text chunking | Recursive character splitter with configurable chunk_size and overlap | High |
| 3.5 Python: embedding generation | `sentence-transformers` with `all-MiniLM-L6-v2` model (384-dim) | High |
| 3.6 Python: ChromaDB ingestion | Store embeddings + metadata in ChromaDB collection | High |
| 3.7 Node.js ↔ Python communication | Internal REST API call with callback on completion, error handling | High |
| 3.8 Processing status tracking | Update document status in PostgreSQL (processing → ready/failed) | Medium |
| 3.9 Document management UI | Upload form with drag-and-drop, progress bar, document list with status badges | Medium |
| 3.10 Background job handling | Bull/BullMQ queue for async processing, retry on failure, dead-letter queue | Medium |

**Deliverable:** Staff can upload a PDF, observe processing status, and see it marked as "ready."

---

### Phase 4: Semantic Search & Frontend Integration (Sprint 4 — Week 8-9)

**Goal:** RAG-based search, results display, and full frontend polish.

| Task | Details | Priority |
|------|---------|----------|
| 4.1 Search endpoint | Accept query, forward to Python, return enriched results | High |
| 4.2 Python: query embedding | Embed query with same model, call ChromaDB similarity search | High |
| 4.3 Search results enrichment | Join ChromaDB results with PostgreSQL document metadata | High |
| 4.4 Frontend: search UI | Search bar with real-time suggestions, filter chips (department, file type) | High |
| 4.5 Frontend: results display | Card-based results with highlighted text, score indicator, document link | High |
| 4.6 Frontend: document viewer | In-app text viewer for extracted content, with section navigation | Medium |
| 4.7 Frontend: dashboard | Summary cards (total docs, recent uploads, popular searches) | Medium |
| 4.8 Search analytics | Log search queries and click-through rates for admin dashboard | Low |

**Deliverable:** Users can search the knowledge base, view results, and read document content.

---

### Phase 5: Polish, Security, & Deployment (Sprint 5 — Week 10-11)

**Goal:** Production hardening, testing, and deployment.

| Task | Details | Priority |
|------|---------|----------|
| 5.1 Security audit | Rate limiting, input sanitization, CORS policy, Helmet.js, XSS protection | High |
| 5.2 Unit & integration tests | Jest for backend, React Testing Library for frontend, Python pytest | High |
| 5.3 API documentation | Swagger/OpenAPI spec auto-generated via `tsoa` or `swagger-jsdoc` | Medium |
| 5.4 Error handling & logging | Centralized error handler, Winston/Pino logging, structured log format | High |
| 5.5 Performance optimization | Database indexing, query optimization, ChromaDB tuning | Medium |
| 5.6 Responsive UI audit | Test on iPhone SE, iPhone 14, iPad, and desktop breakpoints | Medium |
| 5.7 Deployment setup | Dockerized production build, Nginx reverse proxy, environment configs | High |
| 5.8 Monitoring | Health-check endpoints, uptime monitoring, Sentry for error tracking | Medium |
| 5.9 User acceptance testing | End-to-end flow testing with real users across all roles | High |

**Deliverable:** Production-ready system deployed with monitoring and documentation.

---

## 5. Technical Considerations & Bottlenecks

### 5.1 Why a Python Microservice? (Critical Decision)

**Recommendation: Use a separate Python/FastAPI microservice for OCR and embedding generation.**

The reasoning is threefold:

**Performance:** OCR (Tesseract) and embedding generation (sentence-transformers) are CPU/GPU-intensive operations that would block the Node.js event loop. Even offloading to Worker Threads would consume the same process memory. A separate Python service runs on its own process and can be scaled independently.

**Ecosystem maturity:** The Python ML/NLP ecosystem (PyTorch, sentence-transformers, ChromaDB's native Python client, Tesseract Python bindings) is significantly more mature and better-documented than Node.js equivalents. Using Python avoids brittle WASM/native bindings.

**Scalability:** When document uploads increase, you can horizontally scale the Python service independently without scaling the API server. This also allows GPU-based inference if you upgrade to larger embedding models later.

**Communication pattern:**
```
Node.js Backend                    Python Microservice
     │                                    │
     ├── POST /process ──────────────────▶│  (file path + doc ID)
     │                                    ├── Extract text (OCR)
     │                                    ├── Chunk text
     │                                    ├── Generate embeddings
     │                                    ├── Store in ChromaDB
     │◀── POST /callback ────────────────┤  (status: ready/failed)
     │                                    │
```

For production, consider replacing the HTTP callback with a message queue (e.g., Redis + BullMQ) for reliable delivery and retry semantics.

### 5.2 OCR Performance for Scanned PDFs

**Bottleneck:** A single scanned PDF page takes ~2-5 seconds with Tesseract. A 100-page scanned document could take 3-8 minutes.

**Mitigations:**

- **Async processing** with job queues (BullMQ) so users aren't blocked. Show processing status via polling or WebSocket updates.
- **Parallel page processing:** Split multi-page PDFs and OCR pages concurrently across worker processes (Python `multiprocessing` pool).
- **Skip OCR when not needed:** Use `PyPDF2` first to attempt direct text extraction. Only invoke Tesseract if the extracted text is empty or below a confidence threshold.
- **Pre-processing:** Convert PDF pages to high-contrast grayscale images before OCR to improve accuracy and speed.
- **File size limit:** Enforce a reasonable maximum (50MB per file) and page limit (200 pages) with clear user feedback.

### 5.3 Embedding Model Selection

| Model | Dimensions | Speed | Quality | Size |
|-------|-----------|-------|---------|------|
| `all-MiniLM-L6-v2` | 384 | Fast | Good | 80MB |
| `all-mpnet-base-v2` | 768 | Medium | Better | 420MB |
| `e5-large-v2` | 1024 | Slow | Best | 1.3GB |

**Recommendation:** Start with `all-MiniLM-L6-v2` for development and initial deployment. It offers the best speed-to-quality ratio for a KMS use case. Plan a migration path to larger models if search quality requires improvement.

### 5.4 ChromaDB Scaling Considerations

ChromaDB works well for up to ~1M vectors in a single-node setup. For the expected scale of a KMS, this should be sufficient. Key considerations:

- **Persistence:** Enable ChromaDB's persistent mode (SQLite + Parquet backend) to survive container restarts.
- **Metadata filtering:** ChromaDB supports metadata filtering which enables filtering by department, file type, etc. alongside vector similarity — use this instead of post-filtering.
- **Batch inserts:** When vectorizing a large document, batch the ChromaDB inserts (chunks of 100-500) to avoid timeout issues.
- **Backup strategy:** ChromaDB's data directory should be volume-mounted and included in your backup schedule.

### 5.5 JWT Security Best Practices

- **Short-lived access tokens** (15 minutes) with refresh token rotation.
- **Refresh tokens** stored as SHA-256 hashes in PostgreSQL, not as plaintext.
- **Token blacklist** via Redis or a database table for immediate revocation on logout.
- **httpOnly, Secure, SameSite=Strict** cookies for refresh tokens — never localStorage.
- **Audience and issuer claims** in JWT payload to prevent token misuse across services.

### 5.6 Rate Limiting Strategy

| Route Category | Limit | Window |
|---------------|-------|--------|
| Auth (login, register, forgot) | 10 requests | 15 minutes |
| Search | 60 requests | 1 minute |
| Document upload | 10 uploads | 1 hour |
| General API | 100 requests | 1 minute |

Implement using `express-rate-limit` with Redis store for consistency across multiple Node.js instances.

### 5.7 File Storage Strategy

For the initial deployment, use local disk storage with a structured path:
```
/uploads
  /{year}
    /{month}
      /{document_uuid}
        /original.pdf
        /extracted.txt
```

For production scale, migrate to S3-compatible object storage (AWS S3 or MinIO for self-hosted) with pre-signed URLs for secure, time-limited downloads.

---

## 6. Project Structure

```
kms/
├── docker-compose.yml
├── .env.example
│
├── backend/                    # Node.js + Express + TypeScript
│   ├── src/
│   │   ├── config/             # DB, JWT, EmailJS, app config
│   │   ├── controllers/        # Route handlers
│   │   ├── middleware/         # auth, rbac, validation, upload
│   │   ├── models/            # Prisma schema or TypeORM entities
│   │   ├── routes/            # Express route definitions
│   │   ├── services/          # Business logic layer
│   │   ├── utils/             # Helpers (emailjs, tokenGenerator)
│   │   ├── types/             # TypeScript interfaces & enums
│   │   └── app.ts             # Express app entry point
│   ├── prisma/
│   │   └── schema.prisma      # Database schema
│   ├── tests/
│   ├── package.json
│   └── tsconfig.json
│
├── frontend/                   # React + TypeScript + Tailwind
│   ├── src/
│   │   ├── components/        # Reusable UI components
│   │   │   ├── ui/            # Buttons, inputs, cards
│   │   │   ├── layout/        # Sidebar, navbar, footer
│   │   │   └── shared/        # File upload, search bar
│   │   ├── pages/             # Route-level page components
│   │   │   ├── auth/          # Login, Register, ForgotPassword
│   │   │   ├── dashboard/     # Dashboard, Search
│   │   │   ├── documents/     # Upload, List, Viewer
│   │   │   └── admin/         # UserManagement, AuditLogs
│   │   ├── hooks/             # Custom React hooks
│   │   ├── context/           # AuthContext, ThemeContext
│   │   ├── services/          # API client (Axios/fetch wrappers)
│   │   ├── types/             # Shared TypeScript types
│   │   ├── utils/             # Formatters, validators
│   │   └── App.tsx
│   ├── tailwind.config.ts
│   ├── package.json
│   └── tsconfig.json
│
├── python-service/             # FastAPI + OCR + Embeddings
│   ├── app/
│   │   ├── main.py            # FastAPI app
│   │   ├── routers/           # /process, /search endpoints
│   │   ├── services/
│   │   │   ├── ocr.py         # Tesseract + PyPDF2
│   │   │   ├── chunker.py     # Text chunking logic
│   │   │   ├── embedder.py    # Sentence-transformers
│   │   │   └── chroma.py      # ChromaDB client
│   │   └── config.py
│   ├── requirements.txt
│   ├── Dockerfile
│   └── tests/
│
└── docs/
    ├── api-spec.yaml           # OpenAPI spec
    └── architecture.md
```

---

## 7. Key Technology Versions (Recommended)

| Technology | Version | Purpose |
|-----------|---------|---------|
| Node.js | 20 LTS | Backend runtime |
| TypeScript | 5.x | Type safety (frontend + backend) |
| Express | 4.18+ | HTTP framework |
| React | 18.x | Frontend UI library |
| Tailwind CSS | 3.4+ | Utility-first CSS |
| Vite | 5.x | Frontend build tool |
| PostgreSQL | 16 | Primary database |
| Prisma | 5.x | ORM + migrations |
| ChromaDB | 0.4+ | Vector store |
| FastAPI | 0.110+ | Python microservice |
| Tesseract | 5.x | OCR engine |
| sentence-transformers | 2.x | Embedding generation |
| Docker | 24+ | Containerization |
| BullMQ | 5.x | Job queue (Node.js ↔ Python) |
| EmailJS | - | Transactional emails |
| Passport.js | 0.7+ | Google OAuth strategy |
| Zod | 3.x | Runtime schema validation |

---

## 8. Sprint Summary Timeline

```
Week  1-2   ████████  Phase 1: Foundation & Environment Setup
Week  3-4   ████████  Phase 2: Authentication & User Management
Week  5-7   ████████████  Phase 3: OCR & Document Upload Pipeline
Week  8-9   ████████  Phase 4: Semantic Search & Frontend
Week 10-11  ████████  Phase 5: Polish, Security & Deployment
            ─────────────────────────────────────────────────
            Total: ~11 weeks (2.5 months)
```

---

*End of Implementation Plan — Version 1.0*
