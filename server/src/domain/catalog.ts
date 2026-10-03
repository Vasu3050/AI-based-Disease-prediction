/**
 * Blood-test catalog — THE single source of truth for:
 *   - which tests exist, their groups and descriptions
 *   - accepted units and conversion factors to canonical units
 *   - absolute plausibility bounds (to reject impossible values)
 *   - typical adult reference ranges (sex-specific where relevant)
 *   - published sources for every range
 *
 * The client renders its input form from this catalog (GET /api/meta/blood-tests),
 * so units/ranges can never drift between frontend and backend.
 *
 * IMPORTANT: reference ranges vary between laboratories. Ranges here are
 * "typical adult" values for educational use; reports may carry lab-specific
 * ranges which take precedence when provided.
 */
import type { RawTestEntry, Sex } from './types';

export interface AcceptedUnit {
  display: string;
  toCanonical: (value: number) => number;
}

type RangeSpec = { low?: number; high?: number };

export interface TestDefinition {
  key: string;
  label: string;
  group: string;
  canonicalUnit: string;
  units: AcceptedUnit[];
  bounds: { min: number; max: number };
  ranges: Partial<Record<Sex | 'default', RangeSpec>>;
  rangeSource: string;
  decimals: number;
  description: string;
}

/** Normalize a unit string for tolerant matching ("µ" → "u", lowercase, no spaces). */
export function normalizeUnitString(unit: string): string {
  return unit.trim().toLowerCase().replace(/µ/g, 'u').replace(/\s+/g, '');
}

const identity = (v: number) => v;

function buildRegistry(defs: TestDefinition[]): Map<string, TestDefinition> {
  const map = new Map<string, TestDefinition>();
  for (const def of defs) {
    if (map.has(def.key)) throw new Error(`Duplicate test key: ${def.key}`);
    map.set(def.key, def);
  }
  return map;
}

