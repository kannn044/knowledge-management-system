import bcrypt from 'bcryptjs';
import { prisma } from '../config/database';
import { redis } from '../config/redis';
import { emailService } from './emailService';
import { AppError } from '../middleware/errorHandler';
import { logger } from '../config/logger';
import {
  generateAccessToken,
  generateRefreshToken,
  generateSecureToken,
  hashToken,
  getRefreshTokenExpiry,
  getEmailVerificationExpiry,
  verifyRefreshToken,
} from '../utils/tokenUtils';
import { UserRole } from '../types';

const SALT_ROUNDS = 12;
const REFRESH_TOKEN_COOKIE = 'kms_refresh_token';

// ─── Types ────────────────────────────────────────────────────────

export interface RegisterInput {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  telephone?: string;
  department?: string;
  jobTitle?: string;
}

interface AuthResult {
  accessToken: string;
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    role: UserRole;
    status: string;
    avatarUrl: string | null;
  };
}

// ─── Service ─────────────────────────────────────────────────────

export const authService = {
  // ── Register new user ─────────────────────────────────────────
  async register(input: RegisterInput): Promise<void> {
    const existing = await prisma.user.findUnique({ where: { email: input.email } });
    if (existing) {
      throw new AppError('An account with this email already exists', 409);
    }

    const passwordHash = await bcrypt.hash(input.password, SALT_ROUNDS);

    const user = await prisma.user.create({
      data: {
        email: input.email,
        passwordHash,
        firstName: input.firstName,
        lastName: input.lastName,
        telephone: input.telephone,
        department: input.department,
        jobTitle: input.jobTitle,
        roleId: 3, // viewer by default
        status: 'pending',
        emailVerified: false,
      },
    });

    // Generate email verification token
    const verificationToken = generateSecureToken();
    await prisma.emailVerificationToken.create({
      data: {
        userId: user.id,
        token: verificationToken,
        expiresAt: getEmailVerificationExpiry(),
      },
    });

    await emailService.sendVerificationEmail(
      user.email,
      `${user.firstName} ${user.lastName}`,
      verificationToken
    );

    logger.info(`New user registered: ${user.email}`);
  },

  // ── Login with email/password ─────────────────────────────────
  async login(
    email: string,
    password: string,
    res: import('express').Response
  ): Promise<AuthResult> {
    const user = await prisma.user.findUnique({
      where: { email },
      include: { role: true },
    });

    if (!user || !user.passwordHash) {
      throw new AppError('Invalid email or password', 401);
    }

    const passwordValid = await bcrypt.compare(password, user.passwordHash);
    if (!passwordValid) {
      throw new AppError('Invalid email or password', 401);
    }

    if (!user.emailVerified) {
      throw new AppError('Please verify your email address before logging in', 403);
    }

    if (user.status === 'pending') {
      throw new AppError('Your email is not verified yet', 403);
    }

    if (user.status === 'waiting') {
      throw new AppError('Your account is pending admin approval', 403);
    }

    if (user.status === 'disabled') {
      throw new AppError('Your account has been disabled. Contact an administrator.', 403);
    }

    return this._issueTokens(user, res);
  },

  // ── Google OAuth login/register ───────────────────────────────
  async googleLogin(
    googleId: string,
    email: string,
    firstName: string,
    lastName: string,
    avatarUrl: string | null,
    res: import('express').Response
  ): Promise<AuthResult> {
    let user = await prisma.user.findFirst({
      where: { OR: [{ googleId }, { email }] },
      include: { role: true },
    });

    if (!user) {
      // Auto-register from Google — still requires admin approval
      user = await prisma.user.create({
        data: {
          email,
          googleId,
          firstName,
          lastName,
          avatarUrl,
          roleId: 3,
          status: 'waiting', // Skip email verification — Google already verified it
          emailVerified: true,
        },
        include: { role: true },
      });
      logger.info(`New Google OAuth user: ${email}`);
    } else if (!user.googleId) {
      // Link Google to existing account
      user = await prisma.user.update({
        where: { id: user.id },
        data: { googleId, avatarUrl: avatarUrl ?? user.avatarUrl },
        include: { role: true },
      });
    }

    if (user.status === 'pending' || user.status === 'waiting') {
      throw new AppError('Your account is pending admin approval', 403);
    }
    if (user.status === 'disabled') {
      throw new AppError('Your account has been disabled', 403);
    }

    return this._issueTokens(user, res);
  },

  // ── Verify email token ────────────────────────────────────────
  async verifyEmail(token: string): Promise<void> {
    const record = await prisma.emailVerificationToken.findUnique({
      where: { token },
      include: { user: true },
    });

    if (!record) throw new AppError('Invalid or expired verification link', 400);
    if (record.used) throw new AppError('This verification link has already been used', 400);
    if (record.expiresAt < new Date()) throw new AppError('Verification link has expired', 400);

    await prisma.$transaction([
      prisma.emailVerificationToken.update({
        where: { id: record.id },
        data: { used: true },
      }),
      prisma.user.update({
        where: { id: record.userId },
        data: { emailVerified: true, status: 'waiting' },
      }),
    ]);

    logger.info(`Email verified for user: ${record.user.email}`);
  },

  // ── Refresh access token ──────────────────────────────────────
  async refreshToken(
    refreshToken: string,
    res: import('express').Response
  ): Promise<{ accessToken: string }> {
    let payload;
    try {
      payload = verifyRefreshToken(refreshToken);
    } catch {
      throw new AppError('Invalid or expired refresh token', 401);
    }

    const tokenHash = hashToken(refreshToken);
    const stored = await prisma.refreshToken.findFirst({
      where: { tokenHash, userId: payload.sub },
    });

    if (!stored || stored.expiresAt < new Date()) {
      throw new AppError('Refresh token not found or expired', 401);
    }

    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      include: { role: true },
    });

    if (!user || user.status !== 'active') {
      throw new AppError('User not found or inactive', 401);
    }

    // Token rotation — delete old, issue new
    await prisma.refreshToken.delete({ where: { id: stored.id } });

    const result = await this._issueTokens(user, res);
    return { accessToken: result.accessToken };
  },

  // ── Logout ────────────────────────────────────────────────────
  async logout(refreshToken: string | undefined, res: import('express').Response): Promise<void> {
    if (refreshToken) {
      const tokenHash = hashToken(refreshToken);
      await prisma.refreshToken.deleteMany({ where: { tokenHash } }).catch(() => {});
    }

    res.clearCookie(REFRESH_TOKEN_COOKIE, {
      httpOnly: true,
      secure: true,
      sameSite: 'strict',
    });
  },

  // ── Forgot password ───────────────────────────────────────────
  async forgotPassword(email: string): Promise<void> {
    const user = await prisma.user.findUnique({ where: { email } });
    // Always return success to prevent email enumeration
    if (!user || user.status !== 'active') return;

    // Generate a temporary 12-char password
    const tempPassword = generateSecureToken(6).toUpperCase().slice(0, 12);
    const passwordHash = await bcrypt.hash(tempPassword, SALT_ROUNDS);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        // Force password change on next login via a Redis flag
      },
    });

    // Flag: require password change on next login
    await redis.setex(`force_pw_change:${user.id}`, 60 * 60 * 24, '1'); // 24h

    await emailService.sendPasswordResetEmail(
      user.email,
      `${user.firstName} ${user.lastName}`,
      tempPassword
    );

    logger.info(`Temporary password sent to: ${email}`);
  },

  // ── Change password ───────────────────────────────────────────
  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string
  ): Promise<void> {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.passwordHash) throw new AppError('User not found', 404);

    const valid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!valid) throw new AppError('Current password is incorrect', 400);

    const newHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
    await prisma.user.update({ where: { id: userId }, data: { passwordHash: newHash } });

    // Clear forced password change flag
    await redis.del(`force_pw_change:${userId}`);
    logger.info(`Password changed for user: ${userId}`);
  },

  // ── Check if password change is required ──────────────────────
  async requiresPasswordChange(userId: string): Promise<boolean> {
    const flag = await redis.get(`force_pw_change:${userId}`);
    return flag === '1';
  },

  // ─── Internal helpers ────────────────────────────────────────
  async _issueTokens(
    user: { id: string; email: string; role: { name: string }; firstName: string; lastName: string; status: string; avatarUrl: string | null },
    res: import('express').Response
  ): Promise<AuthResult> {
    const role = user.role.name as UserRole;

    const accessToken = generateAccessToken({ id: user.id, email: user.email, role });
    const refreshToken = generateRefreshToken({ id: user.id, email: user.email, role });

    // Store refresh token hash in DB
    const tokenHash = hashToken(refreshToken);
    await prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt: getRefreshTokenExpiry(),
      },
    });

    // Set refresh token in httpOnly cookie
    res.cookie(REFRESH_TOKEN_COOKIE, refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      path: '/api/auth/refresh',
    });

    return {
      accessToken,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role,
        status: user.status,
        avatarUrl: user.avatarUrl,
      },
    };
  },
};

export { REFRESH_TOKEN_COOKIE };
