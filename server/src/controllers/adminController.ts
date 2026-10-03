import type { Request, Response } from 'express';
import mongoose from 'mongoose';
import { AUDIT_ACTIONS, ENGINE_VERSION } from '../config/constants';
import { env } from '../config/env';
import { AuditLog } from '../models/AuditLog';
import { BloodReport } from '../models/BloodReport';
import { Patient } from '../models/Patient';
import { Prediction } from '../models/Prediction';
import { User } from '../models/User';
import { getModelStatus, loadModels } from '../ml/registry';
import { recordAudit } from '../services/auditService';
import { deleteUserCascade } from '../services/userService';
import { ApiError } from '../utils/ApiError';
import { asyncHandler } from '../utils/asyncHandler';
import { adminUserUpdateSchema, auditQuerySchema, paginationSchema } from '../validation/schemas';

export const overviewHandler = asyncHandler(async (_req: Request, res: Response) => {
  const since14d = new Date(Date.now() - 13 * 86_400_000);
  const since7d = new Date(Date.now() - 7 * 86_400_000);
  const since24h = new Date(Date.now() - 86_400_000);

  const [users, disabledUsers, reports, predictions, failedPredictions, auditEvents24h] =
    await Promise.all([
      User.countDocuments({}),
      User.countDocuments({ disabled: true }),
      BloodReport.countDocuments({}),
      Prediction.countDocuments({}),
      Prediction.countDocuments({ status: 'failed' }),
      AuditLog.countDocuments({ createdAt: { $gte: since24h } }),
    ]);

  const perDay = await Prediction.aggregate([
    { $match: { createdAt: { $gte: since14d } } },
    {
      $group: {
        _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
        total: { $sum: 1 },
        failed: { $sum: { $cond: [{ $eq: ['$status', 'failed'] }, 1, 0] } },
      },
    },
    { $sort: { _id: 1 } },
  ]);

  const activeOwners = await Prediction.distinct('owner', { createdAt: { $gte: since7d } });
  const modelStatus = getModelStatus();

  res.json({
    users: { total: users, disabled: disabledUsers, active7d: activeOwners.length },
    reports: { total: reports },
    predictions: { total: predictions, failed: failedPredictions },
    audit: { last24h: auditEvents24h },
    models: { loaded: modelStatus.artifacts.length, errors: modelStatus.errors.length },
    predictionsPerDay: perDay.map((d) => ({ date: d._id as string, total: d.total as number, failed: d.failed as number })),
    engineVersion: ENGINE_VERSION,
  });
});

