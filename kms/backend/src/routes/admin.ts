/**
 * Admin routes — audit logs and system-level data.
 * All routes require admin role.
 */
import { Router, Response } from 'express';
import { authenticateJWT, requireAdmin } from '../middleware/authenticate';
import { prisma } from '../config/database';
import { logger } from '../config/logger';
import { AuthenticatedRequest } from '../types';

const router = Router();

router.use(authenticateJWT);
router.use(requireAdmin as any);

/**
 * GET /api/admin/audit-logs
 * Query params: page, limit, action, userId, resourceType, from, to
 */
router.get('/audit-logs', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const page = Math.max(1, parseInt((req.query.page as string) ?? '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt((req.query.limit as string) ?? '20', 10)));
    const skip = (page - 1) * limit;

    const action = req.query.action as string | undefined;
    const userId = req.query.userId as string | undefined;
    const resourceType = req.query.resourceType as string | undefined;
    const from = req.query.from as string | undefined;
    const to = req.query.to as string | undefined;

    const where: Record<string, unknown> = {};

    if (action) where.action = { contains: action, mode: 'insensitive' };
    if (userId) where.userId = userId;
    if (resourceType) where.resourceType = resourceType;

    if (from || to) {
      where.createdAt = {
        ...(from ? { gte: new Date(from) } : {}),
        ...(to ? { lte: new Date(to) } : {}),
      };
    }

    const [total, logs] = await Promise.all([
      prisma.auditLog.count({ where }),
      prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          user: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
            },
          },
        },
      }),
    ]);

    res.json({
      success: true,
      data: logs,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    logger.error('Failed to fetch audit logs', error);
    res.status(500).json({ success: false, error: { message: 'Failed to fetch audit logs' } });
  }
});

/**
 * GET /api/admin/audit-logs/actions
 * Returns distinct action names for filter dropdown.
 */
router.get('/audit-logs/actions', async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const rows = await prisma.auditLog.findMany({
      select: { action: true },
      distinct: ['action'],
      orderBy: { action: 'asc' },
    });
    res.json({ success: true, data: rows.map((r) => r.action) });
  } catch (error) {
    logger.error('Failed to fetch audit log actions', error);
    res.status(500).json({ success: false, error: { message: 'Failed to fetch actions' } });
  }
});

export default router;
