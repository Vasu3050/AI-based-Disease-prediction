import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import type { UserDoc } from '../models/User';

export interface JwtPayload {
  sub: string;
  role: 'user' | 'admin';
  email: string;
}

export function signToken(user: Pick<UserDoc, '_id' | 'role' | 'email'>): string {
  const payload: JwtPayload = {
    sub: String(user._id),
    role: user.role as 'user' | 'admin',
    email: user.email as string,
  };
  return jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN as jwt.SignOptions['expiresIn'],
  });
}

export function verifyToken(token: string): JwtPayload | null {
  try {
    const decoded = jwt.verify(token, env.JWT_SECRET);
    if (typeof decoded === 'string') return null;
    const { sub, role, email } = decoded as jwt.JwtPayload & Partial<JwtPayload>;
    if (!sub || !role || !email) return null;
    return { sub, role, email };
  } catch {
    return null;
  }
}
