#!/usr/bin/env node
/**
 * End-to-end API smoke test.
 *
 * Runs the complete flow against a LIVE server: health → register → login →
 * patient → report → prediction → (optional LLM explanation) → compare →
 * trends → account deletion, plus admin endpoints when the seeded admin
 * account exists.
 *
 * Usage:
 *   npm run smoke                       # server must be running on :5000
 *   SMOKE_BASE_URL=... npm run smoke
 *   node scripts/smoke.mjs --with-llm   # also exercise the LLM explanation
 *
 * Exit code 0 = all checks passed.
 */
import http from 'node:http';
import https from 'node:https';
import { URL } from 'node:url';

const BASE = process.env.SMOKE_BASE_URL ?? 'http://localhost:5000/api';
const WITH_LLM = process.argv.includes('--with-llm');

/**
 * Raw JSON POST without undici's hard 300s cap — needed for slow local
 * reasoning models (the regular fetch() would abort before they finish).
 */
function postJsonRaw(urlString, headers, body, timeoutMs) {
  return new Promise((resolve, reject) => {
    const u = new URL(urlString);
    const lib = u.protocol === 'https:' ? https : http;
    const req = lib.request(
      {
        hostname: u.hostname,
        port: u.port || (u.protocol === 'https:' ? 443 : 80),
        path: u.pathname + u.search,
        method: 'POST',
        headers: { ...headers, 'Content-Length': Buffer.byteLength(body) },
      },
      (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () =>
          resolve({ status: res.statusCode ?? 0, text: Buffer.concat(chunks).toString('utf8') })
        );
      }
    );
    req.setTimeout(timeoutMs, () => req.destroy(new Error(`request timed out after ${timeoutMs}ms`)));
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

const results = [];
let cookie = '';

async function req(method, path, body, { expectStatus, timeoutMs = 30000 } = {}) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(`${BASE}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(cookie ? { Cookie: cookie } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: ctrl.signal,
    });
    const setCookies = res.headers.getSetCookie?.() ?? [];
    if (setCookies.length > 0) {
      cookie = setCookies.map((c) => c.split(';')[0]).join('; ');
    }
    const text = await res.text();
    let data = {};
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      data = { raw: text };
    }
    if (expectStatus && res.status !== expectStatus) {
      throw new Error(`${method} ${path} → ${res.status} (expected ${expectStatus}): ${text.slice(0, 200)}`);
    }
    return { status: res.status, data };
  } finally {
    clearTimeout(timer);
  }
}

function check(name, fn) {
  return fn().then(
    (detail) => {
      results.push({ name, ok: true, detail });
      console.log(`  ✓ ${name}${detail ? ` — ${detail}` : ''}`);
    },
    (err) => {
      results.push({ name, ok: false, detail: err.message });
      console.error(`  ✗ ${name} — ${err.message}`);
    }
  );
}

async function main() {
  console.log(`MediPredict AI — API smoke test against ${BASE}\n`);
  const stamp = Date.now();
  const email = `smoke+${stamp}@test.local`;
  const password = 'SmokePass123!';
  let reportId = null;
  let reportId2 = null;
  let predictionId = null;

  await check('health endpoint', async () => {
    const { data } = await req('GET', '/health', undefined, { expectStatus: 200 });
    return `db=${data.db}`;
  });

  await check('register user', async () => {
    const { data } = await req('POST', '/auth/register', { name: 'Smoke Test', email, password }, { expectStatus: 201 });
    return `user=${data.user.email}`;
  });

  await check('session (GET /users/me)', async () => {
    const { data } = await req('GET', '/users/me', undefined, { expectStatus: 200 });
    return `${data.user.email} (${data.user.role})`;
  });

  await check('weak password rejected', async () => {
    const { status } = await req('POST', '/auth/register', { name: 'X', email: `weak+${stamp}@test.local`, password: 'short' });
    if (status !== 422) throw new Error(`expected 422, got ${status}`);
    return '422 + validation details';
  });

  await check('create patient profile', async () => {
    const { data } = await req(
      'POST',
      '/patients',
      { name: 'Smoke Patient', sex: 'male', birthYear: 1980 },
      { expectStatus: 201 }
    );
    return `patient=${data.patient.name}`;
  });

  await check('create valid report', async () => {
    const { data } = await req(
      'POST',
      '/reports',
      {
        patient: { name: 'Smoke Patient', age: 46, sex: 'male' },
        context: { bmi: 26.5, diastolicBp: 84 },
        report: { date: new Date(Date.now() - 86400000).toISOString().slice(0, 10), fasting: true },
        tests: {
          hemoglobin: { value: 14.2, unit: 'g/dL' },
          fasting_glucose: { value: 108, unit: 'mg/dL' },
          hba1c: { value: 5.8, unit: '%' },
          creatinine: { value: 1.0, unit: 'mg/dL' },
        },
      },
      { expectStatus: 201 }
    );
    reportId = data.report.id;
    return `report=${reportId}`;
  });

  await check('invalid unit rejected', async () => {
    const { status, data } = await req('POST', '/reports', {
      patient: { age: 40, sex: 'female' },
      report: { date: '2026-01-10' },
      tests: { hemoglobin: { value: 13.5, unit: 'bananas' } },
    });
    if (status !== 422) throw new Error(`expected 422, got ${status}`);
    return data.error?.details?.[0]?.message ?? 'validation error';
  });

  await check('implausible value rejected', async () => {
    const { status } = await req('POST', '/reports', {
      patient: { age: 40, sex: 'female' },
      report: { date: '2026-01-10' },
      tests: { fasting_glucose: { value: 5000, unit: 'mg/dL' } },
    });
    if (status !== 422) throw new Error(`expected 422, got ${status}`);
    return '422';
  });

  await check('run prediction', async () => {
    const { data } = await req('POST', '/predictions', { reportId }, { expectStatus: 201 });
    predictionId = data.prediction.id;
    const r = data.prediction.results;
    if (!r || r.values.length !== 4) throw new Error('unexpected analysis shape');
    return `${r.values.length} values · ${r.guidelines.length} guideline findings · ${r.models.length} models`;
  });

  await check('models produce estimates or explicit skips', async () => {
    const { data } = await req('GET', `/predictions/${predictionId}`, undefined, { expectStatus: 200 });
    const models = data.prediction.results.models;
    if (models.length === 0) return 'no model artifacts loaded (acceptable)';
    const ok = models.filter((m) => m.status === 'ok');
    if (ok.some((m) => typeof m.probability !== 'number')) throw new Error('model without probability');
    return `${ok.length}/${models.length} models ran`;
  });

  if (WITH_LLM) {
    console.log('  (LLM check enabled — local reasoning models can take several minutes)');
    await check('generate explanation (LLM or fallback)', async () => {
      const { status, text } = await postJsonRaw(
        `${BASE}/predictions/${predictionId}/explain`,
        { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) },
        '{}',
        660_000
      );
      if (status !== 200) throw new Error(`explain → ${status}: ${text.slice(0, 200)}`);
      const data = JSON.parse(text);
      const ex = data.prediction?.explanation;
      if (!ex) throw new Error('no explanation stored');
      return `source=${ex.source}${ex.fallbackReason ? ` (${String(ex.fallbackReason).slice(0, 80)})` : ''}`;
    });
  }

  await check('create second report + compare', async () => {
    const { data } = await req(
      'POST',
      '/reports',
      {
        patient: { name: 'Smoke Patient', age: 46, sex: 'male' },
        report: { date: new Date().toISOString().slice(0, 10), fasting: true },
        tests: {
          hemoglobin: { value: 13.1, unit: 'g/dL' },
          fasting_glucose: { value: 118, unit: 'mg/dL' },
          hba1c: { value: 6.1, unit: '%' },
        },
      },
      { expectStatus: 201 }
    );
    reportId2 = data.report.id;
    const cmp = await req('POST', '/reports/compare', { ids: [reportId, reportId2] }, { expectStatus: 200 });
    const deltas = cmp.data.deltas;
    if (!Array.isArray(deltas) || deltas.length === 0) throw new Error('no deltas returned');
    return `${deltas.length} value deltas`;
  });

  await check('trends endpoint', async () => {
    const { data } = await req('GET', '/reports/trends', undefined, { expectStatus: 200 });
    if (!Array.isArray(data.series)) throw new Error('bad trends payload');
    return `${data.series.length} series`;
  });

  await check('unauthorized access blocked', async () => {
    const saved = cookie;
    cookie = '';
    try {
      const { status } = await req('GET', '/reports');
      if (status !== 401) throw new Error(`expected 401, got ${status}`);
      return '401 without session';
    } finally {
      cookie = saved;
    }
  });

  await check('admin: login + overview (seeded admin)', async () => {
    const saved = cookie;
    cookie = '';
    try {
      const login = await req('POST', '/auth/login', {
        email: 'admin@medipredict.local',
        password: 'AdminPass123!',
      });
      if (login.status === 401) return 'SKIPPED (no seeded admin account)';
      if (login.status !== 200) throw new Error(`admin login status ${login.status}`);
      const { data } = await req('GET', '/admin/overview', undefined, { expectStatus: 200 });
      return `users=${data.users.total} · reports=${data.reports.total}`;
    } finally {
      cookie = saved;
    }
  });

  await check('cleanup (delete reports + account)', async () => {
    if (reportId) {
      await req('DELETE', `/reports/${reportId}`, undefined, { expectStatus: 200 });
    }
    if (reportId2) {
      await req('DELETE', `/reports/${reportId2}`, undefined, { expectStatus: 200 });
    }
    await req('DELETE', '/users/me', { password }, { expectStatus: 200 });
    return 'data fully removed';
  });

  const failed = results.filter((r) => !r.ok);
  console.log('\n' + '='.repeat(60));
  console.log(`Smoke test: ${results.length - failed.length}/${results.length} checks passed`);
  if (failed.length > 0) {
    console.log('FAILED CHECKS:');
    for (const f of failed) console.log(`  ✗ ${f.name}: ${f.detail}`);
    process.exit(1);
  }
  console.log('All checks passed.');
}

main().catch((err) => {
  console.error('\nSmoke test crashed:', err);
  process.exit(1);
});
