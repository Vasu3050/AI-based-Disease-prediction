import type { NextFunction, Request, Response } from 'express';

/**
 * Remove Mongo operator keys ($-prefixed) and dotted keys from user input.
 * Defense-in-depth: mongoose `sanitizeFilter` is also enabled globally.
 */
function sanitizeValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sanitizeValue);
  if (value && typeof value === 'object') {
    const clean: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (k.startsWith('$') || k.includes('.')) continue;
      clean[k] = sanitizeValue(v);
    }
    return clean;
  }
  return value;
}

export function mongoSanitize(req: Request, _res: Response, next: NextFunction): void {
  if (req.body && typeof req.body === 'object') {
    req.body = sanitizeValue(req.body);
  }
  if (req.params && typeof req.params === 'object') {
    req.params = sanitizeValue(req.params) as Request['params'];
  }
  // req.query is a getter in Express 5 / newer Express 4 typings — redefine safely.
  try {
    const cleanQuery = sanitizeValue({ ...req.query }) as Request['query'];
    Object.defineProperty(req, 'query', { value: cleanQuery, writable: true, configurable: true });
  } catch {
    // If the runtime forbids redefining, fall back to leaving query untouched
    // (mongoose sanitizeFilter still protects against operator injection).
  }
  next();
}
