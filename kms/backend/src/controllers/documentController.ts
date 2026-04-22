import { Request, Response, NextFunction } from 'express';
import path from 'path';
import { documentService } from '../services/documentService';
import { resolveFileType } from '../middleware/upload';
import { AuthenticatedRequest, FileType, DocStatus } from '../types';
import { AppError } from '../middleware/errorHandler';

export const documentController = {
  // POST /api/documents/upload
  async upload(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.file) {
        throw new AppError('No file provided', 400);
      }

      const { title, description } = req.body;
      if (!title?.trim()) {
        throw new AppError('Document title is required', 400);
      }

      const fileType = resolveFileType(req.file);
      const user = req.user!;

      // Fetch user's department for ChromaDB metadata
      const { prisma } = await import('../config/database');
      const userRecord = await prisma.user.findUnique({
        where: { id: user.id },
        select: { department: true },
      });

      const doc = await documentService.createDocument({
        title: title.trim(),
        description: description?.trim(),
        fileName: req.file.originalname,
        filePath: req.file.path,
        fileType,
        fileSize: req.file.size,
        uploadedById: user.id,
        department: userRecord?.department,
      });

      res.status(201).json({
        success: true,
        data: doc,
        message: 'Document uploaded and queued for processing',
      });
    } catch (error) {
      next(error);
    }
  },

  // GET /api/documents
  async list(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { status, file_type, search, page, limit, mine } = req.query as Record<string, string>;

      const result = await documentService.listDocuments({
        status: status as DocStatus,
        fileType: file_type as FileType,
        search,
        uploadedById: mine === 'true' ? req.user!.id : undefined,
        page: page ? parseInt(page) : undefined,
        limit: limit ? parseInt(limit) : undefined,
      });

      res.json({ success: true, ...result });
    } catch (error) {
      next(error);
    }
  },

  // GET /api/documents/:id
  async getOne(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const doc = await documentService.getDocument(req.params.id);
      res.json({ success: true, data: doc });
    } catch (error) {
      next(error);
    }
  },

  // GET /api/documents/:id/status
  async getStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const status = await documentService.getDocumentStatus(req.params.id);
      res.json({ success: true, data: status });
    } catch (error) {
      next(error);
    }
  },

  // GET /api/documents/:id/content
  async getContent(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const content = await documentService.getDocumentContent(req.params.id, req.user!.id);
      res.json({ success: true, data: { content } });
    } catch (error) {
      next(error);
    }
  },

  // DELETE /api/documents/:id
  async deleteOne(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      await documentService.deleteDocument(req.params.id, {
        id: req.user!.id,
        role: req.user!.role,
      });
      res.json({ success: true, message: 'Document deleted' });
    } catch (error) {
      next(error);
    }
  },

  // GET /api/documents/stats
  async getStats(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const stats = await documentService.getDocumentStats();
      res.json({ success: true, data: stats });
    } catch (error) {
      next(error);
    }
  },
};
