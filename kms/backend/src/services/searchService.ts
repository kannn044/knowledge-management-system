/**
 * Search service — forwards query to Python microservice, then enriches
 * each result with document metadata from PostgreSQL.
 */
import { pythonClient, SearchPayload } from './pythonClient';
import { prisma } from '../config/database';
import { logger } from '../config/logger';
import { SearchResult, SearchResponse, FileType } from '../types';

export interface SearchOptions {
  query: string;
  top_k?: number;
  filters?: {
    department?: string;
    file_type?: FileType;
  };
  userId?: string;
}

interface PythonSearchResult {
  document_id: string;
  chunk_text: string;
  similarity_score: number;
  metadata: {
    title?: string;
    file_type?: string;
    department?: string;
    uploaded_by?: string;
    chunk_index?: number;
  };
}

interface PythonSearchResponse {
  results: PythonSearchResult[];
  total: number;
  query_time_ms: number;
}

export const searchService = {
  /**
   * Perform a semantic search.
   * 1. Forward query + filters to Python /search/ endpoint
   * 2. Enrich returned document_ids with full metadata from PostgreSQL
   * 3. Return unified SearchResponse
   */
  async search(options: SearchOptions): Promise<SearchResponse> {
    const { query, top_k = 10, filters, userId } = options;

    const payload: SearchPayload = {
      query,
      top_k,
      ...(filters && Object.keys(filters).length > 0 && { filters }),
    };

    // ── Call Python search service ─────────────────────────────────
    const pythonResponse = (await pythonClient.search(payload)) as PythonSearchResponse;

    if (!pythonResponse.results || pythonResponse.results.length === 0) {
      return { results: [], total: 0, query_time_ms: pythonResponse.query_time_ms ?? 0 };
    }

    // ── Collect unique document IDs for DB enrichment ──────────────
    const documentIds = [...new Set(pythonResponse.results.map((r) => r.document_id))];

    const documents = await prisma.document.findMany({
      where: {
        id: { in: documentIds },
        status: 'ready',
      },
      select: {
        id: true,
        title: true,
        fileType: true,
        createdAt: true,
        uploadedBy: {
          select: {
            firstName: true,
            lastName: true,
            email: true,
            department: true,
          },
        },
      },
    });

    const docMap = new Map(documents.map((d) => [d.id, d]));

    // ── Merge Python results with PostgreSQL data ──────────────────
    const enrichedResults: SearchResult[] = [];

    for (const r of pythonResponse.results) {
      const doc = docMap.get(r.document_id);

      // Skip results for documents that were deleted or are not ready
      if (!doc) {
        logger.debug(`Search: skipping result for unknown/non-ready document ${r.document_id}`);
        continue;
      }

      const uploaderName = doc.uploadedBy
        ? `${doc.uploadedBy.firstName} ${doc.uploadedBy.lastName}`.trim() || doc.uploadedBy.email
        : 'Unknown';

      enrichedResults.push({
        document_id: r.document_id,
        title: doc.title,
        chunk_text: r.chunk_text,
        similarity_score: r.similarity_score,
        file_type: (doc.fileType as FileType) ?? r.metadata?.file_type ?? 'txt',
        department: doc.uploadedBy?.department ?? r.metadata?.department ?? undefined,
        uploaded_by: uploaderName,
        created_at: doc.createdAt.toISOString(),
      });
    }

    // ── Log search to audit_logs ───────────────────────────────────
    if (userId) {
      prisma.auditLog
        .create({
          data: {
            userId,
            action: 'document.search',
            resourceType: 'search',
            details: {
              query,
              top_k,
              filters,
              result_count: enrichedResults.length,
            },
          },
        })
        .catch((err) => logger.error('Failed to log search audit event', err));
    }

    return {
      results: enrichedResults,
      total: enrichedResults.length,
      query_time_ms: pythonResponse.query_time_ms ?? 0,
    };
  },

  /**
   * Return distinct departments that have at least one ready document.
   * Used for filter dropdown suggestions.
   */
  async getDepartmentSuggestions(): Promise<string[]> {
    const rows = await prisma.document.findMany({
      where: {
        status: 'ready',
        department: { not: null },
      },
      select: { department: true },
      distinct: ['department'],
      orderBy: { department: 'asc' },
    });

    return rows.map((r) => r.department).filter((d): d is string => Boolean(d));
  },
};
