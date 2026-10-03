import bcrypt from 'bcryptjs';
import type { Request, Response } from 'express';
import { AUDIT_ACTIONS } from '../config/constants';
import { User } from '../models/User';
import { recordAudit } from '../services/auditService';
import { changePassword, clearAuthCookie, toPublicUser } from '../services/authService';
import { deleteUserCascade } from '../services/userService';
import { ApiError } from '../utils/ApiError';
import { asyncHandler } from '../utils/asyncHandler';
import { changePasswordSchema, updateMeSchema } from '../validation/schemas';

export const me = asyncHandler(async (req: Request, res: Response) => {
  const user = await User.findById(req.user!.id);
  if (!user) throw ApiError.unauthorized();
  res.json({ user: toPublicUser(user) });
});

export const updateMe = asyncHandler(async (req: Request, res: Response) => {
  const input = updateMeSchema.parse(req.body);
  const user = await User.findById(req.user!.id);
  if (!user) throw ApiError.unauthorized();
  if (input.name !== undefined) user.name = input.name;
  if (input.settings !== undefined) {
    user.settings = {
      theme: input.settings.theme ?? user.settings?.theme ?? 'system',
      highContrastCharts:
        input.settings.highContrastCharts ?? user.settings?.highContrastCharts ?? false,
    };
  }
  await user.save();
  await recordAudit({ req, action: AUDIT_ACTIONS.USER_UPDATED });
  res.json({ user: toPublicUser(user) });
});

export const changeMyPassword = asyncHandler(async (req: Request, res: Response) => {
  const input = changePasswordSchema.parse(req.body);
  await changePassword(req.user!.id, input);
  await recordAudit({ req, action: AUDIT_ACTIONS.PASSWORD_CHANGED });
  res.json({ ok: true });
});

/** Full data deletion: health data, account and audit trail for this user. */
export const deleteMe = asyncHandler(async (req: Request, res: Response) => {
  const password = typeof req.body?.password === 'string' ? req.body.password : '';
  if (!password) {
    throw ApiError.badRequest('Password confirmation is required to delete the account.');
  }
  const user = await User.findById(req.user!.id).select('+passwordHash');
  if (!user) throw ApiError.unauthorized();
  const ok = await bcrypt.compare(password, user.passwordHash as string);
  if (!ok) throw ApiError.unauthorized('Password is incorrect.');

  const userId = user._id;
  await deleteUserCascade(userId);
  clearAuthCookie(res);
  res.json({ ok: true, deleted: true });
});
