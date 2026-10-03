/**
 * Demo data seeding for college demonstrations.
 *
 * Creates:
 *   - a demo user (demo@medipredict.local) with labeled SYNTHETIC reports
 *     covering all demonstration scenarios (normal, glucose, anemia, lipids,
 *     liver, kidney) + a few reports forming time-series for trend charts;
 *   - an admin user (admin@medipredict.local) for the admin panel;
 *   - predictions computed with the REAL analysis engine for every report.
 *
 * ALL synthetic data is labeled: "DEMO / SYNTHETIC DATA — NOT FOR CLINICAL USE".
 *
 * Usage (safe to re-run — existing demo/admin data is replaced):
 *   npm run demo:seed
 */
import bcrypt from 'bcryptjs';
import { env } from '../server/src/config/env';
import { connectDb, disconnectDb } from '../server/src/db/connect';
import { BloodReport } from '../server/src/models/BloodReport';
import { Patient } from '../server/src/models/Patient';
import { Prediction } from '../server/src/models/Prediction';
import { User } from '../server/src/models/User';
import { createReport, type ReportCreateInput } from '../server/src/services/reportService';
import { createPredictionForReport } from '../server/src/services/predictionService';

const DEMO_LABEL = 'DEMO / SYNTHETIC DATA — NOT FOR CLINICAL USE';
const DEMO_EMAIL = process.env.DEMO_USER_EMAIL || 'demo@medipredict.local';
const DEMO_PASSWORD = process.env.DEMO_USER_PASSWORD || 'DemoPass123!';
const ADMIN_EMAIL = process.env.DEMO_ADMIN_EMAIL || 'admin@medipredict.local';
const ADMIN_PASSWORD = process.env.DEMO_ADMIN_PASSWORD || 'AdminPass123!';

type Tests = Record<string, { value: number; unit: string }>;

/** A plausible healthy adult panel (synthetic). */
function normalPanel(): Tests {
  return {
    hemoglobin: { value: 14.6, unit: 'g/dL' },
    rbc: { value: 5.1, unit: 'million/µL' },
    wbc: { value: 6800, unit: 'cells/µL' },
    platelets: { value: 245000, unit: 'cells/µL' },
    mcv: { value: 88, unit: 'fL' },
    fasting_glucose: { value: 92, unit: 'mg/dL' },
    hba1c: { value: 5.2, unit: '%' },
    total_cholesterol: { value: 178, unit: 'mg/dL' },
    ldl: { value: 96, unit: 'mg/dL' },
    hdl: { value: 52, unit: 'mg/dL' },
    triglycerides: { value: 120, unit: 'mg/dL' },
    alt: { value: 24, unit: 'U/L' },
    ast: { value: 22, unit: 'U/L' },
    alp: { value: 80, unit: 'U/L' },
    total_bilirubin: { value: 0.8, unit: 'mg/dL' },
    albumin: { value: 4.4, unit: 'g/dL' },
    creatinine: { value: 0.95, unit: 'mg/dL' },
    urea: { value: 14, unit: 'mg/dL' },
  };
}

interface Scenario {
  name: string;
  patient: 'a' | 'b' | 'oneoffM52' | 'oneoffM61';
  date: string;
  context?: ReportCreateInput['context'];
  tests: Tests;
}

const scenarios: Scenario[] = [
  {
    name: 'Normal report',
    patient: 'a',
    date: '2026-04-10',
    context: { bmi: 24.1, diastolicBp: 78, systolicBp: 118, smoker: 'never' },
    tests: normalPanel(),
  },
  {
    name: 'Glucose-related pattern (early)',
    patient: 'a',
    date: '2026-06-15',
    context: { bmi: 25.4, diastolicBp: 82, systolicBp: 124, smoker: 'never' },
    tests: { ...normalPanel(), fasting_glucose: { value: 112, unit: 'mg/dL' }, hba1c: { value: 6.0, unit: '%' } },
  },
  {
    name: 'Glucose-related pattern (follow-up)',
    patient: 'a',
    date: '2026-09-20',
    context: { bmi: 26.2, diastolicBp: 84, systolicBp: 128, smoker: 'never' },
    tests: { ...normalPanel(), fasting_glucose: { value: 128, unit: 'mg/dL' }, hba1c: { value: 6.6, unit: '%' } },
  },
  {
    name: 'Normal report (baseline B)',
    patient: 'b',
    date: '2026-05-02',
    context: { bmi: 22.4, diastolicBp: 74, systolicBp: 112, smoker: 'never' },
    tests: normalPanel(),
  },
  {
    name: 'Anemia-related pattern',
    patient: 'b',
    date: '2026-07-18',
    context: { bmi: 21.6, diastolicBp: 72, systolicBp: 110 },
    tests: {
      ...normalPanel(),
      hemoglobin: { value: 10.4, unit: 'g/dL' },
      rbc: { value: 3.9, unit: 'million/µL' },
      mcv: { value: 74, unit: 'fL' },
      ferritin: { value: 12, unit: 'ng/mL' },
    },
  },
  {
    name: 'Lipid-related pattern',
    patient: 'b',
    date: '2026-09-30',
    context: { bmi: 23.8, diastolicBp: 80, systolicBp: 122, smoker: 'former' },
    tests: {
      ...normalPanel(),
      total_cholesterol: { value: 248, unit: 'mg/dL' },
      ldl: { value: 168, unit: 'mg/dL' },
      hdl: { value: 36, unit: 'mg/dL' },
      triglycerides: { value: 240, unit: 'mg/dL' },
    },
  },
  {
    name: 'Liver-function pattern',
    patient: 'oneoffM52',
    date: '2026-08-05',
    context: { bmi: 29.2, diastolicBp: 88, smoker: 'former' },
    tests: {
      ...normalPanel(),
      alt: { value: 96, unit: 'U/L' },
      ast: { value: 74, unit: 'U/L' },
      alp: { value: 140, unit: 'U/L' },
      total_bilirubin: { value: 1.6, unit: 'mg/dL' },
    },
  },
  {
    name: 'Kidney-function pattern',
    patient: 'oneoffM61',
    date: '2026-08-22',
    context: { bmi: 27.0, diastolicBp: 90, smoker: 'never' },
    tests: {
      ...normalPanel(),
      hemoglobin: { value: 11.2, unit: 'g/dL' },
      creatinine: { value: 1.9, unit: 'mg/dL' },
      urea: { value: 38, unit: 'mg/dL' },
    },
  },
];

