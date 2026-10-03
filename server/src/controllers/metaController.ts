import type { Request, Response } from 'express';
import { ENGINE_VERSION } from '../config/constants';
import { env } from '../config/env';
import { catalogForClient } from '../domain/catalog';
import { getModelStatus } from '../ml/registry';
import { asyncHandler } from '../utils/asyncHandler';

export const bloodTestsCatalog = asyncHandler(async (_req: Request, res: Response) => {
  res.json({
    engineVersion: ENGINE_VERSION,
    tests: catalogForClient(),
  });
});

/** LLM availability for the UI — never exposes keys or internal URLs. */
export const llmStatus = asyncHandler(async (_req: Request, res: Response) => {
  res.json({
    enabled: env.llm.enabled,
    provider: env.llm.provider === 'none' ? null : env.llm.provider,
    model: env.llm.model || null,
    message: env.llm.enabled
      ? 'AI explanations are available.'
      : 'AI explanation layer is not configured — deterministic summaries will be used instead.',
  });
});

export const modelStatus = asyncHandler(async (_req: Request, res: Response) => {
  const status = getModelStatus();
  res.json({
    engineVersion: ENGINE_VERSION,
    modelsDir: status.modelsDir,
    loadedAt: status.loadedAt,
    models: status.artifacts,
    errors: status.errors,
  });
});