export const listUsersHandler = asyncHandler(async (req: Request, res: Response) => {
  const query = paginationSchema.parse(req.query);
  const filter: Record<string, unknown> = {};
  if (query.q) {
    const rx = new RegExp(query.q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    filter.$or = [{ email: rx }, { name: rx }];
  }
  const [total, users] = await Promise.all([
    User.countDocuments(filter),
    User.find(filter)
      .sort({ createdAt: -1 })
      .skip((query.page - 1) * query.limit)
      .limit(query.limit),
  ]);

  const ids = users.map((u) => u._id);
  const reportCounts = await BloodReport.aggregate([
    { $match: { owner: { $in: ids } } },
    { $group: { _id: '$owner', count: { $sum: 1 } } },
  ]);
  const countMap = new Map(reportCounts.map((r) => [String(r._id), r.count as number]));

  res.json({
    total,
    page: query.page,
    limit: query.limit,
    pages: Math.max(1, Math.ceil(total / query.limit)),
    users: users.map((u) => ({
      id: String(u._id),
      email: u.email,
      name: u.name,
      role: u.role,
      disabled: u.disabled,
      createdAt: u.createdAt.toISOString(),
      lastLoginAt: u.lastLoginAt ? u.lastLoginAt.toISOString() : null,
      reportCount: countMap.get(String(u._id)) ?? 0,
    })),
  });
});

export const updateUserHandler = asyncHandler(async (req: Request, res: Response) => {
  const input = adminUserUpdateSchema.parse(req.body);
  const target = await User.findById(req.params.id);
  if (!target) throw ApiError.notFound('User not found.');

  if (String(target._id) === req.user!.id) {
    if (input.role === 'user' || input.disabled === true) {
      throw ApiError.badRequest('You cannot demote or disable your own account.');
    }
  }

  if (input.role !== undefined) target.role = input.role;
  if (input.disabled !== undefined) target.disabled = input.disabled;
  await target.save();

  await recordAudit({
    req,
    action: AUDIT_ACTIONS.ADMIN_USER_UPDATED,
    entityType: 'User',
    entityId: String(target._id),
    meta: { role: input.role, disabled: input.disabled },
  });
  res.json({
    user: {
      id: String(target._id),
      email: target.email,
      name: target.name,
      role: target.role,
      disabled: target.disabled,
    },
  });
});

export const deleteUserHandler = asyncHandler(async (req: Request, res: Response) => {
  if (req.params.id === req.user!.id) {
    throw ApiError.badRequest('You cannot delete your own account from the admin panel.');
  }
  const deleted = await deleteUserCascade(req.params.id);
  if (!deleted) throw ApiError.notFound('User not found.');
  await recordAudit({
    req,
    action: AUDIT_ACTIONS.USER_DELETED,
    entityType: 'User',
    entityId: req.params.id,
    meta: { by: 'admin' },
  });
  res.json({ ok: true });
});

export const modelsHandler = asyncHandler(async (_req: Request, res: Response) => {
  const status = getModelStatus();
  const usage = await Prediction.aggregate([
    { $unwind: '$modelVersions' },
    {
      $group: {
        _id: { key: '$modelVersions.key', version: '$modelVersions.version' },
        count: { $sum: 1 },
      },
    },
  ]);
  res.json({
    modelsDir: status.modelsDir,
    loadedAt: status.loadedAt,
    models: status.artifacts,
    errors: status.errors,
    usage: usage.map((u) => ({
      key: u._id.key as string,
      version: u._id.version as string,
      predictions: u.count as number,
    })),
  });
});

export const refreshModelsHandler = asyncHandler(async (req: Request, res: Response) => {
  const state = loadModels(true);
  await recordAudit({
    req,
    action: AUDIT_ACTIONS.ADMIN_MODEL_REFRESHED,
    meta: { loaded: state.artifacts.length, errors: state.errors.length },
  });
  res.json({ ok: true, loaded: state.artifacts.length, errors: state.errors });
});

export const auditLogsHandler = asyncHandler(async (req: Request, res: Response) => {
  const query = auditQuerySchema.parse(req.query);
  const filter: Record<string, unknown> = {};
  if (query.action) filter.action = query.action;
  const [total, logs] = await Promise.all([
    AuditLog.countDocuments(filter),
    AuditLog.find(filter)
      .sort({ createdAt: -1 })
      .skip((query.page - 1) * query.limit)
      .limit(query.limit),
  ]);
  res.json({
    total,
    page: query.page,
    limit: query.limit,
    pages: Math.max(1, Math.ceil(total / query.limit)),
    logs: logs.map((l) => ({
      id: String(l._id),
      action: l.action,
      actorEmail: l.actorEmail,
      entityType: l.entityType,
      entityId: l.entityId,
      meta: l.meta,
      ip: l.ip,
      createdAt: l.createdAt.toISOString(),
    })),
  });
});

export const systemHandler = asyncHandler(async (_req: Request, res: Response) => {
  res.json({
    nodeEnv: env.NODE_ENV,
    port: env.PORT,
    engineVersion: ENGINE_VERSION,
    database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    llm: {
      enabled: env.llm.enabled,
      provider: env.llm.provider,
      model: env.llm.model || null,
      disabledReason: env.llm.disabledReason,
    },
    modelsDir: env.modelsDir,
    node: process.version,
    counts: {
      users: await User.countDocuments({}),
      reports: await BloodReport.countDocuments({}),
      predictions: await Prediction.countDocuments({}),
      patients: await Patient.countDocuments({}),
    },
  });
});
