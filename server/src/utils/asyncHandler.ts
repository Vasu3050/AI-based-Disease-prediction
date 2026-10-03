import type { NextFunction, Request, RequestHandler, Response } from 'express';

/**
 * Wrap an async route handler so rejected promises reach the Express error
 * middleware instead of becoming unhandled rejections.
 */
export function asyncHandler<T extends RequestHandler>(handler: T): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}
