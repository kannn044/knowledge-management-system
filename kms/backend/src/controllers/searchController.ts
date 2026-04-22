import { Response } from 'express';
import { AuthenticatedRequest } from '../types';
import { searchService } from '../services/searchService';
import { logger } from '../config/logger';

export const searchController = {
  /**
   * POST /api/search
   * Body: { query, top_k?, filters?: { department?, file_type? } }
   */
  async search(req: AuthenticatedRequest, res: Response): Promise<void> {
    const { query, top_k, filters } = req.body as {
      query: string;
      top_k?: number;
      filters?: { department?: string; file_type?: string };
    };

    try {
      const result = await searchService.search({
        query: query.trim(),
        top_k: top_k ?? 10,
        filters,
        userId: req.user?.id,
      });

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      logger.error('Search failed', error);
      res.status(502).json({
        success: false,
        error: { message: 'Search service error. Please try again.' },
      });
    }
  },

  /**
   * GET /api/search/suggestions?type=department
   * Returns filter options for the search UI.
   */
  async getSuggestions(req: AuthenticatedRequest, res: Response): Promise<void> {
    const { type } = req.query as { type?: string };

    try {
      if (type === 'department') {
        const departments = await searchService.getDepartmentSuggestions();
        res.json({ success: true, data: { departments } });
        return;
      }

      // Default: return both department list and supported file types
      const departments = await searchService.getDepartmentSuggestions();
      res.json({
        success: true,
        data: {
          departments,
          fileTypes: ['pdf', 'txt', 'md'],
        },
      });
    } catch (error) {
      logger.error('Failed to fetch search suggestions', error);
      res.status(500).json({
        success: false,
        error: { message: 'Failed to load suggestions' },
      });
    }
  },
};
