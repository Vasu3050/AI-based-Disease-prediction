/**
 * Environment loading & validation.
 *
 * - Loads `.env` from the repository root (searching upward from this file).
 * - Validates all values with Zod and fails fast with a clear message when a
 *   required variable is missing/broken.
 * - Exposes a typed `env` object for the rest of the server.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { z } from 'zod';

/**
 * Find the repository root by walking upward from this file (or its bundled
 * location) and, as a fallback, from the current working directory. A directory
 * qualifies when it contains package.json plus the client/server workspaces
 * (or an ml workspace). Works both in dev (server/src/...) and after bundling
 * (server/dist/...).
 */
function findRepoRoot(): string {
  const candidates: string[] = [];
  let dir = path.dirname(fileURLToPath(import.meta.url));
  for (let i = 0; i < 6; i += 1) {
    candidates.push(dir);
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  candidates.push(process.cwd());
  for (const c of candidates) {
    const hasPkg = fs.existsSync(path.join(c, 'package.json'));
    const hasWorkspaces =
      (fs.existsSync(path.join(c, 'server')) && fs.existsSync(path.join(c, 'client'))) ||
      fs.existsSync(path.join(c, 'ml'));
    if (hasPkg && hasWorkspaces) return c;
  }
  return process.cwd();
}

export const REPO_ROOT = findRepoRoot();

/**
 * Supported .env locations (first value set wins; shell env always wins):
 *   1. <repo-root>/.env
 *   2. <repo-root>/server/.env
 */
export function envFileLocations(): string[] {
  return [path.join(REPO_ROOT, '.env'), path.join(REPO_ROOT, 'server', '.env')];
}
for (const file of envFileLocations()) {
  if (fs.existsSync(file)) dotenv.config({ path: file, override: false });
}

const isTest = process.env.NODE_ENV === 'test';

/** Minimal duration parser: "7d", "12h", "30m", "45s", or plain ms number. */
export function parseDurationMs(input: string, fallbackMs: number): number {
  const m = /^(\d+)\s*(ms|s|m|h|d)?$/.exec(input.trim());
  if (!m) return fallbackMs;
  const value = Number(m[1]);
  switch (m[2]) {
    case 'd':
      return value * 86_400_000;
    case 'h':
      return value * 3_600_000;
    case 'm':
      return value * 60_000;
    case 's':
      return value * 1000;
    default:
      return value;
  }
}

const schema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().positive().max(65535).default(5000),
  MONGODB_URI: z.string().trim().default(isTest ? 'mongodb://127.0.0.1:27017/medipredict_test' : ''),
  JWT_SECRET: z.string().default(isTest ? 'test-secret-test-secret-test-secret-test-secret' : ''),
  JWT_EXPIRES_IN: z.string().default('7d'),
  COOKIE_NAME: z.string().default('mp_token'),
  CLIENT_URL: z.string().default('http://localhost:5173'),
  LLM_PROVIDER: z.enum(['none', 'openai-compatible', 'xai', 'ollama']).default('none'),
  LLM_API_KEY: z.string().default(''),
  LLM_BASE_URL: z.string().default(''),
  LLM_MODEL: z.string().default(''),
  LLM_TIMEOUT_MS: z.coerce.number().int().positive().default(20_000),
  MODELS_DIR: z.string().default(''),
});

export type Env = z.infer<typeof schema> & {
  isProd: boolean;
  isTest: boolean;
  isDev: boolean;
  jwtExpiresMs: number;
  modelsDir: string;
  llm: {
    provider: 'none' | 'openai-compatible' | 'xai' | 'ollama';
    enabled: boolean;
    apiKey: string;
    baseUrl: string;
    model: string;
    timeoutMs: number;
    /** True when the endpoint is a local server (Ollama/LM Studio/…). */
    isLocal: boolean;
    disabledReason: string | null;
  };
};

function load(): Env {
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    const details = parsed.error.issues
      .map((i) => `  - ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${details}`);
  }

  const raw = parsed.data;
  const problems: string[] = [];

  if (!raw.MONGODB_URI) {
    problems.push('  - MONGODB_URI is required (see .env.example).');
  }
  if (!isTest && raw.JWT_SECRET.length < 32) {
    problems.push(
      '  - JWT_SECRET is required and must be at least 32 characters (see .env.example).'
    );
  }
  if (problems.length > 0) {
    throw new Error(
      `Missing/invalid environment configuration:\n${problems.join('\n')}\n` +
        `Create a .env file in the repository root (copy .env.example) and try again.`
    );
  }

  // --- LLM configuration (optional layer) ---------------------------------
  const provider = raw.LLM_PROVIDER;
  let baseUrl = raw.LLM_BASE_URL.trim();
  if ((provider === 'xai' || provider === 'ollama') && !baseUrl) {
    baseUrl = provider === 'xai' ? 'https://api.x.ai/v1' : 'http://127.0.0.1:11434/v1';
  }

  let disabledReason: string | null = null;
  let enabled = provider !== 'none';
  if (enabled && !raw.LLM_MODEL) {
    enabled = false;
    disabledReason = 'LLM_MODEL is not set';
  }
  if (enabled && !baseUrl) {
    enabled = false;
    disabledReason = 'LLM_BASE_URL is not set';
  }
  // Local OpenAI-compatible servers (e.g. Ollama) may not need an API key;
  // hosted providers do.
  const isLocal = /^https?:\/\/(127\.0\.0\.1|localhost|\[::1\])/i.test(baseUrl);
  if (enabled && !raw.LLM_API_KEY && !isLocal) {
    enabled = false;
    disabledReason = 'LLM_API_KEY is not set';
  }

  const modelsDir =
    raw.MODELS_DIR.trim() !== '' ? path.resolve(raw.MODELS_DIR) : path.join(REPO_ROOT, 'ml', 'models');

  const env: Env = {
    ...raw,
    LLM_PROVIDER: provider,
    isProd: raw.NODE_ENV === 'production',
    isTest: raw.NODE_ENV === 'test',
    isDev: raw.NODE_ENV === 'development',
    jwtExpiresMs: parseDurationMs(raw.JWT_EXPIRES_IN, 7 * 86_400_000),
    modelsDir,
    llm: {
      provider,
      enabled,
      apiKey: raw.LLM_API_KEY,
      baseUrl,
      model: raw.LLM_MODEL,
      timeoutMs: raw.LLM_TIMEOUT_MS,
      isLocal,
      disabledReason,
    },
  };
  return env;
}

export const env: Env = load();

/**
 * Convenience: earlier bootstraps may prefer this to catch config errors and
 * print a friendly message instead of a raw stack trace.
 */
export function tryLoadEnv(): { ok: true; env: Env } | { ok: false; error: Error } {
  try {
    return { ok: true, env: load() };
  } catch (error) {
    return { ok: false, error: error as Error };
  }
}
