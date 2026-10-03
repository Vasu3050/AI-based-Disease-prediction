# Architecture

MediPredict AI is a monorepo MERN application with a deterministic analysis
pipeline, an optional LLM explanation layer, and an in-repo ML training system.

## Design principles

1. **Determinism first.** Analysis and predictions come from validated input +
   reference ranges + published guideline rules + trained ML models — never
   from an LLM "free-forming" a diagnosis.
2. **Strict structured input.** Only catalog-defined tests with explicit units
   are accepted. Units are normalized; impossible values are rejected; missing
   units are never guessed.
3. **Honest AI.** Model artifacts carry their dataset, validation metrics and
   caveats. Good metrics are never invented; weak/limited scope is disclosed.
4. **The LLM explains, never decides.** The explanation layer consumes
   already-computed structured results and cannot alter them. The app is fully
   functional without any LLM.
5. **Privacy by design.** Minimum data collection, no health data in audit
   logs, full account deletion, and a minimal data payload to the (optional)
   LLM.

## System diagram

```
┌─────────────────────────────┐        ┌──────────────────────────────────────┐
│  client/  (React + Vite)    │        │  server/  (Express + TypeScript)     │
│                             │  HTTP  │                                      │
│  Public pages               │ ─────► │  Routes → Controllers → Services     │
│  App pages (auth)           │  /api  │   │                                  │
│  Admin pages (role)         │        │   ├─ Validation (Zod, strict)        │
│  Charts (Recharts)          │ ◄───── │   ├─ Auth (JWT httpOnly cookie)      │
└─────────────────────────────┘        │   ├─ Analysis engine (ml/engine)     │
                                       │   │    ├─ reference ranges           │
                                       │   │    ├─ guideline panels           │
                                       │   │    └─ ML models (ml/registry)    │
                                       │   ├─ LLM provider abstraction        │
                                       │   └─ Mongoose models                 │
                                       └──────────────┬───────────────────────┘
                                                      │
                                       ┌──────────────▼───────────────────────┐
                                       │  MongoDB (users, patients, reports,  │
                                       │  predictions, modelVersions, audit)  │
                                       └──────────────────────────────────────┘

        ml/  (training pipeline, run out-of-band)
        datasets → preprocessing → logistic regression → ml/models/*.model.json
```

## Repository layout

| Path | Purpose |
|---|---|
| `client/` | React SPA (Vite, TypeScript, Tailwind, Recharts, React Router) |
| `server/` | Express API (TypeScript, Zod, Mongoose, JWT, Helmet, rate limiting) |
| `server/src/domain/` | Test catalog, reference ranges, guideline rules, eGFR, features |
| `server/src/ml/` | Model registry + analysis engine |
| `server/src/ai/` | LLM provider abstraction + explanation layer |
| `ml/` | Dataset fetch + training pipeline + model artifacts |
| `scripts/` | Demo seeding + end-to-end smoke test |
| `docs/` | This documentation |

## Request lifecycle (report → prediction)

1. **`POST /api/reports`** — Zod schema validates the payload strictly
   (unknown keys rejected). Every test entry is checked against the catalog:
   key exists, unit accepted, value within plausible bounds. Units are
   converted to canonical form; the submission keeps its original value/unit
   for transparency. The patient snapshot (age/sex) is derived from a saved
   profile or inline data.
2. **`POST /api/predictions`** — the engine loads the stored report and runs:

   a. **Reference-range analysis** — sex-aware typical ranges; a
      laboratory-provided range overrides the default when present. Each value
      gets low/normal/high plus a relative deviation score (documented
      heuristic).
   b. **Computed values** — BMI (from BMI, or weight/height) and eGFR
      (CKD-EPI 2021, creatinine + age + sex; skipped for unspecified sex).
   c. **Guideline panels** — deterministic rules from published sources:
      glycemic categories (ADA), anemia screening (WHO), lipid classification
      (NCEP ATP III style), liver-enzyme patterns, kidney categories
      (KDIGO-style). Explicitly labeled as rules, not ML.
   d. **ML models** — from `ml/models/*.model.json`, loaded through a strict
      artifact schema. Per target, the model with the most available features
      runs; otherwise the result is `insufficient_data` with an explicit
      missing-inputs list. Contributions are reported per feature (log-odds,
      standardized space).
3. **The prediction document** stores the complete structured result, engine
   version and model versions — traceable forever.
4. **`POST /api/predictions/:id/explain`** — optionally sends a *minimal*
   structured summary to the configured LLM (no names/identifiers/free text).
   Output is validated against a strict JSON schema before storage; failures
   fall back to a deterministic template with a clear `fallbackReason`.

## Data model (MongoDB collections)

| Collection | Tracks |
|---|---|
| `users` | email (unique), name, bcrypt password hash, role, disabled, settings |
| `patients` | owner, name, sex, birthYear, optional external ref/notes |
| `bloodreports` | owner, patient ref + snapshot, context (BMI/BP/smoking), date, tests (canonical + submitted), source/demoLabel |
| `predictions` | owner, report ref, engine version, results (structured), model versions, optional explanation |
| `modelversions` | registry of loaded artifacts (key, version, metrics, dataset) |
| `auditlogs` | security events; deliberately no lab values |

Indexes: unique user email; owner+date on reports; owner+created on
predictions; report ref on predictions; createdAt desc on audit logs.

## Frontend architecture

- **Routing**: public (`/`, `/about`, `/how-it-works`, `/safety`, `/privacy`,
  `/login`, `/register`), app (`/app/*` behind auth), admin (`/app/admin/*`
  behind role guard).
- **State**: `AuthContext` (session), `ToastContext` (notifications),
  `ThemeContext` (light/dark/system).
- **API client**: typed fetch wrapper with normalized errors + field-level
  issue mapping (422 details).
- **Design system**: reusable primitives (`Button`, `Card`, `Input`, `Modal`,
  `Tabs`, …), domain components (`RiskBadge`, `ModelResultCard`,
  `GuidelineFindingCard`, `ExplanationCard`), charts (`RiskGauge`,
  `ContributionBars`, `TrendChart`, `StatusDonut`).
- The report form is **generated from the server catalog**
  (`GET /api/meta/blood-tests`), so units/ranges can never drift between
  frontend and backend.

## Extension points

- **New laboratory tests**: add to `server/src/domain/catalog.ts`
  (single source of truth; the form updates automatically).
- **New guideline rules**: add a function in
  `server/src/domain/guidelines.ts`.
- **New ML models**: add a training target to `ml/training/train-all.mjs`,
  retrain, reload artifacts (admin panel or restart). No server code changes
  needed — the registry schema validates artifacts generically.
- **New LLM providers**: implement the `LLMProvider` interface in
  `server/src/ai/providers/` and wire it in `server/src/ai/provider.ts`.
