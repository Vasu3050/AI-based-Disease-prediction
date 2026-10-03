import type { Request } from 'express';
import { AuditLog } from '../models/AuditLog';
import { logger } from '../utils/logger';

/**
 * Record a security-relevant audit event. Never include lab values or other
 * sensitive health content in `meta`. Failures are logged but never break the
 * request flow.
 */
export async function recordAudit(params: {
  req?: Request;
  actorId?: string | null;
  actorEmail?: string | null;
  action: string;
  entityType?: string;
  entityId?: string;
  meta?: Record<string, unknown>;
}): Promise<void> {
  try {
    await AuditLog.create({
      actor: params.actorId ?? params.req?.user?.id ?? null,
      actorEmail: params.actorEmail ?? params.req?.user?.email ?? null,
      action: params.action,
      entityType: params.entityType,
      entityId: params.entityId,
      meta: params.meta,
      ip: params.req?.ip,
      userAgent: params.req?.headers['user-agent']?.slice(0, 400),
    });
  } catch (err) {
    logger.warn('Failed to write audit log', { action: params.action, error: (err as Error).message });
  }
}
