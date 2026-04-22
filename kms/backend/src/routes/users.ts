import { Router } from 'express';
import { z } from 'zod';
import { userController } from '../controllers/userController';
import { authenticateJWT, requireAdmin } from '../middleware/authenticate';
import { validate } from '../middleware/validate';
import { auditLog } from '../middleware/auditLog';
import { AuthenticatedRequest } from '../types';

const router = Router();

// All user routes require authentication
router.use(authenticateJWT);

// ─── Validation schemas ───────────────────────────────────────────

const updateProfileSchema = z.object({
  firstName: z.string().min(2).max(100).trim().optional(),
  lastName: z.string().min(2).max(100).trim().optional(),
  telephone: z.string().max(20).optional(),
  department: z.string().max(100).trim().optional(),
  jobTitle: z.string().max(100).trim().optional(),
});

const changeRoleSchema = z.object({
  role: z.enum(['admin', 'staff', 'viewer']),
});

// ─── Own profile routes ───────────────────────────────────────────

router.get('/profile', userController.getProfile as any);

router.put(
  '/profile',
  validate(updateProfileSchema),
  auditLog({ action: 'user.update_profile', resourceType: 'user' }),
  userController.updateProfile as any
);

// ─── Admin-only routes ────────────────────────────────────────────

router.get('/stats', requireAdmin, userController.getStats as any);
router.get('/pending', requireAdmin, userController.listPendingUsers as any);
router.get('/', requireAdmin, userController.listUsers as any);
router.get('/:id', requireAdmin, userController.getUserById as any);

router.patch(
  '/:id/approve',
  requireAdmin,
  auditLog({
    action: 'user.approve',
    resourceType: 'user',
    getResourceId: (req: AuthenticatedRequest) => req.params?.id,
  }),
  userController.approveUser as any
);

router.patch(
  '/:id/reject',
  requireAdmin,
  auditLog({
    action: 'user.reject',
    resourceType: 'user',
    getResourceId: (req: AuthenticatedRequest) => req.params?.id,
  }),
  userController.rejectUser as any
);

router.patch(
  '/:id/role',
  requireAdmin,
  validate(changeRoleSchema),
  auditLog({
    action: 'user.change_role',
    resourceType: 'user',
    getResourceId: (req: AuthenticatedRequest) => req.params?.id,
    getDetails: (req: AuthenticatedRequest) => ({ newRole: req.body.role }),
  }),
  userController.changeRole as any
);

router.patch(
  '/:id/disable',
  requireAdmin,
  auditLog({
    action: 'user.disable',
    resourceType: 'user',
    getResourceId: (req: AuthenticatedRequest) => req.params?.id,
  }),
  userController.disableUser as any
);

router.patch(
  '/:id/enable',
  requireAdmin,
  auditLog({
    action: 'user.enable',
    resourceType: 'user',
    getResourceId: (req: AuthenticatedRequest) => req.params?.id,
  }),
  userController.enableUser as any
);

export default router;
