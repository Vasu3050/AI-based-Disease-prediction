/**
 * Feature extraction — maps normalized report data to the feature vector used
 * by ML models. Feature IDs are stable identifiers shared with the training
 * pipeline in `ml/training`.
 *
 * Every extractor returns `number | null`; `null` means "not available", which
 * causes the model to be skipped (insufficient_data) rather than imputed
 * silently. Models document their required features in `ml/models/*.json`.
 */
import type { ReportInput, Sex } from './types';

export interface FeatureSpec {
  id: string;
  label: string;
  unit?: string;
  /** Extract the feature value from a validated + normalized report. */
  get: (report: NormalizedReport) => number | null;
}

/** A report whose test values have been normalized to canonical units. */
export interface NormalizedReport {
  patient: { age: number; sex: Sex; name?: string };
  context: NonNullable<ReportInput['context']>;
  tests: Record<string, number>; // canonical values by test key
}

export function toNormalizedReport(input: ReportInput): NormalizedReport {
  return {
    patient: input.patient,
    context: input.context ?? {},
    tests: {}, // filled by caller after unit normalization
  };
}

/** BMI: direct value, or computed from weight/height when both are present. */
export function bmiFromContext(context: NormalizedReport['context']): number | null {
  if (typeof context.bmi === 'number') return context.bmi;
  if (typeof context.weightKg === 'number' && typeof context.heightCm === 'number') {
    const m = context.heightCm / 100;
    if (m > 0) return Math.round((context.weightKg / (m * m)) * 10) / 10;
  }
  return null;
}

const FEATURES: FeatureSpec[] = [
  {
    id: 'glucose',
    label: 'Fasting glucose',
    unit: 'mg/dL',
    get: (r) => r.tests.fasting_glucose ?? null,
  },
  { id: 'age', label: 'Age', unit: 'years', get: (r) => r.patient.age },
  { id: 'bmi', label: 'Body-mass index', unit: 'kg/m²', get: (r) => bmiFromContext(r.context) },
  {
    id: 'bp',
    label: 'Diastolic blood pressure',
    unit: 'mm Hg',
    get: (r) => r.context.diastolicBp ?? null,
  },
  {
    id: 'hemoglobin',
    label: 'Hemoglobin',
    unit: 'g/dL',
    get: (r) => r.tests.hemoglobin ?? null,
  },
  { id: 'bun', label: 'Blood urea nitrogen', unit: 'mg/dL', get: (r) => r.tests.urea ?? null },
  {
    id: 'creatinine',
    label: 'Creatinine',
    unit: 'mg/dL',
    get: (r) => r.tests.creatinine ?? null,
  },
  {
    id: 'total_bilirubin',
    label: 'Total bilirubin',
    unit: 'mg/dL',
    get: (r) => r.tests.total_bilirubin ?? null,
  },
  { id: 'alp', label: 'Alkaline phosphatase', unit: 'U/L', get: (r) => r.tests.alp ?? null },
  { id: 'alt', label: 'ALT', unit: 'U/L', get: (r) => r.tests.alt ?? null },
  { id: 'ast', label: 'AST', unit: 'U/L', get: (r) => r.tests.ast ?? null },
  { id: 'albumin', label: 'Albumin', unit: 'g/dL', get: (r) => r.tests.albumin ?? null },
  {
    id: 'sex_female',
    label: 'Sex (female)',
    get: (r) => (r.patient.sex === 'female' ? 1 : r.patient.sex === 'male' ? 0 : null),
  },
];

const FEATURE_MAP = new Map(FEATURES.map((f) => [f.id, f]));

export function getFeatureSpec(id: string): FeatureSpec | undefined {
  return FEATURE_MAP.get(id);
}

export function featureLabel(id: string): string {
  return FEATURE_MAP.get(id)?.label ?? id;
}
