# MediPredict AI

**AI-assisted blood-test analysis and disease-risk prediction platform.**

> ⚠️ **IMPORTANT MEDICAL DISCLAIMER**
> MediPredict AI is an **educational / research decision-support prototype**. It is **not**
> a medical device, it does **not** provide a diagnosis, and it must **not** be used to
> start, stop, or change any treatment. Predictions are probabilistic and may be wrong.
> Always consult a qualified healthcare professional. In an emergency, seek immediate
> medical attention regardless of anything this software displays.

---

## What it is

MediPredict AI accepts a **strictly structured blood-test report**, validates and
normalizes it (units, ranges, plausibility), runs a **transparent analysis pipeline**
(reference-range analysis → guideline-based indicators → trained ML risk models), and
presents an AI-assisted risk report with explainability, charts, history, comparison,
trends and an admin panel.

The LLM layer is **optional** (local Ollama, xAI Grok, or any OpenAI-compatible API —
switchable via `.env` only) and is used **only** to explain already-computed structured
results — never as the source of the prediction.

## Architecture at a glance

```
blood values → strict validation → unit normalization
    → reference-range analysis (sex-aware; lab ranges respected)
    → guideline indicators (WHO / ADA / NCEP ATP III-style / KDIGO)
    → ML models (logistic regression, trained in-repo, versioned artifacts)
    → structured result → optional LLM explanation (validated JSON) → UI
```

- **Frontend:** React · Vite · TypeScript · Tailwind CSS · Recharts
- **Backend:** Node.js · Express · TypeScript · Zod · Mongoose (MongoDB)
- **Auth:** JWT in HTTP-only cookie · bcrypt · role-based access
- **ML:** reproducible Node.js training pipeline on public datasets (PIMA, ILPD, UCI CKD)
- **LLM:** provider-agnostic abstraction (`none | ollama | openai-compatible | xai`)

## Repository layout

```
├─ client/        React SPA (Vite, TS, Tailwind)
├─ server/        Express API (TS, Mongoose, Zod)
├─ ml/            Dataset fetch + training pipeline + model artifacts
├─ docs/          Architecture, API, ML, security, privacy, deployment docs
└─ scripts/       Demo seeding + end-to-end smoke test
```

## Quick start

```bash
# 1) Install dependencies (npm workspaces)
npm install

# 2) Configure environment — supports .env at repo root OR server/.env
Copy-Item .env.example .env      # PowerShell (cp on bash). Set JWT_SECRET!
#    MongoDB URI defaults to a local server. LLM optional — see docs/ENVIRONMENT.md.

# 3) Ensure MongoDB is running   (Windows service: net start MongoDB)

# 4) Models: prebuilt artifacts are committed — to retrain from scratch:
npm run dataset:fetch            # download + validate public datasets
npm run train:models             # trains, evaluates, writes ml/models/*.json

# 5) Demo data (labeled synthetic): demo user + admin + 6 scenarios
npm run demo:seed

# 6) Run everything (API :5000 + client :5173)
npm run dev
```

Demo account after seeding: `demo@medipredict.local / DemoPass123!`
Admin: `admin@medipredict.local / AdminPass123!`

## Switching the LLM (no code changes)

Edit `.env` and restart — provider/model/base URL are pure configuration:

| Use | `.env` |
|---|---|
| Local Ollama (no key) | `LLM_PROVIDER=ollama`, `LLM_MODEL=deepseek-r1:14b` |
| xAI Grok | `LLM_PROVIDER=xai`, `LLM_API_KEY=xai-...`, `LLM_MODEL=grok-2-latest` |
| OpenAI-compatible cloud | `LLM_PROVIDER=openai-compatible`, `LLM_BASE_URL=...`, `LLM_MODEL=...` |
| Offline / none | `LLM_PROVIDER=none` (deterministic summary instead) |

Confirm the active model in **Admin → System**.

## Honest ML metrics (held-out test splits — not clinical performance)

| Model | ROC-AUC | Notes |
|---|---|---|
| Diabetes (glucose+BMI+age+BP, PIMA) | 0.826 | 2-h OGTT vs fasting caveat |
| Liver (ILPD) | 0.751 | binary "liver patient" label |
| Kidney (UCI CKD) | 0.986 | known "easy" dataset; optimistic |

Full details, caveats and CV results: [docs/ML.md](docs/ML.md) ·
[docs/DATASETS.md](docs/DATASETS.md).

## Quality gates

```bash
npm run lint        # ESLint (server + client)
npm run typecheck   # strict tsc across workspaces
npm run test        # Vitest suites (server + client)
npm run build       # production builds
npm run smoke       # end-to-end API checks (server must be running)
```

## Documentation

| Document | Contents |
|---|---|
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | System design, data flow, module map |
| [docs/API.md](docs/API.md) | REST API reference with examples |
| [docs/ML.md](docs/ML.md) | Models, training, evaluation, limitations |
| [docs/DATASETS.md](docs/DATASETS.md) | Dataset provenance, licenses, preprocessing |
| [docs/REFERENCE_RANGES.md](docs/REFERENCE_RANGES.md) | Tests, units, ranges & sources |
| [docs/SECURITY.md](docs/SECURITY.md) | Security controls with code locations |
| [docs/PRIVACY.md](docs/PRIVACY.md) | Health-data privacy design |
| [docs/LIMITATIONS.md](docs/LIMITATIONS.md) | Honest limitations & non-claims |
| [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) | Deployment incl. Docker |
| [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) | Local dev, testing, troubleshooting |
| [docs/ENVIRONMENT.md](docs/ENVIRONMENT.md) | Every environment variable |

## License

MIT for the code (see [LICENSE](LICENSE)). Datasets retain their own licenses —
see docs/DATASETS.md. Not a medical device; not for clinical use.
