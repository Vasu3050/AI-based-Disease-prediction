import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import { extractCookie, resetTestDb, setupTestDb, teardownTestDb } from './helpers/db';

const app = createApp();

async function registerAndLogin(email: string): Promise<string> {
  const res = await request(app)
    .post('/api/auth/register')
    .send({ name: 'R User', email, password: 'StrongPass123' });
  expect(res.status).toBe(201);
  return extractCookie(res);
}

function validReport(overrides: Record<string, unknown> = {}) {
  return {
    patient: { name: 'P', age: 45, sex: 'male' },
    context: { bmi: 25.1, diastolicBp: 80 },
    report: { date: '2026-03-15', fasting: true },
    tests: {
      hemoglobin: { value: 14.2, unit: 'g/dL' },
      fasting_glucose: { value: 92, unit: 'mg/dL' },
    },
    ...overrides,
  };
}

beforeAll(setupTestDb);
afterAll(teardownTestDb);
beforeEach(resetTestDb);

describe('reports', () => {
  it('creates a report, normalising units to canonical form', async () => {
    const cookie = await registerAndLogin('reports1@test.local');
    const res = await request(app)
      .post('/api/reports')
      .set('Cookie', cookie)
      .send(
        validReport({
          tests: {
            hemoglobin: { value: 142, unit: 'g/L' },
            fasting_glucose: { value: 7, unit: 'mmol/L' },
          },
        })
      );
    expect(res.status).toBe(201);
    const tests = res.body.report.tests;
    expect(tests.hemoglobin.value).toBeCloseTo(14.2, 3);
    expect(tests.hemoglobin.unit).toBe('g/dL');
    expect(tests.hemoglobin.submittedUnit).toBe('g/L');
    expect(tests.fasting_glucose.value).toBeCloseTo(126.127, 2);
    expect(tests.fasting_glucose.unit).toBe('mg/dL');
    expect(tests.fasting_glucose.status).toBe('high');
  });

  it('rejects unknown tests, bad units, implausible values, empty and future dates', async () => {
    const cookie = await registerAndLogin('reports2@test.local');
    const cases: [Record<string, unknown>, string][] = [
      [{ tests: { covid: { value: 1, unit: 'x' } } }, 'unknown test'],
      [{ tests: { hemoglobin: { value: 14, unit: 'bananas' } } }, 'bad unit'],
      [{ tests: { hemoglobin: { value: 99, unit: 'g/dL' } } }, 'implausible'],
      [{ tests: {} }, 'no tests'],
      [{ report: { date: '2099-01-01', fasting: true } }, 'future date'],
    ];
    for (const [override, label] of cases) {
      const res = await request(app).post('/api/reports').set('Cookie', cookie).send(validReport(override));
      expect(res.status, label).toBe(422);
    }
  });

  it('enforces ownership isolation between users', async () => {
    const cookieA = await registerAndLogin('ownera@test.local');
    const cookieB = await registerAndLogin('ownerb@test.local');

    const created = await request(app).post('/api/reports').set('Cookie', cookieA).send(validReport());
    const id = created.body.report.id;

    const readB = await request(app).get(`/api/reports/${id}`).set('Cookie', cookieB);
    expect(readB.status).toBe(404);

    const listB = await request(app).get('/api/reports').set('Cookie', cookieB);
    expect(listB.body.items).toHaveLength(0);

    const delB = await request(app).delete(`/api/reports/${id}`).set('Cookie', cookieB);
    expect(delB.status).toBe(404);
  });

  it('lists, filters, paginates and deletes', async () => {
    const cookie = await registerAndLogin('reports3@test.local');
    for (const date of ['2026-01-10', '2026-02-10', '2026-03-10']) {
      await request(app)
        .post('/api/reports')
        .set('Cookie', cookie)
        .send(validReport({ report: { date, fasting: true } }));
    }
    const list = await request(app).get('/api/reports?limit=2&page=1').set('Cookie', cookie);
    expect(list.status).toBe(200);
    expect(list.body.items).toHaveLength(2);
    expect(list.body.total).toBe(3);
    expect(list.body.pages).toBe(2);

    const from = await request(app).get('/api/reports?from=2026-02-01&to=2026-02-28').set('Cookie', cookie);
    expect(from.body.total).toBe(1);

    const del = await request(app).delete(`/api/reports/${list.body.items[0].id}`).set('Cookie', cookie);
    expect(del.status).toBe(200);
    const after = await request(app).get('/api/reports').set('Cookie', cookie);
    expect(after.body.total).toBe(2);
  });

  it('compares two reports with deltas and status changes', async () => {
    const cookie = await registerAndLogin('reports4@test.local');
    const a = await request(app)
      .post('/api/reports')
      .set('Cookie', cookie)
      .send(validReport({ tests: { fasting_glucose: { value: 92, unit: 'mg/dL' } } }));
    const b = await request(app)
      .post('/api/reports')
      .set('Cookie', cookie)
      .send(
        validReport({
          report: { date: '2026-06-15', fasting: true },
          tests: { fasting_glucose: { value: 130, unit: 'mg/dL' } },
        })
      );
    const res = await request(app)
      .post('/api/reports/compare')
      .set('Cookie', cookie)
      .send({ ids: [a.body.report.id, b.body.report.id] });
    expect(res.status).toBe(200);
    expect(res.body.first.reportDate).toBe('2026-03-15');
    expect(res.body.second.reportDate).toBe('2026-06-15');
    const glucose = res.body.deltas.find((d: { key: string }) => d.key === 'fasting_glucose');
    expect(glucose.a).toBe(92);
    expect(glucose.b).toBe(130);
    expect(glucose.delta).toBe(38);
    expect(glucose.statusA).toBe('normal');
    expect(glucose.statusB).toBe('high');
  });

  it('rejects comparing identical ids', async () => {
    const cookie = await registerAndLogin('reports5@test.local');
    const r = await request(app).post('/api/reports').set('Cookie', cookie).send(validReport());
    const res = await request(app)
      .post('/api/reports/compare')
      .set('Cookie', cookie)
      .send({ ids: [r.body.report.id, r.body.report.id] });
    expect(res.status).toBe(422);
  });

  it('returns trend series across reports', async () => {
    const cookie = await registerAndLogin('reports6@test.local');
    await request(app)
      .post('/api/reports')
      .set('Cookie', cookie)
      .send(validReport({ report: { date: '2026-01-01', fasting: true } }));
    await request(app)
      .post('/api/reports')
      .set('Cookie', cookie)
      .send(
        validReport({
          report: { date: '2026-02-01', fasting: true },
          tests: { hemoglobin: { value: 13.0, unit: 'g/dL' } },
        })
      );
    const res = await request(app).get('/api/reports/trends').set('Cookie', cookie);
    expect(res.status).toBe(200);
    const hb = res.body.series.find((s: { key: string }) => s.key === 'hemoglobin');
    expect(hb.points).toHaveLength(2);
    expect(hb.points[0].date).toBe('2026-01-01');
    expect(hb.points[1].value).toBe(13.0);
  });

  it('deleting a report also deletes its predictions', async () => {
    const cookie = await registerAndLogin('reports7@test.local');
    const r = await request(app).post('/api/reports').set('Cookie', cookie).send(validReport());
    const pred = await request(app)
      .post('/api/predictions')
      .set('Cookie', cookie)
      .send({ reportId: r.body.report.id });
    expect(pred.status).toBe(201);
    await request(app).delete(`/api/reports/${r.body.report.id}`).set('Cookie', cookie);
    const gone = await request(app).get(`/api/predictions/${pred.body.prediction.id}`).set('Cookie', cookie);
    expect(gone.status).toBe(404);
  });
});
