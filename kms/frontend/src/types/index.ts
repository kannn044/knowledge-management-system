// ─── User & Auth ─────────────────────────────────────────────────

export type UserRole = 'admin' | 'staff' | 'viewer';
export type UserStatus = 'pending' | 'waiting' | 'active' | 'disabled';

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  telephone?: string;
  department?: string;
  jobTitle?: string;
  role: UserRole;
  status: UserStatus;
  emailVerified: boolean;
  avatarUrl?: string;
  createdAt: string;
}

export interface AuthTokens {
  accessToken: string;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterData {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  telephone?: string;
  department?: string;
  jobTitle?: string;
}

// ─── Document ─────────────────────────────────────────────────────

export type FileType = 'txt' | 'md' | 'pdf';
export type DocStatus = 'uploaded' | 'processing' | 'ready' | 'failed';

export interface Document {
  id: string;
  title: string;
  description?: string;
  fileName: string;
  fileType: FileType;
  fileSize: number;
  status: DocStatus;
  uploadedBy: Pick<User, 'id' | 'firstName' | 'lastName' | 'department'>;
  chunkCount: number;
  errorMessage?: string;
  createdAt: string;
  updatedAt: string;
}

// ─── Search ───────────────────────────────────────────────────────

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

// ─── API ──────────────────────────────────────────────────────────

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
  meta?: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface ApiError {
  success: false;
  error: {
    message: string;
    details?: unknown;
  };
}
