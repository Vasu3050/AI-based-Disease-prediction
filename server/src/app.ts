import fs from 'node:fs';
import path from 'node:path';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import express, { type Express } from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import { env, REPO_ROOT } from './config/env';
import { errorHandler, notFoundHandler } from './middleware/error';
import { globalLimiter } from './middleware/rateLimit';
import { mongoSanitize } from './middleware/security';
import { apiRouter } from './routes';

export function createApp(): Express {
  const app = express();

  app.disable('x-powered-by');
  // Behind a reverse proxy in production (correct client IPs for rate limiting).
  app.set('trust proxy', env.isProd ? 1 : false);

  app.use(
    helmet({
      // API-first app; the client is served separately in dev. Disable CSP here
      // (it is configured at the static host / CDN level for the SPA).
      contentSecurityPolicy: false,
      crossOriginResourcePolicy: { policy: 'same-site' },
    })
  );

  const allowedOrigins = new Set(
    [env.CLIENT_URL, 'http://localhost:5173', 'http://127.0.0.1:5173'].filter(Boolean)
  );
  app.use(
    cors({
      origin(origin, callback) {
        if (!origin || allowedOrigins.has(origin)) return callback(null, true);
        return callback(null, false);
      },
      credentials: true,
      methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
      maxAge: 600,
    })
  );

  if (!env.isTest) {
    app.use(morgan(env.isProd ? 'combined' : 'dev'));
  }

  app.use(express.json({ limit: '100kb' }));
  app.use(cookieParser());
  app.use(mongoSanitize);

  app.use('/api', globalLimiter, apiRouter);

  // Serve the built SPA when available (production single-service deployment).
  const clientDist = path.join(REPO_ROOT, 'client', 'dist');
  if (!env.isTest && fs.existsSync(path.join(clientDist, 'index.html'))) {
    app.use(express.static(clientDist, { index: false, maxAge: '1h' }));
    app.get(/^\/(?!api\/).*/, (_req, res) => {
      res.sendFile(path.join(clientDist, 'index.html'));
    });
  }

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
