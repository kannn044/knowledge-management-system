import api from './api';
import { Document, DocStatus, FileType, ApiResponse } from '@/types';

export interface DocumentListResponse {
  success: boolean;
  documents: Document[];
  meta: { total: number; page: number; limit: number; totalPages: number };
}

export interface DocumentStatus {
  id: string;
  status: DocStatus;
  chunkCount: number;
  errorMessage: string | null;
  updatedAt: string;
}

export interface DocumentStats {
  totalDocuments: number;
  byStatus: { status: string; count: number }[];
  byType: { type: string; count: number }[];
  recentUploads: Document[];
}

export const documentApi = {
  upload: async (
    file: File,
    title: string,
    description?: string,
    onProgress?: (pct: number) => void
  ): Promise<Document> => {
    const form = new FormData();
    form.append('file', file);
    form.append('title', title);
    if (description) form.append('description', description);

    const res = await api.post<ApiResponse<Document>>('/documents/upload', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: (e) => {
        if (e.total) onProgress?.(Math.round((e.loaded / e.total) * 100));
      },
    });
    return res.data.data!;
  },

  list: async (params?: {
    status?: DocStatus;
    file_type?: FileType;
    search?: string;
    page?: number;
    limit?: number;
    mine?: boolean;
  }): Promise<DocumentListResponse> => {
    const res = await api.get('/documents', { params });
    return res.data;
  },

  getOne: async (id: string): Promise<Document> => {
    const res = await api.get<ApiResponse<Document>>(`/documents/${id}`);
    return res.data.data!;
  },

  getStatus: async (id: string): Promise<DocumentStatus> => {
    const res = await api.get<ApiResponse<DocumentStatus>>(`/documents/${id}/status`);
    return res.data.data!;
  },

  getContent: async (id: string): Promise<string> => {
    const res = await api.get<ApiResponse<{ content: string }>>(`/documents/${id}/content`);
    return res.data.data!.content;
  },

  delete: async (id: string): Promise<void> => {
    await api.delete(`/documents/${id}`);
  },

  getStats: async (): Promise<DocumentStats> => {
    const res = await api.get<ApiResponse<DocumentStats>>('/documents/stats');
    return res.data.data!;
  },
};
