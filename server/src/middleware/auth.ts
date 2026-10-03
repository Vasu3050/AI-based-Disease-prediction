import type { NextFunction, Request, Response } from 'express';
import { env } from '../config/env';
import { User } from '../models/User';
import { ApiError } from '../utils/ApiError';
import { verifyToken } from '../utils/jwt';

function extractToken(req: Request): string | null {
  const cookieToken = (req.cookies as Record<string, string> | undefined)?.[env.COOKIE_NAME];
  if (cookieToken) return cookieToken;
  const auth = req.headers.authorization;
  if (auth && auth.startsWith('Bearer ')) return auth.slice(7);
  return null;
}

/** Verify the JWT + load a live user record. */
async function authenticate(req: Request): Promise<boolean> {
  const token = extractToken(req);
  if (!token) return false;
  const payload = verifyToken(token);
  if (!payload) return false;
  const user = await User.findById(payload.sub).lean();
  if (!user || user.disabled) return false;
  req.user = {
    id: String(user._id),
    email: user.email,
    name: user.name,
    role: user.role as 'user' | 'admin',
  };
  return true;
}

export async function requireAuth(req: Request, _res: Response, next: NextFunction): Promise<void> {
  try {
    const ok = await authenticate(req);
    if (!ok) throw ApiError.unauthorized();
    next();
  } catch (err) {
    next(err);
  }
}

/** Populates req.user when credentials are valid; never fails the request. */
export async function optionalAuth(req: Request, _res: Response, next: NextFunction): Promise<void> {
  try {
    await authenticate(req);
  } catch {
    // ignore — treated as anonymous
  }
  next();
}

export function requireRole(role: 'user' | 'admin') {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) return next(ApiError.unauthorized());
    if (req.user.role !== role) return next(ApiError.forbidden());
    next();
  };
}
