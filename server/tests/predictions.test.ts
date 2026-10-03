import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import { loadModels } from '../src/ml/registry';
import { extractCookie, resetTestDb, setupTestDb, teardownTestDb } from './helpers/db';

const app = createApp();

async function registerAndLogin(email: string): Promise<string> {
  const res = await request(app)
    .post('/api/auth/register')
    .send({ name: 'P User', email, password: 'StrongPass123' });
  return extractCookie(res);
}

const FULL_PANEL = {
  patient: { name: 'P', age: 50, sex: 'male' },
  context: { bmi: 27.2, diastolicBp: 85 },
  report: { date: '2026-02-01', fasting: true },
  tests: {
    hemoglobin: { value: 14.0, unit: 'g/dL' },
    fasting_glucose: { value: 110, unit: 'mg/dL' },
    hba1c: { value: 5.9, unit: '%' },
    creatinine: { value: 1.0, unit: 'mg/dL' },
    urea: { value: 15, unit: 'mg/dL' },
    alt: { value: 30, unit: 'U/L' },
    ast: { value: 25, unit: 'U/L' },
    alp: { value: 90, unit: 'U/L' },
    total_bilirubin: { value: 0.9, unit: 'mg/dL' },
    albumin: { value: 4.2, unit: 'g/dL' },
  },
};

beforeAll(setupTestDb);
afterAll(teardownTestDb);
beforeEach(resetTestDb);

describe('predictions', () => {
  it('runs the full analysis pipeline and stores a completed prediction', async () => {
    const cookie = await registerAndLogin('pred1@test.local');
    const report = await request(app).post('/api/reports').set('Cookie', cookie).send(FULL_PANEL);
    const res = await request(app)
      .post('/api/predictions')
      .set('Cookie', cookie)
      .send({ reportId: report.body.report.id });
    expect(res.status).toBe(201);
    const p = res.body.prediction;
    expect(p.status).toBe('completed');
    expect(p.results.values.length).toBe(10);
    expect(p.results.summary.testsAnalyzed).toBe(10);
    expect(p.results.disclaimers.length).toBeGreaterThan(3);
    // Guideline panels present
    const panels = new Set(p.results.guidelines.map((g: { panel: string }) => g.panel));
    expect(panels.has('glycemic')).toBe(true);
    expect(panels.has('kidney')).toBe(true);
    expect(panels.has('liver')).toBe(true);
    // Computed values
    expect(typeof p.results.computed.egfr).toBe('number');
    expect(typeof p.results.computed.bmi).toBe('number');
  });

  it('runs available ML models with probabilities and contributions', async () => {
    const artifacts = loadModels().artifacts;
    const cookie = await registerAndLogin('pred2@test.local');
    const report = await request(app).post('/api/reports').set('Cookie', cookie).send(FULL_PANEL);
    const res = await request(app)
      .post('/api/predictions')
      .set('Cookie', cookie)
      .send({ reportId: report.body.report.id });

    const models = res.body.prediction.results.models;
    if (artifacts.length === 0) {
      expect(models).toHaveLength(0);
      return;
    }
    const diabetes = models.find((m: { targetId: string }) => m.targetId === 'diabetes_risk');
    expect(diabetes.status).toBe('ok');
    expect(diabetes.probability).toBeGreaterThanOrEqual(0);
    expect(diabetes.probability).toBeLessThanOrEqual(1);
    expect(Array.isArray(diabetes.contributions)).toBe(true);
    expect(diabetes.contributions.length).toBeGreaterThan(0);
    expect(diabetes.contributions[0]).toHaveProperty('direction');

    const kidney = models.find((m: { targetId: string }) => m.targetId === 'kidney_risk');
    expect(kidney.status).toBe('ok');

    // A "high" probability for a clearly abnormal panel is fine; ensure band matches thresholding.
    const bandOrder = ['low', 'borderline', 'moderate', 'high'];
    if (diabetes.probability < 0.25) expect(diabetes.band).toBe('low');
    else expect(bandOrder.indexOf(diabetes.band)).toBeGreaterThan(0);
  });

  it('skips models with missing inputs and lists what is missing', async () => {
    const cookie = await registerAndLogin('pred3@test.local');
    const report = await request(app)
      .post('/api/reports')
      .set('Cookie', cookie)
      .send({
        patient: { age: 60, sex: 'female' },
        report: { date: '2026-02-01', fasting: true },
        tests: { hemoglobin: { value: 12.5, unit: 'g/dL' } },
      });
    const res = await request(app)
      .post('/api/predictions')
      .set('Cookie', cookie)
      .send({ reportId: report.body.report.id });
    const models = res.body.prediction.results.models;
    if (models.length === 0) return;
    const kidney = models.find((m: { targetId: string }) => m.targetId === 'kidney_risk');
    expect(kidney.status).toBe('insufficient_data');
    expect(kidney.missingFeatures.length).toBeGreaterThan(0);
    expect(kidney.probability).toBeUndefined();
  });

  it('generates a deterministic explanation when the LLM is disabled', async () => {
    const cookie = await registerAndLogin('pred4@test.local');
    const report = await request(app).post('/api/reports').set('Cookie', cookie).send(FULL_PANEL);
    const pred = await request(app)
      .post('/api/predictions')
      .set('Cookie', cookie)
      .send({ reportId: report.body.report.id });

    const first = await request(app)
      .post(`/api/predictions/${pred.body.prediction.id}/explain`)
      .set('Cookie', cookie);
    expect(first.status).toBe(200);
    expect(first.body.prediction.explanation.source).toBe('template');
    expect(first.body.prediction.explanation.content.summary.length).toBeGreaterThan(20);
    expect(first.body.prediction.explanation.content.disclaimer).toContain('not a medical diagnosis');

    // Second call is cached unless force=1
    const second = await request(app)
      .post(`/api/predictions/${pred.body.prediction.id}/explain`)
      .set('Cookie', cookie);
    expect(second.body.cached).toBe(true);
  });

  it('lists predictions per report', async () => {
    const cookie = await registerAndLogin('pred5@test.local');
    const report = await request(app).post('/api/reports').set('Cookie', cookie).send(FULL_PANEL);
    await request(app).post('/api/predictions').set('Cookie', cookie).send({ reportId: report.body.report.id });
    await request(app).post('/api/predictions').set('Cookie', cookie).send({ reportId: report.body.report.id });

    const list = await request(app)
      .get(`/api/predictions?reportId=${report.body.report.id}`)
      .set('Cookie', cookie);
    expect(list.status).toBe(200);
    expect(list.body.predictions).toHaveLength(2);
    expect(list.body.predictions[0]).toHaveProperty('headline');
  });

  it('rejects predictions for other users’ reports', async () => {
    const cookieA = await registerAndLogin('pred6a@test.local');
    const cookieB = await registerAndLogin('pred6b@test.local');
    const report = await request(app).post('/api/reports').set('Cookie', cookieA).send(FULL_PANEL);
    const res = await request(app)
      .post('/api/predictions')
      .set('Cookie', cookieB)
      .send({ reportId: report.body.report.id });
    expect(res.status).toBe(404);
  });
});