const DEFINITIONS: TestDefinition[] = [
  // ------------------------------------------------------------- CBC
  {
    key: 'hemoglobin',
    label: 'Hemoglobin',
    group: 'Complete Blood Count',
    canonicalUnit: 'g/dL',
    units: [
      { display: 'g/dL', toCanonical: identity },
      { display: 'g/L', toCanonical: (v) => v * 0.1 },
    ],
    bounds: { min: 2, max: 25 },
    ranges: {
      male: { low: 13.0, high: 17.0 },
      female: { low: 12.0, high: 15.0 },
      default: { low: 12.0, high: 17.0 },
    },
    rangeSource: 'WHO anemia thresholds / typical adult references',
    decimals: 1,
    description: 'Oxygen-carrying protein in red blood cells. Low values suggest anemia.',
  },
  {
    key: 'rbc',
    label: 'Red Blood Cell Count',
    group: 'Complete Blood Count',
    canonicalUnit: 'million/µL',
    units: [
      { display: 'million/µL', toCanonical: identity },
      { display: '10^12/L', toCanonical: identity },
    ],
    bounds: { min: 0.5, max: 10 },
    ranges: {
      male: { low: 4.5, high: 5.9 },
      female: { low: 4.1, high: 5.1 },
      default: { low: 4.0, high: 6.0 },
    },
    rangeSource: 'MedlinePlus / typical adult references',
    decimals: 2,
    description: 'Number of circulating red blood cells.',
  },
  {
    key: 'wbc',
    label: 'White Blood Cell Count',
    group: 'Complete Blood Count',
    canonicalUnit: 'cells/µL',
    units: [
      { display: 'cells/µL', toCanonical: identity },
      { display: '10^3/µL', toCanonical: (v) => v * 1000 },
    ],
    bounds: { min: 100, max: 100_000 },
    ranges: { default: { low: 4000, high: 11_000 } },
    rangeSource: 'Typical adult references',
    decimals: 0,
    description: 'Immune cells. High values may accompany infection/inflammation.',
  },
  {
    key: 'platelets',
    label: 'Platelet Count',
    group: 'Complete Blood Count',
    canonicalUnit: 'cells/µL',
    units: [
      { display: 'cells/µL', toCanonical: identity },
      { display: '10^3/µL', toCanonical: (v) => v * 1000 },
    ],
    bounds: { min: 5000, max: 2_000_000 },
    ranges: { default: { low: 150_000, high: 450_000 } },
    rangeSource: 'Typical adult references',
    decimals: 0,
    description: 'Cell fragments involved in clotting.',
  },
  {
    key: 'hematocrit',
    label: 'Hematocrit',
    group: 'Complete Blood Count',
    canonicalUnit: '%',
    units: [
      { display: '%', toCanonical: identity },
      { display: 'L/L', toCanonical: (v) => v * 100 },
    ],
    bounds: { min: 5, max: 70 },
    ranges: {
      male: { low: 38.8, high: 50.0 },
      female: { low: 34.9, high: 44.5 },
      default: { low: 35.0, high: 50.0 },
    },
    rangeSource: 'Mayo Clinic reference values',
    decimals: 1,
    description: 'Proportion of blood volume occupied by red cells.',
  },
  {
    key: 'mcv',
    label: 'Mean Corpuscular Volume',
    group: 'Complete Blood Count',
    canonicalUnit: 'fL',
    units: [{ display: 'fL', toCanonical: identity }],
    bounds: { min: 40, max: 150 },
    ranges: { default: { low: 80, high: 100 } },
    rangeSource: 'Typical adult references',
    decimals: 1,
    description: 'Average red-cell size. Helps classify anemia patterns.',
  },

  // ------------------------------------------------------------- Glycemic
  {
    key: 'fasting_glucose',
    label: 'Fasting Glucose',
    group: 'Glycemic',
    canonicalUnit: 'mg/dL',
    units: [
      { display: 'mg/dL', toCanonical: identity },
      { display: 'mmol/L', toCanonical: (v) => v * 18.0182 },
    ],
    bounds: { min: 10, max: 1000 },
    ranges: { default: { low: 70, high: 99 } },
    rangeSource: 'ADA — normal fasting plasma glucose <100 mg/dL',
    decimals: 0,
    description: 'Blood sugar after fasting. ADA categories: 100–125 elevated, ≥126 diabetes-range.',
  },
  {
    key: 'hba1c',
    label: 'HbA1c (Glycated Hemoglobin)',
    group: 'Glycemic',
    canonicalUnit: '%',
    units: [
      { display: '%', toCanonical: identity },
      { display: 'mmol/mol', toCanonical: (v) => v / 10.929 + 2.15 },
    ],
    bounds: { min: 2, max: 20 },
    ranges: { default: { low: 4.0, high: 5.6 } },
    rangeSource: 'ADA — normal <5.7%',
    decimals: 1,
    description: '~3-month average blood sugar. 5.7–6.4% prediabetes-range, ≥6.5% diabetes-range (ADA).',
  },

  // ------------------------------------------------------------- Lipids
  {
    key: 'total_cholesterol',
    label: 'Total Cholesterol',
    group: 'Lipid Panel',
    canonicalUnit: 'mg/dL',
    units: [
      { display: 'mg/dL', toCanonical: identity },
      { display: 'mmol/L', toCanonical: (v) => v * 38.67 },
    ],
    bounds: { min: 30, max: 1000 },
    ranges: { default: { low: 100, high: 199 } },
    rangeSource: 'NCEP ATP III — desirable <200 mg/dL',
    decimals: 0,
    description: 'Total cholesterol. Desirable <200 mg/dL.',
  },
  {
    key: 'ldl',
    label: 'LDL Cholesterol',
    group: 'Lipid Panel',
    canonicalUnit: 'mg/dL',
    units: [
      { display: 'mg/dL', toCanonical: identity },
      { display: 'mmol/L', toCanonical: (v) => v * 38.67 },
    ],
    bounds: { min: 10, max: 800 },
    ranges: { default: { low: 25, high: 99 } },
    rangeSource: 'NCEP ATP III — optimal <100 mg/dL',
    decimals: 0,
    description: '"Bad" cholesterol. Optimal <100 mg/dL.',
  },
  {
    key: 'hdl',
    label: 'HDL Cholesterol',
    group: 'Lipid Panel',
    canonicalUnit: 'mg/dL',
    units: [
      { display: 'mg/dL', toCanonical: identity },
      { display: 'mmol/L', toCanonical: (v) => v * 38.67 },
    ],
    bounds: { min: 3, max: 200 },
    ranges: {
      male: { low: 40 },
      female: { low: 50 },
      default: { low: 40 },
    },
    rangeSource: 'NCEP ATP III — low HDL: <40 mg/dL (men), <50 mg/dL (women)',
    decimals: 0,
    description: '"Good" cholesterol. Higher is generally better.',
  },
  {
    key: 'triglycerides',
    label: 'Triglycerides',
    group: 'Lipid Panel',
    canonicalUnit: 'mg/dL',
    units: [
      { display: 'mg/dL', toCanonical: identity },
      { display: 'mmol/L', toCanonical: (v) => v * 88.57 },
    ],
    bounds: { min: 10, max: 3000 },
    ranges: { default: { low: 20, high: 149 } },
    rangeSource: 'NCEP ATP III — normal <150 mg/dL',
    decimals: 0,
    description: 'Blood fats. Normal <150 mg/dL.',
  },

  // ------------------------------------------------------------- Liver
  {
    key: 'alt',
    label: 'ALT (SGPT)',
    group: 'Liver Function',
    canonicalUnit: 'U/L',
    units: [
      { display: 'U/L', toCanonical: identity },
      { display: 'IU/L', toCanonical: identity },
    ],
    bounds: { min: 1, max: 10_000 },
    ranges: {
      male: { low: 7, high: 55 },
      female: { low: 7, high: 45 },
      default: { low: 7, high: 55 },
    },
    rangeSource: 'Mayo Clinic reference values',
    decimals: 0,
    description: 'Liver enzyme. Elevated values can indicate liver-cell stress.',
  },
  {
    key: 'ast',
    label: 'AST (SGOT)',
    group: 'Liver Function',
    canonicalUnit: 'U/L',
    units: [
      { display: 'U/L', toCanonical: identity },
      { display: 'IU/L', toCanonical: identity },
    ],
    bounds: { min: 1, max: 10_000 },
    ranges: { default: { low: 8, high: 48 } },
    rangeSource: 'Mayo Clinic reference values',
    decimals: 0,
    description: 'Liver (and muscle) enzyme.',
  },
  {
    key: 'alp',
    label: 'Alkaline Phosphatase',
    group: 'Liver Function',
    canonicalUnit: 'U/L',
    units: [
      { display: 'U/L', toCanonical: identity },
      { display: 'IU/L', toCanonical: identity },
    ],
    bounds: { min: 5, max: 5000 },
    ranges: { default: { low: 40, high: 129 } },
    rangeSource: 'Mayo Clinic reference values',
    decimals: 0,
    description: 'Enzyme related to bile ducts and bone.',
  },
  {
    key: 'total_bilirubin',
    label: 'Total Bilirubin',
    group: 'Liver Function',
    canonicalUnit: 'mg/dL',
    units: [
      { display: 'mg/dL', toCanonical: identity },
      { display: 'µmol/L', toCanonical: (v) => v / 17.104 },
    ],
    bounds: { min: 0.05, max: 40 },
    ranges: { default: { low: 0.1, high: 1.2 } },
    rangeSource: 'Mayo Clinic reference values',
    decimals: 2,
    description: 'Breakdown product of red cells; elevated in various liver/bile conditions.',
  },
  {
    key: 'albumin',
    label: 'Albumin',
    group: 'Liver Function',
    canonicalUnit: 'g/dL',
    units: [
      { display: 'g/dL', toCanonical: identity },
      { display: 'g/L', toCanonical: (v) => v * 0.1 },
    ],
    bounds: { min: 0.5, max: 8 },
    ranges: { default: { low: 3.5, high: 5.0 } },
    rangeSource: 'Mayo Clinic reference values',
    decimals: 1,
    description: 'Main blood protein made by the liver.',
  },

  // ------------------------------------------------------------- Kidney
  {
    key: 'creatinine',
    label: 'Creatinine',
    group: 'Kidney Function',
    canonicalUnit: 'mg/dL',
    units: [
      { display: 'mg/dL', toCanonical: identity },
      { display: 'µmol/L', toCanonical: (v) => v / 88.4 },
    ],
    bounds: { min: 0.1, max: 30 },
    ranges: {
      male: { low: 0.74, high: 1.35 },
      female: { low: 0.59, high: 1.04 },
      default: { low: 0.6, high: 1.35 },
    },
    rangeSource: 'Mayo Clinic reference values',
    decimals: 2,
    description: 'Waste product filtered by kidneys. Used to estimate GFR.',
  },
  {
    key: 'urea',
    label: 'Blood Urea Nitrogen (BUN)',
    group: 'Kidney Function',
    canonicalUnit: 'mg/dL',
    units: [
      { display: 'mg/dL', toCanonical: identity },
      { display: 'mmol/L', toCanonical: (v) => v * 2.8 },
    ],
    bounds: { min: 1, max: 300 },
    ranges: { default: { low: 7, high: 20 } },
    rangeSource: 'Typical adult references',
    decimals: 0,
    description: 'Kidney-function marker; interpret with creatinine.',
  },

  // ------------------------------------------------------------- Other
  {
    key: 'tsh',
    label: 'TSH (Thyroid-Stimulating Hormone)',
    group: 'Thyroid',
    canonicalUnit: 'mIU/L',
    units: [
      { display: 'mIU/L', toCanonical: identity },
      { display: 'µIU/mL', toCanonical: identity },
    ],
    bounds: { min: 0.001, max: 200 },
    ranges: { default: { low: 0.4, high: 4.0 } },
    rangeSource: 'Typical adult references',
    decimals: 2,
    description: 'Screens thyroid function.',
  },
  {
    key: 'uric_acid',
    label: 'Uric Acid',
    group: 'Other',
    canonicalUnit: 'mg/dL',
    units: [
      { display: 'mg/dL', toCanonical: identity },
      { display: 'µmol/L', toCanonical: (v) => v * 0.0168 },
    ],
    bounds: { min: 0.3, max: 30 },
    ranges: {
      male: { low: 3.4, high: 7.0 },
      female: { low: 2.4, high: 6.0 },
      default: { low: 2.4, high: 7.0 },
    },
    rangeSource: 'Mayo Clinic reference values',
    decimals: 1,
    description: 'Associated with gout risk at high values.',
  },
  {
    key: 'ferritin',
    label: 'Ferritin',
    group: 'Other',
    canonicalUnit: 'ng/mL',
    units: [
      { display: 'ng/mL', toCanonical: identity },
      { display: 'µg/L', toCanonical: identity },
    ],
    bounds: { min: 0.5, max: 50_000 },
    ranges: {
      male: { low: 30, high: 400 },
      female: { low: 13, high: 150 },
      default: { low: 13, high: 400 },
    },
    rangeSource: 'Mayo Clinic reference values',
    decimals: 0,
    description: 'Iron stores. Low values support iron-deficiency (with context).',
  },
];

