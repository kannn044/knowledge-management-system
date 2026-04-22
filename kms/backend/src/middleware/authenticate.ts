import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from '../utils/tokenUtils';
import { prisma } from '../config/database';
import { AppError } from './errorHandler';
import { AuthenticatedRequest, UserRole } from '../types';

/**
 * Middleware: verify JWT access token and attach user to request.
 * Requires Authorization: Bearer <token>
 */
export async function authenticateJWT(
  req: AuthenticatedRequest,
  _res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      throw new AppError('Authentication required', 401);
    }

    const token = authHeader.slice(7);
    const payload = verifyAccessToken(token);

    // Optionally validate user is still active in DB
    // (adds DB round-trip; skip if performance is critical — rely on short token expiry instead)
    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      include: { role: true },
      // Select only needed fields for efficiency
    });

    if (!user) throw new AppError('User not found', 401);
    if (user.status !== 'active') throw new AppError('Account is not active', 403);

    req.user = {
      id: user.id,
      email: user.email,
      role: user.role.name as UserRole,
      status: user.status,
    };

    next();
  } catch (error) {
    if (error instanceof AppError) {
      next(error);
    } else {
      next(new AppError('Invalid or expired token', 401));
    }
  }
}

/**
 * Middleware factory: require a minimum role level.
 * Role hierarchy: viewer(1) < staff(2) < admin(3)
 */
export function requireRole(...allowedRoles: UserRole[]) {
  return (req: AuthenticatedRequest, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(new AppError('Authentication required', 401));
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      next(new AppError('Insufficient permissions', 403));
      return;
    }

    next();
  };
}

/**
 * Middleware: require admin role shorthand.
 */
export const requireAdmin = requireRole('admin');

/**
 * Middleware: require staff or admin role.
 */
export const requireStaff = requireRole('staff', 'admin');
