import type { FindingStatus, RiskBand, ValueStatus } from './types';

export function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatNumber(value: number, decimals = 0): string {
  if (!Number.isFinite(value)) return '—';
  return value.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: decimals,
  });
}

export function formatPercent(value: number, decimals = 0): string {
  return `${(value * 100).toFixed(decimals)}%`;
}

export const BAND_META: Record<RiskBand, { label: string; className: string; description: string }> = {
  low: {
    label: 'Low (model)',
    className:
      'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300',
    description: 'Model-estimated risk score below the borderline band. Still an estimate.',
  },
  borderline: {
    label: 'Borderline (model)',
    className: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
    description: 'Model-estimated score in the borderline band. Interpretation requires a clinician.',
  },
  moderate: {
    label: 'Moderate (model)',
    className: 'bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300',
    description: 'Model-estimated score in the moderate band. Discuss with a healthcare professional.',
  },
  high: {
    label: 'High (model)',
    className: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
    description:
      'Model-estimated score in the high band. This is not a diagnosis — seek clinical evaluation.',
  },
};

export const STATUS_META: Record<ValueStatus, { label: string; className: string }> = {
  low: { label: 'Low', className: 'bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300' },
  normal: {
    label: 'Normal',
    className: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300',
  },
  high: { label: 'High', className: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300' },
};

export const FINDING_META: Record<FindingStatus, { label: string; className: string }> = {
  ok: {
    label: 'Within reference',
    className: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300',
  },
  attention: {
    label: 'Needs attention',
    className: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
  },
  concern: {
    label: 'Discuss with a clinician',
    className: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
  },
};

export function rangeText(low?: number, high?: number): string {
  if (low !== undefined && high !== undefined) return `${low} – ${high}`;
  if (low !== undefined) return `≥ ${low}`;
  if (high !== undefined) return `≤ ${high}`;
  return '—';
}
