import { Response, NextFunction } from 'express';
import { prisma } from '../config/database';
import { AuthenticatedRequest } from '../types';
import { logger } from '../config/logger';

interface AuditOptions {
  action: string;
  resourceType?: string;
  getResourceId?: (req: AuthenticatedRequest) => string | undefined;
  getDetails?: (req: AuthenticatedRequest) => Record<string, unknown>;
}

/**
 * Middleware factory: write to audit_logs after the response is sent.
 * Fire-and-forget — does not block the response.
 */
export function auditLog(options: AuditOptions) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    res.on('finish', () => {
      if (res.statusCode >= 400) return; // Don't log failed requests

      const resourceId = options.getResourceId?.(req);
      const details = options.getDetails?.(req);

      prisma.auditLog
        .create({
          data: {
            userId: req.user?.id,
            action: options.action,
            resourceType: options.resourceType,
            resourceId: resourceId,
            details: details as Record<string, unknown>,
            ipAddress: req.ip,
          },
        })
        .catch((err) => logger.error('Audit log write failed', err));
    });

    next();
  };
}
