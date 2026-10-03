/**
 * Prediction/analysis engine.
 *
 * Pipeline (see docs/ARCHITECTURE.md):
 *   normalized report → reference-range analysis → guideline indicators →
 *   ML models (registry) → structured AnalysisResult
 *
 * The engine is deterministic. Optional LLM explanation happens in a separate
 * layer that consumes (never overrides) this structured result.
 */
import { ENGINE_VERSION, probabilityToBand } from '../config/constants';
import { getTestDef, resolveRange } from '../domain/catalog';
import { ckdEpi2021 } from '../domain/egfr';
import { featureLabel, getFeatureSpec, bmiFromContext, type NormalizedReport } from '../domain/features';
import { analyzeGuidelines } from '../domain/guidelines';
import type {
  AnalysisResult,
  GuidelineFinding,
  MlModelResult,
  RangeAnalysis,
  Sex,
  ValueStatus,
} from '../domain/types';
import { loadModels, type ModelArtifact } from '../ml/registry';

export const DISCLAIMERS = [
  'This is NOT a medical diagnosis. It is an educational decision-support prototype.',
  'All model outputs are probabilistic estimates and may be wrong (including false negatives).',
  'Results must be interpreted by a qualified healthcare professional.',
  'Do not start, stop, or change any medication based on this output.',
  'This system does not replace professional medical evaluation.',
  'If you have urgent or emergency symptoms, seek immediate medical attention regardless of these results.',
];

/** Normalized test entry as stored on a report. */
export interface NormalizedTestEntry {
  value: number;
  labRange?: { low?: number; high?: number };
}

export interface EngineInput {
  patient: { age: number; sex: Sex; name?: string };
  context: NormalizedReport['context'];
  tests: Record<string, NormalizedTestEntry>;
}

// Skip subtle unicode: display labels built for readability.
function severityFromDeviation(deviation: number): RangeAnalysis['severity'] {
  if (deviation <= 0) return 'normal';
  if (deviation < 0.15) return 'borderline';
  if (deviation < 0.35) return 'moderate';
  return 'marked';
}

export function analyzeValue(
  key: string,
  entry: NormalizedTestEntry,
  sex: Sex
): RangeAnalysis | null {
  const def = getTestDef(key);
  if (!def) return null;
  const { range, source, labRangeUsed } = resolveRange(def, sex, entry.labRange);
  const value = entry.value;

  let status: ValueStatus = 'normal';
  if (range.high !== undefined && value > range.high) status = 'high';
  else if (range.low !== undefined && value < range.low) status = 'low';

  // Heuristic relative deviation outside the range (documented in docs/ML.md).
  let deviation = 0;
  if (status !== 'normal') {
    const span =
      range.high !== undefined && range.low !== undefined
        ? Math.max(range.high - range.low, 1e-9)
        : Math.max(Math.abs((status === 'high' ? range.high : range.low) ?? 1) * 0.5, 1e-9);
    deviation =
      status === 'high'
        ? (value - (range.high as number)) / span
        : ((range.low as number) - value) / span;
    deviation = Math.min(1, Math.max(0, deviation));
  }

  return {
    key,
    label: def.label,
    group: def.group,
    value,
    unit: def.canonicalUnit,
    range: { low: range.low, high: range.high },
    rangeSource: source,
    labRangeUsed,
    status,
    deviation: Math.round(deviation * 1000) / 1000,
    severity: severityFromDeviation(deviation),
  };
}

function sigmoid(x: number): number {
  return 1 / (1 + Math.exp(-x));
}

function round(n: number, d = 4): number {
  const f = 10 ** d;
  return Math.round(n * f) / f;
}

function predictWithModel(model: ModelArtifact, values: number[]): MlModelResult {
  const zs = values.map((x, i) => {
    const mean = model.scaler.mean[i] ?? 0;
    const std = model.scaler.std[i] ?? 1;
    return std > 0 ? (x - mean) / std : 0;
  });

  let logit = model.intercept;
  for (let i = 0; i < zs.length; i += 1) {
    logit += (model.coefficients[i] ?? 0) * (zs[i] ?? 0);
  }
  const probability = sigmoid(logit);

  const contributions = model.features.map((featureId, i) => {
    const spec = getFeatureSpec(featureId);
    const z = zs[i] ?? 0;
    const coef = model.coefficients[i] ?? 0;
    const contribution = coef * z;
    return {
      feature: featureId,
      label: spec?.label ?? featureLabel(featureId),
      value: values[i] ?? 0,
      unit: spec?.unit,
      contribution: round(contribution),
      direction: (contribution >= 0 ? 'up' : 'down') as 'up' | 'down',
    };
  });

  // Sort by absolute contribution for display (most influential first).
  contributions.sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution));

  return {
    targetId: model.targetId,
    title: model.title,
    description: model.description,
    status: 'ok',
    probability: round(probability, 4),
    band: probabilityToBand(probability),
    contributions,
    modelName: model.name,
    modelVersion: model.version,
    metrics: {
      rocAuc: model.metrics.rocAuc,
      prAuc: model.metrics.prAuc,
      accuracy: model.metrics.accuracy,
      precision: model.metrics.precision,
      recall: model.metrics.recall,
      f1: model.metrics.f1,
      brier: model.metrics.brier,
      nTrain: model.metrics.nTrain,
      nTest: model.metrics.nTest,
      prevalence: model.metrics.prevalence,
      datasetName: model.metrics.datasetName,
    },
    note:
      `Logistic-regression model trained on "${model.dataset.name}". ` +
      `Metrics shown were measured on a held-out test split during training and are NOT a guarantee of real-world performance. ` +
      `This probability is a model-estimated risk score — not a diagnosis.`,
  };
}

