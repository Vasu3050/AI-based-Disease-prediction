# Development guide

## Prerequisites

| Tool | Version | Notes |
|---|---|---|
| Node.js | ≥ 20.11 (22 LTS recommended) | npm workspaces required |
| MongoDB | 6+ (7/8/9 okay) | local service, Atlas, or Docker |
| OS | Windows / macOS / Linux | tested on Windows 11 + Node 22 |

Optional for the LLM explanation feature: [Ollama](https://ollama.com) with any
model, or a hosted OpenAI-compatible API key (see ENVIRONMENT.md).

## First-time setup

```bash
npm install                       # installs server + client workspaces
Copy-Item .env.example .env       # Windows PowerShell (cp on bash)
#  → set JWT_SECRET (>=32 chars). MONGODB_URI defaults to local.

npm run dataset:fetch             # download training data (needs network)
npm run train:models              # train + print honest metrics
npm run demo:seed                 # demo user + admin + synthetic reports
npm run dev                       # API on :5000, client on :5173
```

Open http://localhost:5173 — sign in with the seeded demo account
(`demo@medipredict.local / DemoPass123!`).

## Scripts (run from the repo root)

| Script | What it does |
|---|---|
| `npm run dev` | API + client concurrently |
| `npm run dev:server` / `dev:client` | individually |
| `npm run build` | production builds (server + client) |
| `npm run typecheck` | strict TypeScript across workspaces |
| `npm run lint` | ESLint across workspaces |
| `npm run test` | Vitest suites (server + client) |
| `npm run dataset:fetch` | dataset download + validation |
| `npm run train:models` | train/test/version models → `ml/models/` |
| `npm run demo:seed` | seed demo accounts & scenarios (re-runnable) |
| `npm run smoke` | end-to-end API smoke test (server must run) |
| `npm run format` | Prettier |

## Testing notes

- **Server tests** run against a real database:
  `mongodb://127.0.0.1:27017/medipredict_test` by default (your local mongod).
  In CI you can run an in-memory MongoDB and set `TEST_MONGODB_URI`
  (e.g. via `mongodb-memory-server`).
- **LLM is disabled in tests** (vitest sets `LLM_PROVIDER=none`) so the suite
  is deterministic and offline.
- `npm run smoke` exercises the full HTTP surface incl. admin endpoints when
  the seeded admin exists; add `-- --with-llm` to include an explanation call.

## Working with the local LLM (Ollama)

```bash
ollama list                       # e.g. deepseek-r1:14b, qwen3-coder:30b
```

`.env`-only switch (no code changes):

```env
LLM_PROVIDER=ollama
LLM_BASE_URL=http://127.0.0.1:11434/v1
LLM_MODEL=deepseek-r1:14b
LLM_TIMEOUT_MS=600000            # 14B reasoning models: allow up to 10 min on first call
```

Restart the server and check Admin → System to confirm. To switch to Grok:

```env
LLM_PROVIDER=xai
LLM_BASE_URL=https://api.x.ai/v1
LLM_API_KEY=xai-...
LLM_MODEL=grok-2-latest
```

The explanation endpoint validates the LLM output and falls back to a
deterministic summary when anything is off — the app never breaks because of
the LLM.

## Troubleshooting

| Symptom | Fix |
|---|---|
| `Could not connect to MongoDB` | start the service (`net start MongoDB`), or fix `MONGODB_URI` |
| Client shows API errors in dev | ensure API is on :5000 (Vite proxies `/api`) |
| `models: 0 loaded` | run `npm run train:models`; or set `MODELS_DIR`; reload via Admin → Models |
| Ollama explain times out | raise `LLM_TIMEOUT_MS`; first call loads the model into memory (can take minutes) |
| Port 5000/5173 in use | change `PORT` (server) / `server.port` in `client/vite.config.ts` |
| `dataset:fetch` fails behind a proxy | set HTTPS_PROXY, or use the manual fallback printed by the script |

## Code conventions

- Strict TypeScript everywhere; Zod at boundaries; no `any` in domain code.
- Server: routes → controllers → services → domain; errors via `ApiError`.
- Client: no business logic in page components — API calls and reusable
  components live in `lib/`/`components/`.
- Never write medical claims into UI copy without checking
  [LIMITATIONS.md](LIMITATIONS.md) — the tone rules ("model-estimated",
  "not a diagnosis") are part of the product requirements.
