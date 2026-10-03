/**
 * Tiny structured logger.
 * - Human-friendly output in development.
 * - Single-line JSON in production (easy to ship to a log collector).
 * - Never logs patient-identifying data: callers must pass only safe context.
 */
import { env } from '../config/env';

type Level = 'debug' | 'info' | 'warn' | 'error';

function emit(level: Level, msg: string, meta?: Record<string, unknown>): void {
  const ts = new Date().toISOString();
  if (env.isProd) {
    const line = JSON.stringify({ ts, level, msg, ...(meta ?? {}) });
    if (level === 'error') console.error(line);
    else if (level === 'warn') console.warn(line);
    else console.log(line);
    return;
  }
  const suffix = meta && Object.keys(meta).length > 0 ? ` ${JSON.stringify(meta)}` : '';
  const tag = `[${level.toUpperCase()}]`;
  if (level === 'error') console.error(`${ts} ${tag} ${msg}${suffix}`);
  else if (level === 'warn') console.warn(`${ts} ${tag} ${msg}${suffix}`);
  else console.log(`${ts} ${tag} ${msg}${suffix}`);
}

export const logger = {
  debug: (msg: string, meta?: Record<string, unknown>) => {
    if (!env.isProd) emit('debug', msg, meta);
  },
  info: (msg: string, meta?: Record<string, unknown>) => emit('info', msg, meta),
  warn: (msg: string, meta?: Record<string, unknown>) => emit('warn', msg, meta),
  error: (msg: string, meta?: Record<string, unknown>) => emit('error', msg, meta),
};