export function runModels(norm: NormalizedReport): MlModelResult[] {
  const { artifacts } = loadModels();
  const byTarget = new Map<string, ModelArtifact[]>();
  for (const a of artifacts) {
    const list = byTarget.get(a.targetId) ?? [];
    list.push(a);
    byTarget.set(a.targetId, list);
  }

  const results: MlModelResult[] = [];

  for (const [targetId, models] of byTarget) {
    let best: { model: ModelArtifact; values: number[] } | null = null;
    let fallback: { model: ModelArtifact; missing: { id: string; label: string }[] } | null = null;

    for (const model of models) {
      const values: number[] = [];
      const missing: { id: string; label: string }[] = [];
      for (const featureId of model.features) {
        const spec = getFeatureSpec(featureId);
        const value = spec ? spec.get(norm) : null;
        if (value === null || !Number.isFinite(value)) {
          missing.push({ id: featureId, label: spec?.label ?? featureId });
        } else {
          values.push(value);
        }
      }
      if (missing.length === 0) {
        if (!best || model.features.length > best.model.features.length) {
          best = { model, values };
        }
      } else if (!fallback || missing.length < fallback.missing.length) {
        fallback = { model, missing };
      }
    }

    if (best) {
      results.push(predictWithModel(best.model, best.values));
    } else if (fallback) {
      results.push({
        targetId,
        title: fallback.model.title,
        description: fallback.model.description,
        status: 'insufficient_data',
        missingFeatures: fallback.missing,
        modelName: fallback.model.name,
        modelVersion: fallback.model.version,
        note:
          `This model needs the following values to run: ${fallback.missing
            .map((m) => m.label)
            .join(', ')}. ` +
          `Add them to a report to receive an estimate. No value is imputed or guessed.`,
      });
    }
  }

  // Stable ordering for the UI.
  const order = ['diabetes_risk', 'liver_risk', 'kidney_risk'];
  results.sort((a, b) => order.indexOf(a.targetId) - order.indexOf(b.targetId));
  return results;
}

export function runAnalysis(input: EngineInput): AnalysisResult {
  const norm: NormalizedReport = {
    patient: input.patient,
    context: input.context ?? {},
    tests: Object.fromEntries(Object.entries(input.tests).map(([k, e]) => [k, e.value])),
  };

  // 1. Reference-range analysis
  const values: RangeAnalysis[] = [];
  for (const [key, entry] of Object.entries(input.tests)) {
    const analysis = analyzeValue(key, entry, input.patient.sex);
    if (analysis) values.push(analysis);
  }
  values.sort((a, b) => a.group.localeCompare(b.group) || a.label.localeCompare(b.label));
  const abnormalValues = values.filter((v) => v.status !== 'normal');

  // 2. Computed values
  const creatinine = input.tests.creatinine?.value;
  const egfr =
    creatinine !== undefined
      ? ckdEpi2021(creatinine, input.patient.age, input.patient.sex)
      : undefined;
  const bmi = bmiFromContext(norm.context);

  // 3. Guideline indicators
  const guidelines: GuidelineFinding[] = analyzeGuidelines(norm, egfr);

  // 4. ML models
  const models = runModels(norm);

  // 5. Summary
  const guidelineAttentionCount = guidelines.filter((g) => g.status !== 'ok').length;
  const modelCount = models.filter((m) => m.status === 'ok').length;
  const abnormalKeys = abnormalValues.map((v) => v.key);
  const headline =
    values.length === 0
      ? 'No laboratory values were analyzed.'
      : `${abnormalValues.length} of ${values.length} values outside typical ranges; ` +
        `${guidelineAttentionCount} guideline finding(s) needing attention; ` +
        `${modelCount} model estimate(s) computed.`;

  return {
    engineVersion: ENGINE_VERSION,
    analyzedAt: new Date().toISOString(),
    values,
    abnormalValues,
    guidelines,
    models,
    computed: {
      egfr: egfr ?? undefined,
      bmi: bmi ?? undefined,
    },
    summary: {
      testsAnalyzed: values.length,
      abnormalCount: abnormalValues.length,
      abnormalKeys,
      guidelineAttentionCount,
      modelCount,
      headline,
    },
    disclaimers: DISCLAIMERS,
  };
}
