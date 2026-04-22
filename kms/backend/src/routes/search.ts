import { Router } from 'express';
import { z } from 'zod';
import { searchController } from '../controllers/searchController';
import { authenticateJWT } from '../middleware/authenticate';
import { validate } from '../middleware/validate';
import { searchRateLimiter } from '../middleware/rateLimiter';

const router = Router();

// All search routes require authentication
router.use(authenticateJWT);

// ─── Validation ───────────────────────────────────────────────────

const searchSchema = z.object({
  query: z.string().min(2, 'Query must be at least 2 characters').max(500).trim(),
  top_k: z.number().int().min(1).max(50).optional(),
  filters: z
    .object({
      department: z.string().max(100).optional(),
      file_type: z.enum(['pdf', 'txt', 'md']).optional(),
    })
    .optional(),
});

// ─── Routes ───────────────────────────────────────────────────────

/**
 * POST /api/search
 * Perform a semantic search across all ready documents.
 */
router.post(
  '/',
  searchRateLimiter,
  validate(searchSchema),
  searchController.search as any
);

/**
 * GET /api/search/suggestions
 * Returns available filter options (departments, file types).
 */
router.get('/suggestions', searchController.getSuggestions as any);

export default router;
