/**
 * Server entrypoint: env → database → background sync → HTTP listener.
 * Fails fast with actionable messages when configuration is missing.
 */
import { createApp } from './app';
import { env } from './config/env';
import { connectDb, disconnectDb } from './db/connect';
import { loadModels } from './ml/registry';
import { syncModelVersionsToDb } from './services/modelSyncService';
import { logger } from './utils/logger';

async function main(): Promise<void> {
  logger.info(`MediPredict AI server starting (${env.NODE_ENV})`);

  try {
    await connectDb();
  } catch (err) {
    console.error('\n============================================================');
    console.error(' Could not connect to MongoDB.');
    console.error(` MONGODB_URI was: ${env.MONGODB_URI}`);
    console.error(` Reason: ${(err as Error).message}`);
    console.error('');
    console.error(' Make sure MongoDB is running locally (default port 27017), e.g.:');
    console.error('   - Windows service: net start MongoDB');
    console.error('   - or run mongod manually (see docs/DEVELOPMENT.md)');
    console.error('   - or set MONGODB_URI in .env to a reachable server/cluster.');
    console.error('============================================================\n');
    process.exit(1);
  }

  // Load ML artifacts + register them in the DB (best-effort).
  const modelState = loadModels();
  logger.info(
    `ML models: ${modelState.artifacts.length} loaded${modelState.errors.length ? `, ${modelState.errors.length} invalid` : ''}`
  );
  try {
    await syncModelVersionsToDb();
  } catch (err) {
    logger.warn('Model version sync failed', { message: (err as Error).message });
  }

  const app = createApp();
  const server = app.listen(env.PORT, () => {
    logger.info(`API listening on http://localhost:${env.PORT}/api`);
    logger.info(
      env.llm.enabled
        ? `LLM layer: enabled (${env.llm.provider} · ${env.llm.model})`
        : `LLM layer: disabled${env.llm.disabledReason ? ` (${env.llm.disabledReason})` : ''} — core app fully functional without it`
    );
  });

  const shutdown = (signal: string) => {
    logger.info(`${signal} received — shutting down gracefully`);
    server.close(() => {
      void disconnectDb().finally(() => process.exit(0));
    });
    setTimeout(() => process.exit(1), 10_000).unref();
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

main().catch((err) => {
  logger.error('Fatal startup error', { message: (err as Error).message, stack: (err as Error).stack });
  process.exit(1);
});
