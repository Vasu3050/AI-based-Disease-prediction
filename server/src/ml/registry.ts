/**
 * ML model registry — loads trained model artifacts (JSON) produced by the
 * training pipeline in `ml/training/` and exposed by `ml/models/`.
 *
 * Artifacts are validated against a strict schema; a malformed artifact never
 * crashes the server, it is ignored with a warning (and the corresponding
 * target reports `insufficient_data` / unavailability honestly).
 */
import fs from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import { env } from '../config/env';
import { logger } from '../utils/logger';

export const modelArtifactSchema = z.object({
  key: z.string().min(1),
  name: z.string().min(1),
  targetId: z.string().min(1),
  title: z.string().min(1),
  description: z.string().default(''),
  version: z.string().min(1),
  trainedAt: z.string().min(1),
  features: z.array(z.string()).min(1),
  scaler: z.object({ mean: z.array(z.number()), std: z.array(z.number()) }),
  coefficients: z.array(z.number()),
  intercept: z.number(),
  decisionThreshold: z.number().gt(0).lt(1).default(0.5),
  metrics: z.object({
    rocAuc: z.number(),
    prAuc: z.number(),
    accuracy: z.number(),
    precision: z.number(),
    recall: z.number(),
    f1: z.number(),
    brier: z.number(),
    nTrain: z.number(),
    nTest: z.number(),
    prevalence: z.number(),
    datasetName: z.string(),
  }),
  dataset: z.object({
    name: z.string(),
    source: z.string(),
    url: z.string().optional().default(''),
    license: z.string().optional().default(''),
  }),
  notes: z.string().optional().default(''),
});

export type ModelArtifact = z.infer<typeof modelArtifactSchema>;

interface RegistryState {
  loadedAt: number;
  artifacts: ModelArtifact[];
  errors: { file: string; error: string }[];
}

let state: RegistryState | null = null;

export function loadModels(force = false): RegistryState {
  if (state && !force) return state;

  const dir = env.modelsDir;
  const artifacts: ModelArtifact[] = [];
  const errors: { file: string; error: string }[] = [];

  if (!fs.existsSync(dir)) {
    logger.warn(`Models directory not found: ${dir} (ML models will be unavailable)`);
    state = { loadedAt: Date.now(), artifacts, errors };
    return state;
  }

  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.model.json'));
  for (const file of files) {
    try {
      const raw = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8'));
      const parsed = modelArtifactSchema.parse(raw);
      if (
        parsed.scaler.mean.length !== parsed.features.length ||
        parsed.scaler.std.length !== parsed.features.length ||
        parsed.coefficients.length !== parsed.features.length
      ) {
        throw new Error('Artifact shape mismatch between features/scaler/coefficients');
      }
      artifacts.push(parsed);
    } catch (err) {
      errors.push({ file, error: (err as Error).message });
      logger.warn(`Skipping invalid model artifact "${file}": ${(err as Error).message}`);
    }
  }

  logger.info(`Loaded ${artifacts.length} ML model artifact(s) from ${dir}`);
  state = { loadedAt: Date.now(), artifacts, errors };
  return state;
}

export function getModelStatus() {
  const s = loadModels();
  return {
    modelsDir: env.modelsDir,
    loadedAt: new Date(s.loadedAt).toISOString(),
    artifacts: s.artifacts.map((a) => ({
      key: a.key,
      name: a.name,
      targetId: a.targetId,
      title: a.title,
      version: a.version,
      trainedAt: a.trainedAt,
      features: a.features,
      metrics: a.metrics,
      dataset: a.dataset,
      notes: a.notes,
    })),
    errors: s.errors,
  };
}
