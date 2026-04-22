import rateLimit from 'express-rate-limit';
import { env } from '../config/env';

const isDev = env.NODE_ENV === 'development';

/**
 * Auth routes: login, register, forgot-password
 * Strict: 10 requests per 15 minutes per IP
 */
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isDev ? 1000 : 10,
  message: {
    success: false,
    error: { message: 'Too many requests. Please try again in 15 minutes.' },
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.ip ?? 'unknown',
});

/**
 * General API: 100 requests per 1 minute per IP
 */
export const generalRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: isDev ? 10000 : 100,
  message: {
    success: false,
    error: { message: 'Too many requests. Slow down.' },
  },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Search endpoint: 60 requests per 1 minute per IP
 */
export const searchRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: isDev ? 10000 : 60,
  message: {
    success: false,
    error: { message: 'Search rate limit exceeded.' },
  },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Document upload: 10 uploads per 1 hour per user
 */
export const uploadRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: isDev ? 10000 : 10,
  message: {
    success: false,
    error: { message: 'Upload limit reached. Try again in an hour.' },
  },
  standardHeaders: true,
  legacyHeaders: false,
});
