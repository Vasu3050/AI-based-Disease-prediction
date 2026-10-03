import type { Request, Response } from 'express';
import { AUDIT_ACTIONS } from '../config/constants';
import { generateExplanation } from '../ai/explain';
import { BloodReport } from '../models/BloodReport';
import { Prediction } from '../models/Prediction';
import { recordAudit } from '../services/auditService';
import {
  createPredictionForReport,
  getPrediction,
  serializePrediction,
  summarizePrediction,
} from '../services/predictionService';
import { ApiError } from '../utils/ApiError';
import { asyncHandler } from '../utils/asyncHandler';
import { predictionCreateSchema } from '../validation/schemas';

export const createPredictionHandler = asyncHandler(async (req: Request, res: Response) => {
  const input = predictionCreateSchema.parse(req.body);
  const doc = await createPredictionForReport(req.user!.id, input.reportId);
  await recordAudit({
    req,
    action: AUDIT_ACTIONS.PREDICTION_CREATED,
    entityType: 'Prediction',
    entityId: String(doc._id),
  });
  res.status(201).json({ prediction: serializePrediction(doc) });
});

export const getPredictionHandler = asyncHandler(async (req: Request, res: Response) => {
  const doc = await getPrediction(req.user!.id, req.params.id);
  res.json({ prediction: serializePrediction(doc) });
});

export const listPredictionsHandler = asyncHandler(async (req: Request, res: Response) => {
  const reportId = typeof req.query.reportId === 'string' ? req.query.reportId : undefined;
  const filter: Record<string, unknown> = { owner: req.user!.id };
  if (reportId) filter.report = reportId;
  const docs = await Prediction.find(filter).sort({ createdAt: -1 }).limit(50);
  res.json({ predictions: docs.map((d) => summarizePrediction(d)) });
});

export const explainPredictionHandler = asyncHandler(async (req: Request, res: Response) => {
  const doc = await getPrediction(req.user!.id, req.params.id);
  if (doc.status !== 'completed') {
    throw ApiError.badRequest('This prediction has no results to explain.');
  }
  const force = req.query.force === '1' || req.query.force === 'true';

  if (doc.explanation && !force) {
    res.json({ prediction: serializePrediction(doc), cached: true });
    return;
  }

  const report = await BloodReport.findById(doc.report);
  if (!report) throw ApiError.notFound('Linked report not found.');
  const snapshot = report.patientSnapshot!;

  const record = await generateExplanation(doc.results as Parameters<typeof generateExplanation>[0], {
    age: snapshot.age,
    sex: snapshot.sex,
  });

  doc.explanation = {
    source: record.source,
    provider: record.provider,
    model: record.model,
    generatedAt: record.generatedAt,
    fallbackReason: record.fallbackReason,
    content: record.content,
  };
  await doc.save();

  await recordAudit({
    req,
    action: AUDIT_ACTIONS.EXPLANATION_GENERATED,
    entityType: 'Prediction',
    entityId: String(doc._id),
    meta: { source: record.source },
  });

  res.json({ prediction: serializePrediction(doc), cached: false });
});