export const TEST_REGISTRY: Map<string, TestDefinition> = buildRegistry(DEFINITIONS);

export function getTestDef(key: string): TestDefinition | undefined {
  return TEST_REGISTRY.get(key);
}

export function allTestKeys(): string[] {
  return [...TEST_REGISTRY.keys()];
}

/**
 * Resolve the accepted unit for a test (tolerant matching for common spellings).
 * Returns null when the unit is not accepted for this test — callers must
 * reject the input rather than guess.
 */
export function resolveUnit(def: TestDefinition, unit: string): AcceptedUnit | null {
  const want = normalizeUnitString(unit).replace(/^iu\/l$/, 'u/l');
  for (const u of def.units) {
    const have = normalizeUnitString(u.display);
    if (have === want) return u;
  }
  return null;
}

export function convertToCanonical(def: TestDefinition, value: number, unit: string): number | null {
  const u = resolveUnit(def, unit);
  if (!u) return null;
  const converted = u.toCanonical(value);
  // Round to a sensible precision to avoid float noise (keep generous precision).
  return Math.round(converted * 1e6) / 1e6;
}

/** Effective reference range for a report value (lab range wins when present). */
export function resolveRange(
  def: TestDefinition,
  sex: Sex,
  labRange?: { low?: number; high?: number }
): { range: RangeSpec; source: string; labRangeUsed: boolean } {
  if (labRange && (labRange.low !== undefined || labRange.high !== undefined)) {
    return {
      range: { low: labRange.low, high: labRange.high },
      source: 'Laboratory-provided range',
      labRangeUsed: true,
    };
  }
  const bySex = def.ranges[sex] ?? def.ranges.default ?? {};
  const fallback = def.ranges.default ?? {};
  const range: RangeSpec = {
    low: bySex.low ?? fallback.low,
    high: bySex.high ?? fallback.high,
  };
  return { range, source: def.rangeSource, labRangeUsed: false };
}

