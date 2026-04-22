import { Request, Response, NextFunction } from 'express';
import { Profile as GoogleProfile } from 'passport-google-oauth20';
import { authService, REFRESH_TOKEN_COOKIE } from '../services/authService';
import { AuthenticatedRequest } from '../types';
import { env } from '../config/env';

export const authController = {
  // POST /api/auth/register
  async register(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await authService.register(req.body);
      res.status(201).json({
        success: true,
        message: 'Registration successful. Please check your email to verify your account.',
      });
    } catch (error) {
      next(error);
    }
  },

  // POST /api/auth/login
  async login(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { email, password } = req.body;
      const result = await authService.login(email, password, res);

      // Check if forced password change is required
      const requiresChange = await authService.requiresPasswordChange(result.user.id);

      res.json({
        success: true,
        data: {
          ...result,
          requiresPasswordChange: requiresChange,
        },
      });
    } catch (error) {
      next(error);
    }
  },

  // GET /api/auth/google — redirect to Google
  googleAuth(req: Request, res: Response): void {
    // Handled by Passport middleware in routes
    res.redirect('/api/auth/google/start');
  },

  // GET /api/auth/google/callback — Google OAuth callback
  async googleCallback(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const profile = req.user as GoogleProfile;

      if (!profile?.emails?.[0]?.value) {
        res.redirect(`${env.FRONTEND_URL}/login?error=google_no_email`);
        return;
      }

      const email = profile.emails[0].value;
      const firstName = profile.name?.givenName ?? 'User';
      const lastName = profile.name?.familyName ?? '';
      const avatarUrl = profile.photos?.[0]?.value ?? null;

      const result = await authService.googleLogin(
        profile.id,
        email,
        firstName,
        lastName,
        avatarUrl,
        res
      );

      // Redirect to frontend with access token (frontend stores in sessionStorage)
      res.redirect(
        `${env.FRONTEND_URL}/auth/callback?token=${result.accessToken}`
      );
    } catch (error: unknown) {
      const msg = encodeURIComponent((error as Error).message);
      res.redirect(`${env.FRONTEND_URL}/login?error=${msg}`);
    }
  },

  // POST /api/auth/refresh
  async refresh(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const refreshToken = req.cookies?.[REFRESH_TOKEN_COOKIE];
      if (!refreshToken) {
        res.status(401).json({ success: false, error: { message: 'No refresh token provided' } });
        return;
      }

      const { accessToken } = await authService.refreshToken(refreshToken, res);
      res.json({ success: true, data: { accessToken } });
    } catch (error) {
      next(error);
    }
  },

  // POST /api/auth/logout
  async logout(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const refreshToken = req.cookies?.[REFRESH_TOKEN_COOKIE];
      await authService.logout(refreshToken, res);
      res.json({ success: true, message: 'Logged out successfully' });
    } catch (error) {
      next(error);
    }
  },

  // GET /api/auth/verify-email/:token
  async verifyEmail(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await authService.verifyEmail(req.params.token);
      res.json({
        success: true,
        message: 'Email verified successfully. Your account is pending admin approval.',
      });
    } catch (error) {
      next(error);
    }
  },

  // POST /api/auth/forgot-password
  async forgotPassword(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await authService.forgotPassword(req.body.email);
      // Always return success to prevent email enumeration
      res.json({
        success: true,
        message: 'If an account exists, a temporary password has been sent.',
      });
    } catch (error) {
      next(error);
    }
  },

  // POST /api/auth/change-password
  async changePassword(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { currentPassword, newPassword } = req.body;
      await authService.changePassword(req.user!.id, currentPassword, newPassword);
      res.json({ success: true, message: 'Password changed successfully.' });
    } catch (error) {
      next(error);
    }
  },
};
