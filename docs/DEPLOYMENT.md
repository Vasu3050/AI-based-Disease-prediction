# Deployment

## Development

See [DEVELOPMENT.md](DEVELOPMENT.md). Short version:

```bash
npm install
Copy-Item .env.example .env    # fill values (or keep server/.env)
npm run dataset:fetch && npm run train:models   # once (artifacts are committed)
npm run demo:seed                               # optional demo accounts/data
npm run dev                                     # API :5000 + client :5173
```

## Production build

```bash
npm install
npm run build          # builds server (tsup → server/dist) and client (vite → client/dist)
NODE_ENV=production node server/dist/index.js
```

In production the Express server automatically serves `client/dist` as a SPA
(at `/`) alongside the API (at `/api`). Required env: `NODE_ENV=production`,
`MONGODB_URI`, `JWT_SECRET` (≥32 chars), `CLIENT_URL` (your public origin).

## Docker (single service + MongoDB)

```
docker compose up --build
```

- `Dockerfile` — multi-stage: builds client + server, runs the API which
  serves both.
- `docker-compose.yml` — app + MongoDB 7 with a persistent volume.
- Set secrets via environment or an `.env` file next to compose.

> For real deployments put the service behind a TLS-terminating reverse proxy
> (Caddy/nginx) and set `CLIENT_URL` to the public origin; `trust proxy` is
> enabled automatically in production.

## MongoDB

Options, in order of simplicity:

1. **Local service** (Windows: `net start MongoDB`; macOS: `brew services`;
   Linux: systemd). Default `mongodb://127.0.0.1:27017/medipredict`.
2. **MongoDB Atlas** — set `MONGODB_URI` to the SRV connection string.
3. **Docker** — see compose above.

No migrations are required; Mongoose creates collections and indexes on first
use. `modelVersions` is synced automatically at startup.

## Model artifacts

`ml/models/*.model.json` are committed to the repository, so a deployment does
not need the raw datasets. To retrain on the target machine:

```bash
npm run dataset:fetch     # needs network access to the sources in DATASETS.md
npm run train:models
# then either restart the API or hit Admin → Models → "Reload artifacts"
```

`MODELS_DIR` can point at an external directory if you keep artifacts
elsewhere.

## Checklist before a demo/exam

- [ ] `npm run lint && npm run typecheck && npm run test` all green
- [ ] `.env` configured (at minimum `JWT_SECRET`); LLM layer optional
- [ ] MongoDB reachable; `GET /api/health` shows `db: connected`
- [ ] `npm run demo:seed` executed; demo/admin logins work
- [ ] `npm run smoke` passes against the running API
- [ ] Models visible in Admin → Models with honest metrics
