import type { Request, Response } from 'express';
import { AUDIT_ACTIONS } from '../config/constants';
import { Patient } from '../models/Patient';
import { recordAudit } from '../services/auditService';
import {
  compareReports,
  createReport,
  deleteReport,
  getReport,
  getTrends,
  listReports,
  serializeReport,
} from '../services/reportService';
import { getLatestPredictionsForReports, summarizePrediction } from '../services/predictionService';
import { ApiError } from '../utils/ApiError';
import { asyncHandler } from '../utils/asyncHandler';
import { compareSchema, paginationSchema, reportCreateSchema } from '../validation/schemas';

export const createReportHandler = asyncHandler(async (req: Request, res: Response) => {
  const input = reportCreateSchema.parse(req.body);

  // Resolve the patient snapshot: saved profile (age derived from birth year)
  // or the inline details supplied with this report.
  let snapshot: { name?: string; age: number; sex: 'male' | 'female' | 'other' };
  if (input.patientId) {
    const patient = await Patient.findOne({ _id: input.patientId, owner: req.user!.id });
    if (!patient) {
      throw ApiError.validation('Patient profile not found.', [
        { path: 'patientId', message: 'Unknown patient profile or not owned by you.' },
      ]);
    }
    const reportYear = new Date(`${input.report.date}T00:00:00Z`).getUTCFullYear();
    if (!patient.birthYear) {
      throw ApiError.validation('This patient profile has no birth year.', [
        { path: 'patientId', message: 'Please add a birth year to the patient profile first.' },
      ]);
    }
    const age = Math.min(120, Math.max(0, reportYear - patient.birthYear));
    snapshot = { name: patient.name, age, sex: patient.sex as 'male' | 'female' | 'other' };
  } else {
    snapshot = {
      name: input.patient!.name,
      age: input.patient!.age,
      sex: input.patient!.sex,
    };
  }

  const doc = await createReport(req.user!.id, input, snapshot);
  await recordAudit({
    req,
    action: AUDIT_ACTIONS.REPORT_CREATED,
    entityType: 'BloodReport',
    entityId: String(doc._id),
    meta: { testCount: Object.keys(input.tests).length },
  });
  res.status(201).json({ report: serializeReport(doc) });
});

export const listReportsHandler = asyncHandler(async (req: Request, res: Response) => {
  const query = paginationSchema.parse(req.query);
  const result = await listReports(req.user!.id, query);
  const latest = await getLatestPredictionsForReports(
    req.user!.id,
    result.items.map((i) => i.id)
  );
  const items = result.items.map((item) => ({
    ...item,
    latestPrediction: latest.get(item.id) ? summarizePrediction(latest.get(item.id)!) : null,
  }));
  res.json({ ...result, items });
});

export const getReportHandler = asyncHandler(async (req: Request, res: Response) => {
  const doc = await getReport(req.user!.id, req.params.id);
  const latest = await getLatestPredictionsForReports(req.user!.id, [String(doc._id)]);
  res.json({
    report: serializeReport(doc),
    latestPrediction: latest.get(String(doc._id))
      ? summarizePrediction(latest.get(String(doc._id))!)
      : null,
  });
});

export const deleteReportHandler = asyncHandler(async (req: Request, res: Response) => {
  await deleteReport(req.user!.id, req.params.id);
  await recordAudit({
    req,
    action: AUDIT_ACTIONS.REPORT_DELETED,
    entityType: 'BloodReport',
    entityId: req.params.id,
  });
  res.json({ ok: true });
});

export const compareReportsHandler = asyncHandler(async (req: Request, res: Response) => {
  const input = compareSchema.parse(req.body);
  const result = await compareReports(req.user!.id, [input.ids[0], input.ids[1]]);
  const latest = await getLatestPredictionsForReports(req.user!.id, input.ids);
  await recordAudit({ req, action: AUDIT_ACTIONS.REPORT_COMPARED, entityType: 'BloodReport' });
  res.json({
    ...result,
    predictions: {
      first: latest.get(result.first.id) ? summarizePrediction(latest.get(result.first.id)!) : null,
      second: latest.get(result.second.id) ? summarizePrediction(latest.get(result.second.id)!) : null,
    },
  });
});

export const trendsHandler = asyncHandler(async (req: Request, res: Response) => {
  const query = paginationSchema.partial().parse(req.query);
  const series = await getTrends(req.user!.id, { patientId: query.patientId });
  res.json({ series });
});
