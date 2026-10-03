/** Application-wide constants. */

/** Version of the analysis/prediction engine (stored with every prediction). */
export const ENGINE_VERSION = '1.0.0';

/** API prefix. */
export const API_PREFIX = '/api';

/** Default page size for list endpoints. */
export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

/** Cookie options helper type placeholder (see auth service). */
export const AUDIT_ACTIONS = {
  USER_REGISTERED: 'USER_REGISTERED',
  USER_LOGIN: 'USER_LOGIN',
  USER_LOGIN_FAILED: 'USER_LOGIN_FAILED',
  USER_LOGOUT: 'USER_LOGOUT',
  USER_UPDATED: 'USER_UPDATED',
  USER_DELETED: 'USER_DELETED',
  PASSWORD_CHANGED: 'PASSWORD_CHANGED',
  PATIENT_CREATED: 'PATIENT_CREATED',
  PATIENT_UPDATED: 'PATIENT_UPDATED',
  PATIENT_DELETED: 'PATIENT_DELETED',
  REPORT_CREATED: 'REPORT_CREATED',
  REPORT_DELETED: 'REPORT_DELETED',
  PREDICTION_CREATED: 'PREDICTION_CREATED',
  EXPLANATION_GENERATED: 'EXPLANATION_GENERATED',
  REPORT_COMPARED: 'REPORT_COMPARED',
  ADMIN_USER_UPDATED: 'ADMIN_USER_UPDATED',
  ADMIN_MODEL_REFRESHED: 'ADMIN_MODEL_REFRESHED',
} as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[keyof typeof AUDIT_ACTIONS];

/** Risk bands used across ML + guideline results (documented in docs/ML.md). */
export const RISK_BANDS = ['low', 'borderline', 'moderate', 'high'] as const;
export type RiskBand = (typeof RISK_BANDS)[number];

/** Thresholds mapping a 0..1 model-estimated probability to a band. */
export function probabilityToBand(p: number): RiskBand {
  if (p < 0.25) return 'low';
  if (p < 0.5) return 'borderline';
  if (p < 0.75) return 'moderate';
  return 'high';
}
