import { prisma } from '../config/database';
import { storageService } from './storageService';
import { pythonClient } from './pythonClient';
import { enqueueDocument } from './queueService';
import { AppError } from '../middleware/errorHandler';
import { logger } from '../config/logger';
import { FileType, DocStatus } from '../types';

export interface CreateDocumentInput {
  title: string;
  description?: string;
  fileName: string;
  filePath: string;
  fileType: FileType;
  fileSize: number;
  uploadedById: string;
  department?: string | null;
}

export interface DocumentListFilters {
  status?: DocStatus;
  fileType?: FileType;
  search?: string;
  uploadedById?: string;
  page?: number;
  limit?: number;
}

const DOCUMENT_SELECT = {
  id: true,
  title: true,
  description: true,
  fileName: true,
  filePath: true,
  fileType: true,
  fileSize: true,
  status: true,
  chunkCount: true,
  chromaCollection: true,
  errorMessage: true,
  createdAt: true,
  updatedAt: true,
  uploadedBy: {
    select: { id: true, firstName: true, lastName: true, department: true },
  },
};

export const documentService = {
  // ── Create document record + enqueue processing ───────────────
  async createDocument(input: CreateDocumentInput) {
    const doc = await prisma.document.create({
      data: {
        title: input.title,
        description: input.description,
        fileName: input.fileName,
        filePath: input.filePath,
        fileType: input.fileType,
        fileSize: input.fileSize,
        uploadedById: input.uploadedById,
        status: 'uploaded',
      },
      select: DOCUMENT_SELECT,
    });

    // Enqueue for async processing
    await enqueueDocument({
      document_id: doc.id,
      file_path: input.filePath,
      file_type: input.fileType,
      title: input.title,
      metadata: {
        uploaded_by: input.uploadedById,
        department: input.department,
      },
    });

    logger.info(`Document created and queued: ${doc.id} (${input.fileName})`);
    return this._formatDoc(doc);
  },

  // ── List documents ────────────────────────────────────────────
  async listDocuments(filters: DocumentListFilters = {}) {
    const { status, fileType, search, uploadedById, page = 1, limit = 20 } = filters;
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};
    if (status) where.status = status;
    if (fileType) where.fileType = fileType;
    if (uploadedById) where.uploadedById = uploadedById;
    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { fileName: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [docs, total] = await prisma.$transaction([
      prisma.document.findMany({
        where,
        select: DOCUMENT_SELECT,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.document.count({ where }),
    ]);

    return {
      documents: docs.map((d) => this._formatDoc(d)),
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  },

  // ── Get single document ───────────────────────────────────────
  async getDocument(docId: string) {
    const doc = await prisma.document.findUnique({
      where: { id: docId },
      select: DOCUMENT_SELECT,
    });
    if (!doc) throw new AppError('Document not found', 404);
    return this._formatDoc(doc);
  },

  // ── Get document processing status ───────────────────────────
  async getDocumentStatus(docId: string) {
    const doc = await prisma.document.findUnique({
      where: { id: docId },
      select: { id: true, status: true, chunkCount: true, errorMessage: true, updatedAt: true },
    });
    if (!doc) throw new AppError('Document not found', 404);
    return doc;
  },

  // ── Get extracted text content ────────────────────────────────
  async getDocumentContent(docId: string, requestingUserId: string) {
    const doc = await prisma.document.findUnique({
      where: { id: docId },
      select: { filePath: true, status: true },
    });
    if (!doc) throw new AppError('Document not found', 404);
    if (doc.status !== 'ready') {
      throw new AppError(`Document is not ready (status: ${doc.status})`, 409);
    }
    return storageService.readExtractedText(doc.filePath);
  },

  // ── Delete document ───────────────────────────────────────────
  async deleteDocument(docId: string, requestingUser: { id: string; role: string }) {
    const doc = await prisma.document.findUnique({
      where: { id: docId },
      select: { id: true, uploadedById: true, filePath: true, title: true },
    });
    if (!doc) throw new AppError('Document not found', 404);

    // Only owner or admin can delete
    if (doc.uploadedById !== requestingUser.id && requestingUser.role !== 'admin') {
      throw new AppError('You do not have permission to delete this document', 403);
    }

    // Remove from ChromaDB (best effort)
    await pythonClient.deleteDocument(docId);

    // Remove from DB
    await prisma.document.delete({ where: { id: docId } });

    // Remove file from disk
    storageService.deleteFile(doc.filePath);

    logger.info(`Document ${docId} deleted by user ${requestingUser.id}`);
  },

  // ── Admin: dashboard stats ────────────────────────────────────
  async getDocumentStats() {
    const [total, byStatus, byType, recentUploads] = await prisma.$transaction([
      prisma.document.count(),
      prisma.document.groupBy({
        by: ['status'],
        _count: true,
      }),
      prisma.document.groupBy({
        by: ['fileType'],
        _count: true,
      }),
      prisma.document.findMany({
        select: DOCUMENT_SELECT,
        orderBy: { createdAt: 'desc' },
        take: 5,
      }),
    ]);

    return {
      totalDocuments: total,
      byStatus: byStatus.map((s) => ({ status: s.status, count: s._count })),
      byType: byType.map((t) => ({ type: t.fileType, count: t._count })),
      recentUploads: recentUploads.map((d) => this._formatDoc(d)),
    };
  },

  // ─── Format helper ───────────────────────────────────────────
  _formatDoc(doc: {
    id: string;
    title: string;
    description: string | null;
    fileName: string;
    filePath: string;
    fileType: string;
    fileSize: bigint;
    status: string;
    chunkCount: number;
    chromaCollection: string | null;
    errorMessage: string | null;
    createdAt: Date;
    updatedAt: Date;
    uploadedBy: { id: string; firstName: string; lastName: string; department: string | null };
  }) {
    return {
      id: doc.id,
      title: doc.title,
      description: doc.description,
      fileName: doc.fileName,
      filePath: doc.filePath,
      fileType: doc.fileType as FileType,
      fileSize: Number(doc.fileSize),
      status: doc.status as DocStatus,
      chunkCount: doc.chunkCount,
      chromaCollection: doc.chromaCollection,
      errorMessage: doc.errorMessage,
      createdAt: doc.createdAt.toISOString(),
      updatedAt: doc.updatedAt.toISOString(),
      uploadedBy: {
        id: doc.uploadedBy.id,
        firstName: doc.uploadedBy.firstName,
        lastName: doc.uploadedBy.lastName,
        department: doc.uploadedBy.department,
      },
    };
  },
};
