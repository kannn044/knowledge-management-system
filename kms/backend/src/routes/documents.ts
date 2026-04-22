import { Router } from 'express';
import { documentController } from '../controllers/documentController';
import { authenticateJWT, requireStaff, requireAdmin } from '../middleware/authenticate';
import { uploadMiddleware } from '../middleware/upload';
import { uploadRateLimiter } from '../middleware/rateLimiter';
import { auditLog } from '../middleware/auditLog';
import { AuthenticatedRequest } from '../types';

const router = Router();

// All document routes require authentication
router.use(authenticateJWT);

// ─── Stats (admin) ────────────────────────────────────────────────
router.get('/stats', requireAdmin, documentController.getStats as any);

// ─── List documents (all authenticated users) ─────────────────────
router.get('/', documentController.list as any);

// ─── Upload (staff and admin) ─────────────────────────────────────
router.post(
  '/upload',
  requireStaff,
  uploadRateLimiter,
  uploadMiddleware.single('file'),
  auditLog({
    action: 'document.upload',
    resourceType: 'document',
    getDetails: (req: AuthenticatedRequest) => ({
      fileName: (req as any).file?.originalname,
      title: req.body.title,
    }),
  }),
  documentController.upload as any
);

// ─── Get/delete individual document ──────────────────────────────
router.get('/:id', documentController.getOne as any);

router.get('/:id/status', documentController.getStatus as any);

router.get('/:id/content', documentController.getContent as any);

router.delete(
  '/:id',
  requireStaff,
  auditLog({
    action: 'document.delete',
    resourceType: 'document',
    getResourceId: (req: AuthenticatedRequest) => req.params?.id,
  }),
  documentController.deleteOne as any
);

export default router;
