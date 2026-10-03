import type { Request, Response } from 'express';
import { AUDIT_ACTIONS } from '../config/constants';
import { recordAudit } from '../services/auditService';
import {
  clearAuthCookie,
  registerUser,
  setAuthCookie,
  toPublicUser,
  verifyLogin,
} from '../services/authService';
import { asyncHandler } from '../utils/asyncHandler';
import { loginSchema, registerSchema } from '../validation/schemas';

export const register = asyncHandler(async (req: Request, res: Response) => {
  const input = registerSchema.parse(req.body);
  const { user, token } = await registerUser(input);
  setAuthCookie(res, token);
  await recordAudit({
    req,
    actorId: String(user._id),
    actorEmail: user.email,
    action: AUDIT_ACTIONS.USER_REGISTERED,
  });
  res.status(201).json({ user: toPublicUser(user) });
});

export const login = asyncHandler(async (req: Request, res: Response) => {
  const input = loginSchema.parse(req.body);
  try {
    const { user, token } = await verifyLogin(input);
    setAuthCookie(res, token);
    await recordAudit({
      req,
      actorId: String(user._id),
      actorEmail: user.email,
      action: AUDIT_ACTIONS.USER_LOGIN,
    });
    res.json({ user: toPublicUser(user) });
  } catch (err) {
    await recordAudit({
      req,
      actorEmail: input.email,
      action: AUDIT_ACTIONS.USER_LOGIN_FAILED,
      meta: { reason: (err as Error).message },
    });
    throw err;
  }
});

export const logout = asyncHandler(async (req: Request, res: Response) => {
  clearAuthCookie(res);
  if (req.user) {
    await recordAudit({ req, action: AUDIT_ACTIONS.USER_LOGOUT });
  }
  res.json({ ok: true });
});
