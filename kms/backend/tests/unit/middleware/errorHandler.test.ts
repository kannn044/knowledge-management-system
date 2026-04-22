/**
 * Unit tests for the centralized error handler middleware.
 */
import { Request, Response, NextFunction } from 'express';
import { errorHandler, AppError } from '../../../src/middleware/errorHandler';

function makeRes(): any {
  const res: any = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

const req = {} as Request;
const next = jest.fn() as unknown as NextFunction;

describe('AppError', () => {
  it('creates an error with the correct statusCode and message', () => {
    const err = new AppError('Not found', 404);
    expect(err.message).toBe('Not found');
    expect(err.statusCode).toBe(404);
    expect(err.isOperational).toBe(true);
  });

  it('sets isOperational to false when specified', () => {
    const err = new AppError('Critical failure', 500, false);
    expect(err.isOperational).toBe(false);
  });
});

describe('errorHandler middleware', () => {
  beforeEach(() => jest.clearAllMocks());

  it('handles AppError and returns correct status + message', () => {
    const err = new AppError('Resource not found', 404);
    const res = makeRes();

    errorHandler(err, req, res, next);

    expect(res.status).toHaveBeenCalledWith(404);
    const body = res.json.mock.calls[0][0];
    expect(body.success).toBe(false);
    expect(body.error.message).toBe('Resource not found');
  });

  it('handles 401 for JsonWebTokenError', () => {
    const err = Object.assign(new Error('jwt malformed'), { name: 'JsonWebTokenError' });
    const res = makeRes();

    errorHandler(err, req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    const body = res.json.mock.calls[0][0];
    expect(body.error.message).toBe('Invalid token');
  });

  it('handles 401 for TokenExpiredError', () => {
    const err = Object.assign(new Error('jwt expired'), { name: 'TokenExpiredError' });
    const res = makeRes();

    errorHandler(err, req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    const body = res.json.mock.calls[0][0];
    expect(body.error.message).toBe('Token expired');
  });

  it('handles 413 for multer LIMIT_FILE_SIZE', () => {
    const err = Object.assign(new Error('File too large'), { code: 'LIMIT_FILE_SIZE' });
    const res = makeRes();

    errorHandler(err, req, res, next);

    expect(res.status).toHaveBeenCalledWith(413);
    const body = res.json.mock.calls[0][0];
    expect(body.error.message).toBe('File size exceeds maximum allowed size');
  });

  it('defaults to 500 for unrecognized errors', () => {
    const err = new Error('Something unexpected broke');
    const res = makeRes();

    errorHandler(err, req, res, next);

    expect(res.status).toHaveBeenCalledWith(500);
    const body = res.json.mock.calls[0][0];
    expect(body.error.message).toBe('Internal server error');
  });

  it('returns success: false in all error responses', () => {
    const err = new AppError('Forbidden', 403);
    const res = makeRes();

    errorHandler(err, req, res, next);

    const body = res.json.mock.calls[0][0];
    expect(body.success).toBe(false);
  });
});
