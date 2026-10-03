# Environment variables

The server loads environment files in this order (first value wins; real
process/shell variables always win over files):

1. `<repo-root>/.env`
2. `<repo-root>/server/.env`

Invalid/missing required values cause a **fail-fast startup error** that names
exactly what is missing. Copy `.env.example` to get started.

| Variable | Required | Default | Description |
|---|---|---|---|
| `NODE_ENV` | no | `development` | `development` / `production` / `test`. Production enables secure cookies, JSON logs and SPA static serving. |
| `PORT` | no | `5000` | API port. |
| `MONGODB_URI` | **yes** | — | MongoDB connection string, e.g. `mongodb://127.0.0.1:27017/medipredict`. |
| `JWT_SECRET` | **yes** | — | ≥32-char random string used to sign sessions. Generate: `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`. |
| `JWT_EXPIRES_IN` | no | `7d` | Session lifetime (`30m`, `12h`, `7d`, …). Also the cookie max-age. |
| `COOKIE_NAME` | no | `mp_token` | Auth cookie name. |
| `CLIENT_URL` | no | `http://localhost:5173` | Frontend origin for CORS/cookies (and same-origin in prod builds). |
| `LLM_PROVIDER` | no | `none` | `none` \| `ollama` \| `openai-compatible` \| `xai`. |
| `LLM_API_KEY` | no\* | — | Server-side only. Required for hosted providers; optional for local (Ollama/LM Studio). |
| `LLM_BASE_URL` | no\* | — | Endpoint of the OpenAI-compatible API. Defaults per provider (`xai` → `api.x.ai/v1`, `ollama` → `127.0.0.1:11434/v1`). |
| `LLM_MODEL` | no\* | — | Model name (`deepseek-r1:14b`, `grok-2-latest`, `llama-3.3-70b-versatile`, …). |
| `LLM_TIMEOUT_MS` | no | `20000` | Request timeout. Use `600000`+ for local reasoning models (14B+: the first call loads the model and thinking tokens are generated before the answer). |
| `MODELS_DIR` | no | `<repo>/ml/models` | Directory with trained `*.model.json` artifacts. |
| `DEMO_USER_EMAIL` / `DEMO_USER_PASSWORD` | no | `demo@medipredict.local` / `DemoPass123!` | Credentials created by `npm run demo:seed`. |

\* The LLM layer is entirely optional: with `LLM_PROVIDER=none` (or an
incomplete config) the app runs fully — explanations use the deterministic
offline summary instead. When a provider is selected but `LLM_MODEL`/key/base
URL are missing, the server starts anyway and logs why the layer is disabled
(visible in Admin → System).

## Switching models — .env only, no code changes

### Local (Ollama), no API key

```env
LLM_PROVIDER=ollama
LLM_BASE_URL=http://127.0.0.1:11434/v1
LLM_MODEL=deepseek-r1:14b        # any model from `ollama list`
LLM_TIMEOUT_MS=300000
```

### xAI Grok (online)

```env
LLM_PROVIDER=xai
LLM_BASE_URL=https://api.x.ai/v1
LLM_API_KEY=xai-...
LLM_MODEL=grok-2-latest
```

### Any other OpenAI-compatible cloud

```env
LLM_PROVIDER=openai-compatible
LLM_BASE_URL=https://api.groq.com/openai/v1    # or OpenAI, OpenRouter, Together…
LLM_API_KEY=...
LLM_MODEL=llama-3.3-70b-versatile
```

Restart the API after changing values; confirm the active provider/model in
**Admin → System** (or `GET /api/meta/llm`).

## Notes

- Client (Vite) needs no env in development — it proxies `/api` to the server.
  `VITE_*` variables are optional and must never contain secrets.
- `.env` files are gitignored; only `.env.example` is committed.
- Tests set their own environment (`LLM_PROVIDER=none`,
  `MONGODB_URI=…medipredict_test`) — see `server/vitest.config.ts`.
