import api from './api';
import { SearchResult, SearchQuery, FileType, ApiResponse } from '@/types';

export interface SearchResponse {
  results: SearchResult[];
  total: number;
  query_time_ms: number;
}

export interface SearchSuggestions {
  departments: string[];
  fileTypes: FileType[];
}

export const searchApi = {
  /**
   * Perform a semantic search against the knowledge base.
   */
  search: async (payload: SearchQuery): Promise<SearchResponse> => {
    const res = await api.post<ApiResponse<SearchResponse>>('/search', payload);
    return res.data.data!;
  },

  /**
   * Get available filter options (departments, file types).
   */
  getSuggestions: async (): Promise<SearchSuggestions> => {
    const res = await api.get<ApiResponse<SearchSuggestions>>('/search/suggestions');
    return res.data.data!;
  },

  /**
   * Fetch paginated audit logs (admin only).
   */
  getAuditLogs: async (params?: {
    page?: number;
    limit?: number;
    action?: string;
    userId?: string;
    resourceType?: string;
    from?: string;
    to?: string;
  }) => {
    const res = await api.get('/admin/audit-logs', { params });
    return res.data as {
      success: boolean;
      data: AuditLog[];
      meta: { total: number; page: number; limit: number; totalPages: number };
    };
  },

  getAuditLogActions: async (): Promise<string[]> => {
    const res = await api.get<ApiResponse<string[]>>('/admin/audit-logs/actions');
    return res.data.data ?? [];
  },
};

// ─── AuditLog type ────────────────────────────────────────────────

export interface AuditLog {
  id: string;
  userId: string | null;
  action: string;
  resourceType: string | null;
  resourceId: string | null;
  details: Record<string, unknown> | null;
  ipAddress: string | null;
  createdAt: string;
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
  } | null;
}
