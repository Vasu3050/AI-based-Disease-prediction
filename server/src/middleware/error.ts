import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import mongoose from 'mongoose';
import { env } from '../config/env';
import { ApiError } from '../utils/ApiError';
import { logger } from '../utils/logger';

export function notFoundHandler(req: Request, _res: Response, next: NextFunction): void {
  next(ApiError.notFound(`Route not found: ${req.method} ${req.path}`));
}

interface ErrorBody {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

/** Central error serialization. Never leaks stack traces in production. */
export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction): void {
  // 1. Known operational error
  if (err instanceof ApiError) {
    const body: ErrorBody = { error: { code: err.code, message: err.message, details: err.details } };
    if (!err.expose && env.isProd) {
      logger.error(`[api] ${req.method} ${req.path} -> ${err.status}`, { message: err.message });
    }
    res.status(err.status).json(body);
    return;
  }

  // 2. Zod validation errors (route-level parsing)
  if (err instanceof ZodError) {
    const details = err.issues.map((i) => ({
      path: i.path.join('.'),
      message: i.message,
    }));
    res.status(422).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'The submitted data failed validation. Please review the highlighted fields.',
        details,
      },
    } satisfies ErrorBody);
    return;
  }

  // 2b. Malformed JSON bodies (body-parser syntax errors)
  if (err instanceof SyntaxError) {
    const status = (err as unknown as { status?: number }).status;
    if (status === 400) {
      res.status(400).json({
        error: { code: 'BAD_REQUEST', message: 'Malformed JSON request body.' },
      } satisfies ErrorBody);
      return;
    }
  }

  // 3. Mongoose validation / cast / duplicate-key errors
  if (err instanceof mongoose.Error.ValidationError) {
    const details = Object.values(err.errors).map((e) => ({ path: e.path, message: e.message }));
    res.status(400).json({
      error: { code: 'VALIDATION_ERROR', message: 'Invalid data.', details },
    } satisfies ErrorBody);
    return;
  }
  if (err instanceof mongoose.Error.CastError) {
    res.status(400).json({
      error: { code: 'BAD_REQUEST', message: 'Invalid identifier or value format.' },
    } satisfies ErrorBody);
    return;
  }
  if (typeof err === 'object' && err !== null && (err as { code?: number }).code === 11000) {
    res.status(409).json({
      error: { code: 'CONFLICT', message: 'A record with these values already exists.' },
    } satisfies ErrorBody);
    return;
  }

  // 4. Unknown/unexpected error
  const error = err instanceof Error ? err : new Error(String(err));
  logger.error(`[api] unhandled error on ${req.method} ${req.path}`, {
    message: error.message,
    stack: env.isProd ? undefined : error.stack,
  });
  res.status(500).json({
    error: {
      code: 'INTERNAL_ERROR',
      message:
        'An unexpected error occurred while processing your request. Please try again; if it persists, contact support.',
    },
  } satisfies ErrorBody);
}
