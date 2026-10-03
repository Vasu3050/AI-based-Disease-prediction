/** Client-side types mirroring the server API payloads (documented in docs/API.md). */

export type Sex = 'male' | 'female' | 'other';
export type ValueStatus = 'low' | 'normal' | 'high';
export type RiskBand = 'low' | 'borderline' | 'moderate' | 'high';
export type FindingStatus = 'ok' | 'attention' | 'concern';

export interface User {
  id: string;
  email: string;
  name: string;
  role: 'user' | 'admin';
  settings?: { theme?: string; highContrastCharts?: boolean };
  createdAt?: string;
}

export interface Patient {
  _id?: string;
  id?: string;
  name: string;
  sex: Sex;
  birthYear?: number;
  externalRef?: string;
  notes?: string;
  createdAt?: string;
}

export interface TestCatalogItem {
  key: string;
  label: string;
  group: string;
  canonicalUnit: string;
  units: string[];
  bounds: { min: number; max: number };
  ranges: Partial<Record<Sex | 'default', { low?: number; high?: number }>>;
  rangeSource: string;
  decimals: number;
  description: string;
}

export interface ReportTestEntry {
  value: number;
  unit: string;
  submittedValue: number;
  submittedUnit: string;
  labRange?: { low?: number; high?: number };
  status?: ValueStatus;
  label?: string;
  group?: string;
}

export interface ClientReport {
  id: string;
  patientId?: string;
  patient: { name?: string; age: number; sex: Sex };
  context: Record<string, unknown>;
  reportDate: string;
  labName?: string;
  fasting?: boolean;
  notes?: string;
  tests: Record<string, ReportTestEntry>;
  source: 'manual' | 'demo';
  demoLabel?: string;
  createdAt: string;
  updatedAt: string;
}

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
  deviation: number;
  severity: 'normal' | 'borderline' | 'moderate' | 'marked';
}

export interface GuidelineFinding {
  id: string;
  panel: 'glycemic' | 'anemia' | 'lipids' | 'liver' | 'kidney';
  title: string;
  status: FindingStatus;
  label: string;
  details: string;
  source: string;
  inputs: { testKey?: string; label: string; value: number; unit: string }[];
}

export interface FeatureContribution {
  feature: string;
  label: string;
  value: number;
  unit?: string;
  contribution: number;
  direction: 'up' | 'down';
}

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

export interface AnalysisResult {
  engineVersion: string;
  analyzedAt: string;
  values: RangeAnalysis[];
  abnormalValues: RangeAnalysis[];
  guidelines: GuidelineFinding[];
  models: MlModelResult[];
  computed: { egfr?: number; bmi?: number };
  summary: {
    testsAnalyzed: number;
    abnormalCount: number;
    abnormalKeys: string[];
    guidelineAttentionCount: number;
    modelCount: number;
    headline: string;
  };
  disclaimers: string[];
}

export interface ExplanationContent {
  summary: string;
  keyFindings: string[];
  valueExplanations: { label: string; finding: string }[];
  questionsForDoctor: string[];
  uncertainty: string;
  disclaimer: string;
}

export interface PredictionExplanation {
  source: 'llm' | 'template';
  provider?: string;
  model?: string;
  generatedAt: string;
  fallbackReason?: string;
  content: ExplanationContent;
}

export interface PredictionSummary {
  id: string;
  reportId: string;
  status: string;
  engineVersion: string;
  createdAt: string;
  headline: string;
  abnormalCount: number;
  guidelineAttentionCount: number;
  modelCount: number;
  bands: { targetId: string; title: string; band: RiskBand | null }[];
  topFindings: { title: string; label: string; status: FindingStatus }[];
  hasExplanation: boolean;
}

export interface Prediction {
  id: string;
  reportId: string;
  patientId?: string;
  engineVersion: string;
  status: string;
  results: AnalysisResult;
  modelVersions: { key: string; version: string }[];
  explanation: PredictionExplanation | null;
  createdAt: string;
  updatedAt: string;
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}

export interface ReportWithPrediction extends ClientReport {
  latestPrediction: PredictionSummary | null;
}

export interface TrendSeries {
  key: string;
  label: string;
  unit: string;
  points: { date: string; value: number; reportId: string }[];
}
