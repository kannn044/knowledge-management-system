/**
 * Unit tests for the validate middleware factory.
 * Tests that Zod schema validation works correctly and returns the right HTTP responses.
 */
import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { validate } from '../../../src/middleware/validate';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeReq(body: unknown = {}, query: unknown = {}, params: unknown = {}): Partial<Request> {
  return { body, query, params } as Partial<Request>;
}

function makeRes(): { status: jest.Mock; json: jest.Mock; _status: number; _body: unknown } {
  const res: any = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

const next: NextFunction = jest.fn();

// ─── Tests ────────────────────────────────────────────────────────────────────

const userSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  role: z.enum(['admin', 'staff', 'viewer']).optional(),
});

describe('validate middleware', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('calls next() when the body passes schema validation', () => {
    const req = makeReq({ email: 'user@example.com', password: 'Password1' });
    const res = makeRes();
    const middleware = validate(userSchema, 'body');

    middleware(req as Request, res as unknown as Response, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });

  it('returns 400 with validation errors when body is invalid', () => {
    const req = makeReq({ email: 'not-an-email', password: 'short' });
    const res = makeRes();
    const middleware = validate(userSchema, 'body');

    middleware(req as Request, res as unknown as Response, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
    const jsonPayload = res.json.mock.calls[0][0];
    expect(jsonPayload.success).toBe(false);
    expect(jsonPayload.error.message).toBe('Validation failed');
    expect(jsonPayload.error.details).toBeDefined();
  });

  it('returns 400 when required fields are missing', () => {
    const req = makeReq({});
    const res = makeRes();
    const middleware = validate(userSchema, 'body');

    middleware(req as Request, res as unknown as Response, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('strips extra fields not in the schema', () => {
    const req = makeReq({
      email: 'user@example.com',
      password: 'Password1',
      extraField: 'should_be_stripped',
    });
    const res = makeRes();
    const middleware = validate(userSchema, 'body');

    middleware(req as Request, res as unknown as Response, next);

    expect(next).toHaveBeenCalled();
    // Zod strips unknown fields by default
    expect((req as any).body.extraField).toBeUndefined();
  });

  it('coerces optional enum fields correctly', () => {
    const req = makeReq({ email: 'user@example.com', password: 'Password1', role: 'admin' });
    const res = makeRes();
    const middleware = validate(userSchema, 'body');

    middleware(req as Request, res as unknown as Response, next);

    expect(next).toHaveBeenCalled();
    expect((req as any).body.role).toBe('admin');
  });

  it('validates query params when part is "query"', () => {
    const querySchema = z.object({ page: z.coerce.number().min(1), limit: z.coerce.number().min(1) });
    const req = makeReq({}, { page: '1', limit: '20' });
    const res = makeRes();
    const middleware = validate(querySchema, 'query');

    middleware(req as Request, res as unknown as Response, next);

    expect(next).toHaveBeenCalled();
    expect((req as any).query.page).toBe(1);
    expect((req as any).query.limit).toBe(20);
  });

  it('returns 400 for invalid query params', () => {
    const querySchema = z.object({ page: z.coerce.number().min(1) });
    const req = makeReq({}, { page: '-1' });
    const res = makeRes();
    const middleware = validate(querySchema, 'query');

    middleware(req as Request, res as unknown as Response, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
  });
});
