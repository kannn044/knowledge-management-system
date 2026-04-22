import { Request } from 'express';

// ─── User & Auth Types ────────────────────────────────────────────

export type UserRole = 'admin' | 'staff' | 'viewer';

export type UserStatus = 'pending' | 'waiting' | 'active' | 'disabled';

export interface JwtPayload {
  sub: string;       // user UUID
  email: string;
  role: UserRole;
  iat?: number;
  exp?: number;
  iss?: string;
  aud?: string;
}

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: UserRole;
    status: UserStatus;
  };
}

// ─── API Response Types ───────────────────────────────────────────

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
  meta?: PaginationMeta;
}

export interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// ─── Document Types ───────────────────────────────────────────────

export type FileType = 'txt' | 'md' | 'pdf';
export type DocStatus = 'uploaded' | 'processing' | 'ready' | 'failed';

// ─── Search Types ─────────────────────────────────────────────────

export interface SearchQuery {
  query: string;
  top_k?: number;
  filters?: {
    department?: string;
    file_type?: FileType;
  };
}

export interface SearchResult {
  document_id: string;
  title: string;
  chunk_text: string;
  similarity_score: number;
  file_type: FileType;
  department?: string;
  uploaded_by: string;
  created_at: string;
}

export interface SearchResponse {
  results: SearchResult[];
  total: number;
  query_time_ms: number;
}