const PATIENTS = {
  a: { name: 'Demo Patient A (synthetic)', sex: 'male' as const, birthYear: 1981 },
  b: { name: 'Demo Patient B (synthetic)', sex: 'female' as const, birthYear: 1988 },
  oneoffM52: { name: undefined, age: 52, sex: 'male' as const },
  oneoffM61: { name: undefined, age: 61, sex: 'male' as const },
};

async function main(): Promise<void> {
  console.log('MediPredict AI — demo seeding');
  await connectDb();

  // Clean previous demo/admin data (idempotent re-runs).
  for (const email of [DEMO_EMAIL, ADMIN_EMAIL]) {
    const existing = await User.findOne({ email });
    if (existing) {
      await Promise.all([
        Prediction.deleteMany({ owner: existing._id }),
        BloodReport.deleteMany({ owner: existing._id }),
        Patient.deleteMany({ owner: existing._id }),
      ]);
      await existing.deleteOne();
      console.log(`  replaced existing user ${email}`);
    }
  }

  const demoUser = await User.create({
    name: 'Demo User',
    email: DEMO_EMAIL,
    passwordHash: await bcrypt.hash(DEMO_PASSWORD, 12),
    role: 'user',
  });
  const adminUser = await User.create({
    name: 'Admin User',
    email: ADMIN_EMAIL,
    passwordHash: await bcrypt.hash(ADMIN_PASSWORD, 12),
    role: 'admin',
  });

  const patientA = await Patient.create({ owner: demoUser._id, ...PATIENTS.a });
  const patientB = await Patient.create({ owner: demoUser._id, ...PATIENTS.b });

  let created = 0;
  for (const s of scenarios) {
    const linkProfile = s.patient === 'a' || s.patient === 'b';
    const patientId = s.patient === 'a' ? String(patientA._id) : s.patient === 'b' ? String(patientB._id) : undefined;
    const p = PATIENTS[s.patient];
    const snapshot = linkProfile
      ? {
          name: (p as { name: string }).name,
          age: new Date(`${s.date}T00:00:00Z`).getUTCFullYear() - (p as { birthYear: number }).birthYear,
          sex: p.sex,
        }
      : { name: undefined, age: (p as { age: number }).age, sex: p.sex };

    const input: ReportCreateInput = {
      ...(patientId ? { patientId } : {}),
      patient: { name: snapshot.name, age: snapshot.age, sex: snapshot.sex },
      ...(s.context ? { context: s.context } : {}),
      report: { date: s.date, labName: 'Synthetic Demo Lab', fasting: true },
      notes: `${DEMO_LABEL} — scenario: ${s.name}`,
      tests: s.tests,
    };

    const report = await createReport(demoUser._id.toString(), input, snapshot, 'demo', DEMO_LABEL);
    await createPredictionForReport(demoUser._id.toString(), String(report._id));
    created += 1;
    console.log(`  ✓ ${s.name} (${s.date}) → report + prediction`);
  }

  console.log('');
  console.log(`Seeded ${created} synthetic reports with real engine predictions.`);
  console.log('');
  console.log('Sign-in credentials:');
  console.log(`  User : ${DEMO_EMAIL} / ${DEMO_PASSWORD}`);
  console.log(`  Admin: ${ADMIN_EMAIL} / ${ADMIN_PASSWORD}`);
  console.log('');
  console.log(`All synthetic data is labeled: "${DEMO_LABEL}"`);

  await disconnectDb();
}

main().catch(async (err) => {
  console.error('Seeding failed:', err);
  try {
    await disconnectDb();
  } catch {
    /* ignore */
  }
  process.exit(1);
});
