import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { env } from '../config/env';
import { JwtPayload, UserRole } from '../types';

// ─── JWT ──────────────────────────────────────────────────────────

interface TokenUserPayload {
  id: string;
  email: string;
  role: UserRole;
}

export function generateAccessToken(user: TokenUserPayload): string {
  return jwt.sign(
    {
      sub: user.id,
      email: user.email,
      role: user.role,
      iss: 'kms-api',
      aud: 'kms-client',
    },
    env.JWT_SECRET,
    { expiresIn: env.JWT_ACCESS_EXPIRES_IN as jwt.SignOptions['expiresIn'] }
  );
}

export function generateRefreshToken(user: TokenUserPayload): string {
  return jwt.sign(
    {
      sub: user.id,
      email: user.email,
      role: user.role,
      iss: 'kms-api',
      aud: 'kms-refresh',
    },
    env.JWT_REFRESH_SECRET,
    { expiresIn: env.JWT_REFRESH_EXPIRES_IN as jwt.SignOptions['expiresIn'] }
  );
}

export function verifyAccessToken(token: string): JwtPayload {
  return jwt.verify(token, env.JWT_SECRET, {
    issuer: 'kms-api',
    audience: 'kms-client',
  }) as JwtPayload;
}

export function verifyRefreshToken(token: string): JwtPayload {
  return jwt.verify(token, env.JWT_REFRESH_SECRET, {
    issuer: 'kms-api',
    audience: 'kms-refresh',
  }) as JwtPayload;
}

// ─── Secure random tokens ─────────────────────────────────────────

export function generateSecureToken(bytes = 32): string {
  return crypto.randomBytes(bytes).toString('hex');
}

export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

// ─── Refresh token expiry ─────────────────────────────────────────

export function getRefreshTokenExpiry(): Date {
  const days = parseInt(env.JWT_REFRESH_EXPIRES_IN.replace('d', '')) || 7;
  const expiry = new Date();
  expiry.setDate(expiry.getDate() + days);
  return expiry;
}

export function getEmailVerificationExpiry(): Date {
  const expiry = new Date();
  expiry.setHours(expiry.getHours() + 24); // 24-hour expiry
  return expiry;
}