/** Client-facing catalog (serializable; used to render the report form). */
export function catalogForClient() {
  return DEFINITIONS.map((d) => ({
    key: d.key,
    label: d.label,
    group: d.group,
    canonicalUnit: d.canonicalUnit,
    units: d.units.map((u) => u.display),
    bounds: d.bounds,
    ranges: d.ranges,
    rangeSource: d.rangeSource,
    decimals: d.decimals,
    description: d.description,
  }));
}

/** Normalize + validate one raw entry; returns canonical value or a problem. */
export function normalizeTestEntry(
  key: string,
  entry: RawTestEntry
): { ok: true; value: number; unit: string } | { ok: false; reason: string } {
  const def = getTestDef(key);
  if (!def) return { ok: false, reason: `Unknown test "${key}".` };
  const converted = convertToCanonical(def, entry.value, entry.unit);
  if (converted === null) {
    return {
      ok: false,
      reason: `Unit "${entry.unit}" is not accepted for ${def.label}. Accepted units: ${def.units
        .map((u) => u.display)
        .join(', ')}.`,
    };
  }
  if (!Number.isFinite(converted) || converted < def.bounds.min || converted > def.bounds.max) {
    return {
      ok: false,
      reason: `${def.label} value is outside the plausible range (${def.bounds.min}–${def.bounds.max} ${def.canonicalUnit}).`,
    };
  }
  return { ok: true, value: converted, unit: def.canonicalUnit };
}
