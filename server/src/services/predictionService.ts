import { ENGINE_VERSION } from '../config/constants';
import type { AnalysisResult } from '../domain/types';
import { runAnalysis, type EngineInput } from '../ml/engine';
import { BloodReport } from '../models/BloodReport';
import { Prediction, type PredictionDoc } from '../models/Prediction';
import type { StoredTestEntry } from './reportService';
import { ApiError } from '../utils/ApiError';

export async function createPredictionForReport(
  ownerId: string,
  reportId: string
): Promise<PredictionDoc> {
  const report = await BloodReport.findOne({ _id: reportId, owner: ownerId });
  if (!report) throw ApiError.notFound('Report not found.');

  const testsMap = report.tests as unknown as Map<string, StoredTestEntry>;
  const tests: EngineInput['tests'] = {};
  for (const [key, entry] of testsMap.entries()) {
    tests[key] = { value: entry.value, labRange: entry.labRange };
  }

  const snapshot = report.patientSnapshot!;
  const engineInput: EngineInput = {
    patient: {
      age: snapshot.age,
      sex: snapshot.sex as 'male' | 'female' | 'other',
      name: snapshot.name ?? undefined,
    },
    context: {
      bmi: report.context?.bmi ?? undefined,
      weightKg: report.context?.weightKg ?? undefined,
      heightCm: report.context?.heightCm ?? undefined,
      systolicBp: report.context?.systolicBp ?? undefined,
      diastolicBp: report.context?.diastolicBp ?? undefined,
      smoker: (report.context?.smoker ?? undefined) as 'never' | 'former' | 'current' | undefined,
      familyHistoryDiabetes: report.context?.familyHistoryDiabetes ?? undefined,
    },
    tests,
  };

  let results: AnalysisResult;
  try {
    results = runAnalysis(engineInput);
  } catch (err) {
    // Persist a failed prediction for observability, then surface a safe error.
    await Prediction.create({
      owner: ownerId,
      report: report._id,
      patient: report.patient,
      engineVersion: ENGINE_VERSION,
      status: 'failed',
      results: { error: (err as Error).message },
      modelVersions: [],
    });
    throw ApiError.badRequest(
      'The analysis engine could not process this report. Please verify the report values and try again.'
    );
  }

  const modelVersions = results.models
    .filter((m) => m.status === 'ok' && m.modelName)
    .map((m) => ({ key: m.modelName as string, version: m.modelVersion ?? '' }));

  const doc = await Prediction.create({
    owner: ownerId,
    report: report._id,
    patient: report.patient,
    engineVersion: results.engineVersion,
    status: 'completed',
    results,
    modelVersions,
  });
  return doc;
}

export async function getPrediction(ownerId: string, predictionId: string): Promise<PredictionDoc> {
  const doc = await Prediction.findOne({ _id: predictionId, owner: ownerId });
  if (!doc) throw ApiError.notFound('Prediction not found.');
  return doc;
}

export async function getLatestPredictionForReport(
  ownerId: string,
  reportId: string
): Promise<PredictionDoc | null> {
  return Prediction.findOne({ owner: ownerId, report: reportId, status: 'completed' }).sort({
    createdAt: -1,
  });
}

/** Latest completed prediction per report (for list/history views). */
export async function getLatestPredictionsForReports(
  ownerId: string,
  reportIds: string[]
): Promise<Map<string, PredictionDoc>> {
  if (reportIds.length === 0) return new Map();
  const docs = await Prediction.find({
    owner: ownerId,
    report: { $in: reportIds },
    status: 'completed',
  }).sort({ createdAt: -1 });
  const map = new Map<string, PredictionDoc>();
  for (const doc of docs) {
    const key = String(doc.report);
    if (!map.has(key)) map.set(key, doc);
  }
  return map;
}

/** Compact, safe summary of a prediction for list views. */
export function summarizePrediction(doc: PredictionDoc) {
  const results = doc.results as AnalysisResult;
  const okModels = (results.models ?? []).filter((m) => m.status === 'ok');
  const findings = (results.guidelines ?? []).filter((g) => g.status !== 'ok');
  return {
    id: String(doc._id),
    reportId: String(doc.report),
    status: doc.status,
    engineVersion: doc.engineVersion,
    createdAt: doc.createdAt.toISOString(),
    headline: results.summary?.headline ?? '',
    abnormalCount: results.summary?.abnormalCount ?? 0,
    guidelineAttentionCount: findings.length,
    modelCount: okModels.length,
    bands: okModels.map((m) => ({ targetId: m.targetId, title: m.title, band: m.band ?? null })),
    topFindings: findings.slice(0, 3).map((g) => ({ title: g.title, label: g.label, status: g.status })),
    hasExplanation: Boolean(doc.explanation),
  };
}

/** Full serialization for detail views. */
export function serializePrediction(doc: PredictionDoc) {
  return {
    id: String(doc._id),
    reportId: String(doc.report),
    patientId: doc.patient ? String(doc.patient) : undefined,
    engineVersion: doc.engineVersion,
    status: doc.status,
    results: doc.results as AnalysisResult,
    modelVersions: doc.modelVersions.map((m) => ({ key: m.key, version: m.version })),
    explanation: doc.explanation
      ? {
          source: doc.explanation.source,
          provider: doc.explanation.provider,
          model: doc.explanation.model,
          generatedAt: doc.explanation.generatedAt.toISOString(),
          fallbackReason: doc.explanation.fallbackReason,
          content: doc.explanation.content,
        }
      : null,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}

export type SerializedPrediction = ReturnType<typeof serializePrediction>;
