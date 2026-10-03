import bcrypt from 'bcryptjs';
import type { Response } from 'express';
import { env } from '../config/env';
import { User, type UserDoc } from '../models/User';
import { ApiError } from '../utils/ApiError';
import { signToken } from '../utils/jwt';

const BCRYPT_ROUNDS = 12;

export interface PublicUser {
  id: string;
  email: string;
  name: string;
  role: 'user' | 'admin';
  settings?: { theme?: string; highContrastCharts?: boolean };
  createdAt?: string;
}

export function toPublicUser(user: UserDoc & { createdAt?: Date }): PublicUser {
  return {
    id: String(user._id),
    email: user.email,
    name: user.name,
    role: user.role as 'user' | 'admin',
    settings: user.settings
      ? {
          theme: user.settings.theme,
          highContrastCharts: user.settings.highContrastCharts,
        }
      : undefined,
    createdAt: user.createdAt?.toISOString(),
  };
}

export async function registerUser(input: {
  name: string;
  email: string;
  password: string;
}): Promise<{ user: UserDoc; token: string }> {
  const existing = await User.findOne({ email: input.email }).lean();
  if (existing) {
    throw ApiError.conflict('An account with this email already exists.');
  }
  const passwordHash = await bcrypt.hash(input.password, BCRYPT_ROUNDS);
  const user = await User.create({
    name: input.name,
    email: input.email,
    passwordHash,
    role: 'user',
  });
  return { user, token: signToken(user) };
}

export async function verifyLogin(input: {
  email: string;
  password: string;
}): Promise<{ user: UserDoc; token: string }> {
  const user = await User.findOne({ email: input.email }).select('+passwordHash');
  if (!user) {
    // Constant-ish behaviour: still burn a comparison to reduce user enumeration timing.
    await bcrypt.compare(input.password, '$2a$12$invalidsaltinvalidsaltinvalidsaltinvalidsa');
    throw ApiError.unauthorized('Invalid email or password.');
  }
  const ok = await bcrypt.compare(input.password, user.passwordHash as string);
  if (!ok) throw ApiError.unauthorized('Invalid email or password.');
  if (user.disabled) throw ApiError.forbidden('This account has been disabled.');
  user.lastLoginAt = new Date();
  await user.save();
  return { user, token: signToken(user) };
}

export async function changePassword(
  userId: string,
  input: { currentPassword: string; newPassword: string }
): Promise<void> {
  const user = await User.findById(userId).select('+passwordHash');
  if (!user) throw ApiError.notFound('User not found.');
  const ok = await bcrypt.compare(input.currentPassword, user.passwordHash as string);
  if (!ok) throw ApiError.unauthorized('Current password is incorrect.');
  user.passwordHash = await bcrypt.hash(input.newPassword, BCRYPT_ROUNDS);
  await user.save();
}

// ---------------------------------------------------------------- cookies
export function setAuthCookie(res: Response, token: string): void {
  res.cookie(env.COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: env.isProd,
    maxAge: env.jwtExpiresMs,
    path: '/',
  });
}

export function clearAuthCookie(res: Response): void {
  res.clearCookie(env.COOKIE_NAME, {
    httpOnly: true,
    sameSite: 'lax',
    secure: env.isProd,
    path: '/',
  });
}
