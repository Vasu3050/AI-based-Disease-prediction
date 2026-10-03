import type { Request, Response } from 'express';
import { AUDIT_ACTIONS } from '../config/constants';
import { BloodReport } from '../models/BloodReport';
import { Patient } from '../models/Patient';
import { recordAudit } from '../services/auditService';
import { ApiError } from '../utils/ApiError';
import { asyncHandler } from '../utils/asyncHandler';
import { patientCreateSchema, patientUpdateSchema } from '../validation/schemas';

export const listPatients = asyncHandler(async (req: Request, res: Response) => {
  const patients = await Patient.find({ owner: req.user!.id }).sort({ createdAt: -1 }).limit(200);
  res.json({ patients: patients.map((p) => p.toJSON()) });
});

export const createPatient = asyncHandler(async (req: Request, res: Response) => {
  const input = patientCreateSchema.parse(req.body);
  const patient = await Patient.create({ ...input, owner: req.user!.id });
  await recordAudit({
    req,
    action: AUDIT_ACTIONS.PATIENT_CREATED,
    entityType: 'Patient',
    entityId: String(patient._id),
  });
  res.status(201).json({ patient: patient.toJSON() });
});

async function getOwnedPatient(req: Request): Promise<InstanceType<typeof Patient>> {
  const patient = await Patient.findOne({ _id: req.params.id, owner: req.user!.id });
  if (!patient) throw ApiError.notFound('Patient profile not found.');
  return patient;
}

export const updatePatient = asyncHandler(async (req: Request, res: Response) => {
  const patient = await getOwnedPatient(req);
  const input = patientUpdateSchema.parse(req.body);
  Object.assign(patient, input);
  await patient.save();
  await recordAudit({
    req,
    action: AUDIT_ACTIONS.PATIENT_UPDATED,
    entityType: 'Patient',
    entityId: String(patient._id),
  });
  res.json({ patient: patient.toJSON() });
});

export const deletePatient = asyncHandler(async (req: Request, res: Response) => {
  const patient = await getOwnedPatient(req);
  // Unlink reports (keep the report's patient snapshot for integrity).
  await BloodReport.updateMany({ owner: req.user!.id, patient: patient._id }, { $unset: { patient: 1 } });
  await patient.deleteOne();
  await recordAudit({
    req,
    action: AUDIT_ACTIONS.PATIENT_DELETED,
    entityType: 'Patient',
    entityId: String(patient._id),
  });
  res.json({ ok: true });
});
