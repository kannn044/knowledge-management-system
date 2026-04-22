/**
 * HTTP client for communicating with the Python FastAPI microservice.
 */
import axios, { AxiosError } from 'axios';
import { env } from '../config/env';
import { logger } from '../config/logger';

const client = axios.create({
  baseURL: env.PYTHON_SERVICE_URL,
  timeout: 30_000,
  headers: {
    'Content-Type': 'application/json',
    'x-internal-secret': env.INTERNAL_API_SECRET,
  },
});

export interface ProcessDocumentPayload {
  document_id: string;
  file_path: string;
  file_type: 'txt' | 'md' | 'pdf';
  title: string;
  metadata: {
    uploaded_by: string;
    department?: string | null;
  };
}

export interface SearchPayload {
  query: string;
  top_k?: number;
  filters?: {
    department?: string;
    file_type?: string;
  };
}

export const pythonClient = {
  /**
   * Send a document to the Python service for processing.
   * Processing runs asynchronously — Python calls back via /api/internal/callback.
   */
  async processDocument(payload: ProcessDocumentPayload): Promise<{ accepted: boolean }> {
    try {
      const res = await client.post('/process/', payload);
      return res.data;
    } catch (error) {
      const msg = (error as AxiosError<{ detail: string }>)?.response?.data?.detail
        ?? (error as Error).message;
      logger.error(`Python process request failed: ${msg}`);
      throw new Error(`Processing service unavailable: ${msg}`);
    }
  },

  /**
   * Perform a semantic search via the Python service.
   */
  async search(payload: SearchPayload) {
    try {
      const res = await client.post('/search/', payload);
      return res.data;
    } catch (error) {
      const msg = (error as AxiosError<{ detail: string }>)?.response?.data?.detail
        ?? (error as Error).message;
      logger.error(`Python search request failed: ${msg}`);
      throw new Error(`Search service unavailable: ${msg}`);
    }
  },

  /**
   * Ask Python to delete all ChromaDB chunks for a document.
   */
  async deleteDocument(documentId: string): Promise<void> {
    try {
      await client.delete(`/process/${documentId}`);
    } catch (error) {
      // Log but don't throw — DB cleanup should still proceed
      logger.warn(`Failed to delete ChromaDB entries for ${documentId}`, error);
    }
  },

  /**
   * Health check for the Python service.
   */
  async healthCheck(): Promise<boolean> {
    try {
      const res = await client.get('/health', { timeout: 5000 });
      return res.status === 200;
    } catch {
      return false;
    }
  },
};
