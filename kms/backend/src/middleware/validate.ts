import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';

type RequestPart = 'body' | 'query' | 'params';

/**
 * Middleware factory: validate request data against a Zod schema.
 * Attaches validated + typed data back to the request.
 */
export function validate(schema: ZodSchema, part: RequestPart = 'body') {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req[part]);

    if (!result.success) {
      const errors = (result.error as ZodError).flatten().fieldErrors;
      res.status(400).json({
        success: false,
        error: {
          message: 'Validation failed',
          details: errors,
        },
      });
      return;
    }

    // Overwrite with parsed (sanitized) data
    req[part] = result.data;
    next();
  };
}
