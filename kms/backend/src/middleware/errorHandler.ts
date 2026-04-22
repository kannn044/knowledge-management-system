import { Request, Response, NextFunction } from 'express';
import { logger } from '../config/logger';

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;

  constructor(message: string, statusCode: number, isOperational = true) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    Object.setPrototypeOf(this, AppError.prototype);
    Error.captureStackTrace(this, this.constructor);
  }
}

interface ErrorResponse {
  success: false;
  error: {
    message: string;
    code?: string;
    details?: unknown;
  };
}

export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction
): void {
  let statusCode = 500;
  let message = 'Internal server error';
  let details: unknown;

  if (err instanceof AppError) {
    statusCode = err.statusCode;
    message = err.message;
  } else if (err.name === 'ValidationError') {
    statusCode = 400;
    message = err.message;
  } else if (err.name === 'JsonWebTokenError') {
    statusCode = 401;
    message = 'Invalid token';
  } else if (err.name === 'TokenExpiredError') {
    statusCode = 401;
    message = 'Token expired';
  } else if ((err as NodeJS.ErrnoException).code === 'LIMIT_FILE_SIZE') {
    statusCode = 413;
    message = 'File size exceeds maximum allowed size';
  }

  // Log 5xx errors
  if (statusCode >= 500) {
    logger.error(`[${req.method}] ${req.path} — ${err.message}`, {
      stack: err.stack,
      body: req.body,
      user: (req as any).user?.id,
    });
  }

  const response: ErrorResponse = {
    success: false,
    error: {
      message,
      ...(process.env.NODE_ENV === 'development' && { details: err.stack }),
    },
  };

  res.status(statusCode).json(response);
}
