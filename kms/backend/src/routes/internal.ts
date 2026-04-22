/**
 * Internal routes — called by Python microservice only.
 * Protected by a shared secret (internal API key), NOT JWT.
 */
import { Router, Request, Response } from 'express';
import { prisma } from '../config/database';
import { logger } from '../config/logger';
import { env } from '../config/env';

const router = Router();

// Simple shared-secret middleware for internal routes
function requireInternalSecret(req: Request, res: Response, next: Function): void {
  const secret = req.headers['x-internal-secret'];
  const expected = env.INTERNAL_API_SECRET;
  if (secret !== expected) {
    res.status(403).json({ success: false, error: { message: 'Forbidden' } });
    return;
  }
  next();
}

/**
 * POST /api/internal/callback
 * Called by Python service when document processing completes.
 */
router.post('/callback', requireInternalSecret, async (req: Request, res: Response) => {
  const { document_id, status, chunk_count, chroma_collection, error_message } = req.body;

  if (!document_id || !status) {
    res.status(400).json({ success: false, error: { message: 'Missing document_id or status' } });
    return;
  }

  try {
    await prisma.document.update({
      where: { id: document_id },
      data: {
        status,
        chunkCount: chunk_count ?? 0,
        chromaCollection: chroma_collection,
        errorMessage: error_message,
      },
    });

    logger.info(`Document ${document_id} status updated to: ${status}`);
    res.json({ success: true });
  } catch (error) {
    logger.error(`Failed to update document status for ${document_id}`, error);
    res.status(500).json({ success: false, error: { message: 'Update failed' } });
  }
});

export default router;
