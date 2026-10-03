import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from '../config/constants';
import { convertToCanonical, getTestDef, normalizeTestEntry } from '../domain/catalog';
import { analyzeValue } from '../ml/engine';
import { BloodReport, type BloodReportDoc } from '../models/BloodReport';
import { Prediction } from '../models/Prediction';
import { ApiError } from '../utils/ApiError';
import type { z } from 'zod';
import type { reportCreateSchema } from '../validation/schemas';

export type ReportCreateInput = z.infer<typeof reportCreateSchema>;

export interface StoredTestEntry {
  value: number;
  unit: string;
  submittedValue: number;
  submittedUnit: string;
  labRange?: { low?: number; high?: number };
}

function convertLabRange(
  key: string,
  unit: string,
  labRange?: { low?: number; high?: number }
): { low?: number; high?: number } | undefined {
  if (!labRange || (labRange.low === undefined && labRange.high === undefined)) return undefined;
  const def = getTestDef(key);
  if (!def) return undefined;
  const low = labRange.low !== undefined ? convertToCanonical(def, labRange.low, unit) : undefined;
  const high =
    labRange.high !== undefined ? convertToCanonical(def, labRange.high, unit) : undefined;
  const cleanLow = low === null ? undefined : low;
  const cleanHigh = high === null ? undefined : high;
  if (cleanLow === undefined && cleanHigh === undefined) return undefined;
  if (cleanLow !== undefined && cleanHigh !== undefined && cleanLow >= cleanHigh) {
    // Inconsistent lab range after conversion — discard rather than display nonsense.
    return undefined;
  }
  return { low: cleanLow, high: cleanHigh };
}

export function buildStoredTests(input: ReportCreateInput): Record<string, StoredTestEntry> {
  const tests: Record<string, StoredTestEntry> = {};
  for (const [key, entry] of Object.entries(input.tests)) {
    const def = getTestDef(key);
    if (!def) continue; // zod already rejected unknown keys
    const normalized = normalizeTestEntry(key, entry);
    if (!normalized.ok) {
      throw ApiError.validation(`Invalid value for ${def.label}: ${normalized.reason}`);
    }
    const stored: StoredTestEntry = {
      value: normalized.value,
      unit: def.canonicalUnit,
      submittedValue: entry.value,
      submittedUnit: entry.unit,
    };
    const labRange = convertLabRange(key, entry.unit, entry.labRange);
    if (labRange) stored.labRange = labRange;
    tests[key] = stored;
  }
  if (Object.keys(tests).length === 0) {
    throw ApiError.validation('At least one valid laboratory test is required.');
  }
  return tests;
}

export async function createReport(
  ownerId: string,
  input: ReportCreateInput,
  snapshot: { name?: string; age: number; sex: 'male' | 'female' | 'other' },
  source: 'manual' | 'demo' = 'manual',
  demoLabel?: string
): Promise<BloodReportDoc> {
  const tests = buildStoredTests(input);
  const doc = await BloodReport.create({
    owner: ownerId,
    patient: input.patientId,
    patientSnapshot: snapshot,
    context: input.context ?? {},
    reportDate: new Date(`${input.report.date}T00:00:00Z`),
    labName: input.report.labName,
    fasting: input.report.fasting,
    notes: input.notes,
    tests,
    source,
    demoLabel,
  });
  return doc;
}

export interface ClientReport {
  id: string;
  patientId?: string;
  patient: { name?: string; age: number; sex: string };
  context: Record<string, unknown>;
  reportDate: string;
  labName?: string;
  fasting?: boolean;
  notes?: string;
  tests: Record<
    string,
    {
      value: number;
      unit: string;
      submittedValue: number;
      submittedUnit: string;
      labRange?: { low?: number; high?: number };
      status?: 'low' | 'normal' | 'high';
      label?: string;
      group?: string;
    }
  >;
  source: 'manual' | 'demo';
  demoLabel?: string;
  createdAt: string;
  updatedAt: string;
}

