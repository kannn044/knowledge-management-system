import { Router } from 'express';
import passport from 'passport';
import { z } from 'zod';
import { authController } from '../controllers/authController';
import { authenticateJWT } from '../middleware/authenticate';
import { authRateLimiter } from '../middleware/rateLimiter';
import { validate } from '../middleware/validate';
import { auditLog } from '../middleware/auditLog';
import { AuthenticatedRequest } from '../types';

const router = Router();

// ─── Validation schemas ───────────────────────────────────────────

const registerSchema = z.object({
  email: z.string().email().max(255),
  password: z
    .string()
    .min(8)
    .regex(/[A-Z]/, 'Must contain at least one uppercase letter')
    .regex(/[0-9]/, 'Must contain at least one number'),
  firstName: z.string().min(2).max(100).trim(),
  lastName: z.string().min(2).max(100).trim(),
  telephone: z.string().max(20).optional(),
  department: z.string().max(100).trim().optional(),
  jobTitle: z.string().max(100).trim().optional(),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const forgotPasswordSchema = z.object({
  email: z.string().email(),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z
    .string()
    .min(8)
    .regex(/[A-Z]/, 'Must contain uppercase')
    .regex(/[0-9]/, 'Must contain a number'),
});

// ─── Public routes ────────────────────────────────────────────────

router.post(
  '/register',
  authRateLimiter,
  validate(registerSchema),
  auditLog({ action: 'user.register', resourceType: 'user' }),
  authController.register
);

router.post(
  '/login',
  authRateLimiter,
  validate(loginSchema),
  auditLog({
    action: 'user.login',
    resourceType: 'user',
    getDetails: (req: AuthenticatedRequest) => ({ email: req.body.email }),
  }),
  authController.login
);

router.get(
  '/verify-email/:token',
  authController.verifyEmail
);

router.post(
  '/forgot-password',
  authRateLimiter,
  validate(forgotPasswordSchema),
  authController.forgotPassword
);

router.post('/refresh', authController.refresh);

// ─── Google OAuth ─────────────────────────────────────────────────

router.get(
  '/google',
  passport.authenticate('google', { scope: ['profile', 'email'], session: false })
);

router.get(
  '/google/callback',
  passport.authenticate('google', { session: false, failureRedirect: '/login' }),
  authController.googleCallback
);

// ─── Protected routes ─────────────────────────────────────────────

router.post(
  '/logout',
  authenticateJWT,
  auditLog({ action: 'user.logout', resourceType: 'user' }),
  authController.logout as any
);

router.post(
  '/change-password',
  authenticateJWT,
  validate(changePasswordSchema),
  auditLog({ action: 'user.change_password', resourceType: 'user' }),
  authController.changePassword as any
);

export default router;
