/**
 * Domain types shared across validation, analysis, ML and API layers.
 */
import type { RiskBand } from '../config/constants';

export type Sex = 'male' | 'female' | 'other';

/** A single raw test entry as submitted by the client. */
export interface RawTestEntry {
  value: number;
  unit: string;
  /** Optional laboratory-specific reference range (overrides defaults). */
  labRange?: { low?: number; high?: number };
}

/** Strictly structured blood-report input (after Zod validation). */
export interface ReportInput {
  patient: {
    name?: string;
    age: number;
    sex: Sex;
  };
  context?: {
    bmi?: number;
    weightKg?: number;
    heightCm?: number;
    systolicBp?: number;
    diastolicBp?: number;
    smoker?: 'never' | 'former' | 'current';
    familyHistoryDiabetes?: boolean;
  };
  report: {
    date: string;
    labName?: string;
    fasting?: boolean;
  };
  tests: Record<string, RawTestEntry>;
}

export type ValueStatus = 'low' | 'normal' | 'high';

/** Result of reference-range analysis for a single test. */
export interface RangeAnalysis {
  key: string;
  label: string;
  group: string;
  value: number;
  unit: string;
  range: { low?: number; high?: number };
  rangeSource: string;
  labRangeUsed: boolean;
  status: ValueStatus;
  /** 0..1 heuristic severity = relative distance outside the range (documented). */
  deviation: number;
  severity: 'normal' | 'borderline' | 'moderate' | 'marked';
}

export interface GuidelineInputRef {
  testKey?: string;
  label: string;
  value: number;
  unit: string;
}

/** A finding from a published guideline/reference rule (NOT an ML prediction). */
export interface GuidelineFinding {
  id: string;
  panel: 'glycemic' | 'anemia' | 'lipids' | 'liver' | 'kidney';
  title: string;
  status: 'ok' | 'attention' | 'concern';
  /** Short band/category label, e.g. "Prediabetes-range (ADA)". */
  label: string;
  details: string;
  source: string;
  inputs: GuidelineInputRef[];
}

export interface FeatureContribution {
  feature: string;
  label: string;
  value: number;
  unit?: string;
  /** Contribution to the model log-odds (signed). */
  contribution: number;
  direction: 'up' | 'down';
}

/** Result from one ML model. */
export interface MlModelResult {
  targetId: string;
  title: string;
  description: string;
  status: 'ok' | 'insufficient_data' | 'error';
  probability?: number;
  band?: RiskBand;
  contributions?: FeatureContribution[];
  modelName?: string;
  modelVersion?: string;
  /** Validation metrics of the shipped model artifact (honest, dataset-specific). */
  metrics?: {
    rocAuc: number;
    prAuc: number;
    accuracy: number;
    precision: number;
    recall: number;
    f1: number;
    brier: number;
    nTrain: number;
    nTest: number;
    prevalence: number;
    datasetName: string;
  };
  missingFeatures?: { id: string; label: string }[];
  note?: string;
}

export interface AnalysisSummary {
  testsAnalyzed: number;
  abnormalCount: number;
  abnormalKeys: string[];
  guidelineAttentionCount: number;
  modelCount: number;
  headline: string;
}

/** Full structured analysis result stored with every prediction. */
export interface AnalysisResult {
  engineVersion: string;
  analyzedAt: string;
  values: RangeAnalysis[];
  abnormalValues: RangeAnalysis[];
  guidelines: GuidelineFinding[];
  models: MlModelResult[];
  computed: {
    egfr?: number;
    bmi?: number;
  };
  summary: AnalysisSummary;
  disclaimers: string[];
}