export function serializeReport(doc: BloodReportDoc): ClientReport {
  // patientSnapshot is required by the schema (age/sex), so it is always present.
  const snapshot = doc.patientSnapshot!;
  const testsObj: ClientReport['tests'] = {};
  const testsMap = doc.tests as unknown as Map<string, StoredTestEntry>;
  for (const [key, entry] of testsMap.entries()) {
    const def = getTestDef(key);
    // Compute status vs reference range for convenient display (server-authoritative).
    const analysis = analyzeValue(
      key,
      { value: entry.value, labRange: entry.labRange },
      snapshot.sex as 'male' | 'female' | 'other'
    );
    testsObj[key] = {
      value: entry.value,
      unit: entry.unit,
      submittedValue: entry.submittedValue,
      submittedUnit: entry.submittedUnit,
      labRange: entry.labRange,
      status: analysis?.status,
      label: def?.label,
      group: def?.group,
    };
  }
  return {
    id: String(doc._id),
    patientId: doc.patient ? String(doc.patient) : undefined,
    patient: {
      name: snapshot.name ?? undefined,
      age: snapshot.age,
      sex: snapshot.sex,
    },
    context: (doc.context ?? {}) as Record<string, unknown>,
    reportDate: doc.reportDate.toISOString().slice(0, 10),
    labName: doc.labName ?? undefined,
    fasting: doc.fasting ?? undefined,
    notes: doc.notes ?? undefined,
    tests: testsObj,
    source: doc.source as 'manual' | 'demo',
    demoLabel: doc.demoLabel ?? undefined,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}

export async function listReports(
  ownerId: string,
  opts: { page: number; limit: number; patientId?: string; from?: string; to?: string; q?: string }
): Promise<{ items: ClientReport[]; total: number; page: number; limit: number; pages: number }> {
  const page = Math.max(1, opts.page);
  const limit = Math.min(Math.max(1, opts.limit || DEFAULT_PAGE_SIZE), MAX_PAGE_SIZE);
  const filter: Record<string, unknown> = { owner: ownerId };
  if (opts.patientId) filter.patient = opts.patientId;
  if (opts.from || opts.to) {
    const range: Record<string, Date> = {};
    if (opts.from) range.$gte = new Date(`${opts.from}T00:00:00Z`);
    if (opts.to) range.$lte = new Date(`${opts.to}T23:59:59Z`);
    filter.reportDate = range;
  }
  if (opts.q) {
    filter.$or = [
      { labName: { $regex: opts.q, $options: 'i' } },
      { 'patientSnapshot.name': { $regex: opts.q, $options: 'i' } },
    ];
  }
  const [total, docs] = await Promise.all([
    BloodReport.countDocuments(filter),
    BloodReport.find(filter).sort({ reportDate: -1, createdAt: -1 }).skip((page - 1) * limit).limit(limit),
  ]);
  return {
    items: docs.map(serializeReport),
    total,
    page,
    limit,
    pages: Math.max(1, Math.ceil(total / limit)),
  };
}

export async function getReport(ownerId: string, reportId: string): Promise<BloodReportDoc> {
  const doc = await BloodReport.findOne({ _id: reportId, owner: ownerId });
  if (!doc) throw ApiError.notFound('Report not found.');
  return doc;
}

export async function deleteReport(ownerId: string, reportId: string): Promise<void> {
  const doc = await BloodReport.findOne({ _id: reportId, owner: ownerId });
  if (!doc) throw ApiError.notFound('Report not found.');
  await Prediction.deleteMany({ report: doc._id, owner: ownerId });
  await doc.deleteOne();
}

/** Compare two reports (owner-scoped). Deltas computed over shared test keys. */
export async function compareReports(ownerId: string, ids: [string, string]) {
  const [a, b] = await Promise.all([
    BloodReport.findOne({ _id: ids[0], owner: ownerId }),
    BloodReport.findOne({ _id: ids[1], owner: ownerId }),
  ]);
  if (!a || !b) throw ApiError.notFound('One or both reports were not found.');

  const first = a.reportDate <= b.reportDate ? a : b;
  const second = a.reportDate <= b.reportDate ? b : a;
  const testsA = first.tests as unknown as Map<string, StoredTestEntry>;
  const testsB = second.tests as unknown as Map<string, StoredTestEntry>;

  const allKeys = new Set([...testsA.keys(), ...testsB.keys()]);
  const deltas = [];
  for (const key of allKeys) {
    const def = getTestDef(key);
    if (!def) continue;
    const av = testsA.get(key)?.value;
    const bv = testsB.get(key)?.value;
    const statusA = av !== undefined ? analyzeValue(key, { value: av }, first.patientSnapshot!.sex as 'male' | 'female' | 'other')?.status : undefined;
    const statusB = bv !== undefined ? analyzeValue(key, { value: bv }, second.patientSnapshot!.sex as 'male' | 'female' | 'other')?.status : undefined;
    deltas.push({
      key,
      label: def.label,
      unit: def.canonicalUnit,
      group: def.group,
      a: av ?? null,
      b: bv ?? null,
      delta: av !== undefined && bv !== undefined ? Math.round((bv - av) * 1000) / 1000 : null,
      statusA: statusA ?? null,
      statusB: statusB ?? null,
    });
  }
  deltas.sort((x, y) => x.group.localeCompare(y.group) || x.label.localeCompare(y.label));

  return {
    first: serializeReport(first),
    second: serializeReport(second),
    deltas,
  };
}

/** Time series for trend charts. */
export async function getTrends(ownerId: string, opts: { patientId?: string }) {
  const filter: Record<string, unknown> = { owner: ownerId };
  if (opts.patientId) filter.patient = opts.patientId;
  const docs = await BloodReport.find(filter).sort({ reportDate: 1 }).limit(200);
  const series: Record<string, { key: string; label: string; unit: string; points: { date: string; value: number; reportId: string }[] }> = {};
  for (const doc of docs) {
    const tests = doc.tests as unknown as Map<string, StoredTestEntry>;
    for (const [key, entry] of tests.entries()) {
      const def = getTestDef(key);
      if (!def) continue;
      const item = series[key] ?? { key, label: def.label, unit: def.canonicalUnit, points: [] };
      item.points.push({
        date: doc.reportDate.toISOString().slice(0, 10),
        value: entry.value,
        reportId: String(doc._id),
      });
      series[key] = item;
    }
  }
  return Object.values(series).sort((a, b) => a.label.localeCompare(b.label));
}
