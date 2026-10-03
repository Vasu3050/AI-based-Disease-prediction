# API Reference

Base URL: `http://localhost:5000/api` (dev). All requests/responses are JSON.
Authentication uses an **HTTP-only cookie** (`mp_token`) set by
`/auth/register` and `/auth/login`; a `Bearer` token is also accepted for
tooling. Errors always follow the shape:

```json
{ "error": { "code": "VALIDATION_ERROR", "message": "…", "details": [ { "path": "tests.hemoglobin", "message": "…" } ] } }
```

| Code | Meaning |
|---|---|
| 400 | Bad request / implausible operation |
| 401 | Not authenticated |
| 403 | Not allowed (role) / account disabled |
| 404 | Not found (also used to hide other users' resources) |
| 409 | Conflict (duplicate email) |
| 422 | Validation error (details included) |
| 429 | Rate limited |
| 5xx | Server-side failure (safe message only) |

Rate limits (per IP, disabled in tests): global 600 req/15 min; auth 30/15 min;
predictions 120/15 min.

## Meta

### `GET /meta/blood-tests`
Public catalog of supported tests (keys, groups, units, ranges, bounds) used to
render the report form. `{ engineVersion, tests: [...] }`.

### `GET /meta/llm`
LLM layer status for UI hints: `{ enabled, provider, model, message }`.
Never exposes keys or internal URLs.

### `GET /meta/models`
Loaded model artifacts (public summary) + registry errors.

### `GET /health`
`{ status, db, uptimeSeconds, timestamp }`.

## Authentication

### `POST /auth/register`
```json
{ "name": "Jane", "email": "jane@example.com", "password": "…10+ chars, letter+number…" }
```
→ `201 { user }` + sets cookie. Errors: 422 (validation), 409 (duplicate).

### `POST /auth/login`
`{ email, password }` → `200 { user }` + cookie. 401 invalid; 403 disabled.

### `POST /auth/logout`
Clears the cookie. `200 { ok: true }`.

## Account

All routes below require authentication.

### `GET /users/me` → `{ user }`

### `PATCH /users/me`
`{ name?, settings?: { theme?, highContrastCharts? } }` → `{ user }`.

### `POST /users/me/password`
`{ currentPassword, newPassword }` → `{ ok: true }`.

### `DELETE /users/me`
`{ password }` — deletes the account **and all health data** (patients,
reports, predictions, own audit trail). → `{ ok: true, deleted: true }`.

## Patients

### `GET /patients` → `{ patients: [...] }`
### `POST /patients`
`{ name, sex: "male|female|other", birthYear, externalRef?, notes? }` → `201 { patient }`.
### `PATCH /patients/:id` → `{ patient }`
### `DELETE /patients/:id` → `{ ok: true }` (reports keep their snapshots)

## Reports

### `POST /reports`
Strictly structured blood report. Provide either `patientId` (saved profile) or
inline `patient`:

```json
{
  "patientId": "…optional…",
  "patient": { "name": "optional", "age": 45, "sex": "male" },
  "context": { "bmi": 27.4, "diastolicBp": 84, "smoker": "never", "familyHistoryDiabetes": false },
  "report": { "date": "2026-09-14", "labName": "City Labs", "fasting": true },
  "notes": "optional, never used for prediction",
  "tests": {
    "hemoglobin":      { "value": 14.1, "unit": "g/dL", "labRange": { "low": 13, "high": 17 } },
    "fasting_glucose": { "value": 7.2,  "unit": "mmol/L" }
  }
}
```

Validation highlights: unknown tests/keys rejected; units must be accepted for
that test; values must be finite and within plausible bounds; date not in the
future; at least one test. `labRange` (in the submitted unit) overrides typical
ranges for that entry.

→ `201 { report }` — values stored in canonical units with the original
submission kept alongside; each test carries a computed `status`.

### `GET /reports?page&limit&patientId&from&to&q`
→ `{ items: [ { ...report, latestPrediction: summary|null } ], total, page, limit, pages }`.

### `GET /reports/:id` → `{ report, latestPrediction }`

### `DELETE /reports/:id` → cascades predictions for that report.

### `POST /reports/compare`
`{ "ids": ["<24hex>", "<24hex>"] }` → `{ first, second, deltas: [...], predictions: { first, second } }`,
where each delta is `{ key, label, unit, group, a, b, delta, statusA, statusB }`.

### `GET /reports/trends?patientId=`
→ `{ series: [ { key, label, unit, points: [ { date, value, reportId } ] } ] }`.

## Predictions

### `POST /predictions`
`{ "reportId": "<24hex>" }` → `201 { prediction }` — runs the full pipeline
(reference ranges → guidelines → ML models). The stored result includes
`values`, `abnormalValues`, `guidelines`, `models` (with probabilities,
bands, per-feature contributions, model cards), `computed` (eGFR/BMI),
`summary` and `disclaimers`.

### `GET /predictions/:id` → `{ prediction }`

### `GET /predictions?reportId=` → `{ predictions: [summary] }` (history of runs)

### `POST /predictions/:id/explain?force=1`
Generates (or regenerates with `force=1`) the explanation:
- with an LLM configured (server-side): validated JSON explanation,
  `source: "llm"` with provider/model;
- otherwise / on failure: deterministic template, `source: "template"` plus
  `fallbackReason`.
→ `{ prediction, cached }`.

## Admin (role `admin` required)

| Route | Description |
|---|---|
| `GET /admin/overview` | counts + 14-day prediction chart data |
| `GET /admin/users?page&limit&q` | user list incl. report counts |
| `PATCH /admin/users/:id` | `{ role?, disabled? }` (no self-demotion) |
| `DELETE /admin/users/:id` | full cascade delete |
| `GET /admin/models` | artifacts + metrics + usage counts |
| `POST /admin/models/refresh` | reload artifacts from disk |
| `GET /admin/audit-logs?page&limit&action` | audit trail (no health data) |
| `GET /admin/system` | redacted runtime config (no secrets) |

## Curl example

```bash
# login (stores cookie)
curl -c cookies.txt -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"demo@medipredict.local","password":"DemoPass123!"}'

# create + analyze
curl -b cookies.txt -X POST http://localhost:5000/api/reports \
  -H "Content-Type: application/json" \
  -d '{"patient":{"age":45,"sex":"male"},"report":{"date":"2026-09-14"},
       "tests":{"fasting_glucose":{"value":112,"unit":"mg/dL"},"hba1c":{"value":5.9,"unit":"%"}}}'
```
