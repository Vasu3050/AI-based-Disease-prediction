import { env } from '../config/env';
import { logger } from '../utils/logger';
import { OpenAICompatibleProvider } from './providers/openaiCompatible';

export interface LLMCompletionArgs {
  system: string;
  user: string;
  maxTokens?: number;
}

export interface LLMProvider {
  /** Stable provider id, e.g. "openai-compatible". */
  name: string;
  /** Human-readable label with model, for display. */
  label: string;
  /** Return raw text content from the model. Throws on failure. */
  complete(args: LLMCompletionArgs): Promise<string>;
}

let cached: { provider: LLMProvider | null; forConfig: string } | null = null;

export function getLLMProvider(): LLMProvider | null {
  const cfgKey = `${env.llm.provider}|${env.llm.baseUrl}|${env.llm.model}|${env.llm.enabled}`;
  if (cached && cached.forConfig === cfgKey) return cached.provider;

  let provider: LLMProvider | null = null;
  if (env.llm.enabled) {
    if (
      env.llm.provider === 'openai-compatible' ||
      env.llm.provider === 'xai' ||
      env.llm.provider === 'ollama'
    ) {
      provider = new OpenAICompatibleProvider({
        baseUrl: env.llm.baseUrl,
        apiKey: env.llm.apiKey,
        model: env.llm.model,
        timeoutMs: env.llm.timeoutMs,
        name: env.llm.provider,
        // Local reasoning models (Ollama/LM Studio) need a larger budget:
        // they may spend thousands of tokens "thinking" before answering.
        defaultMaxTokens: env.llm.isLocal || env.llm.provider === 'ollama' ? 4096 : 1600,
        // Constrained JSON decoding can slow local reasoning models down a
        // lot — local endpoints get plain prompting (JSON is extracted and
        // validated by the explanation layer either way).
        useJsonMode: !env.llm.isLocal,
      });
      logger.info('LLM layer enabled', { provider: env.llm.provider, model: env.llm.model });
    }
  } else if (env.llm.provider !== 'none') {
    logger.warn('LLM layer disabled', { reason: env.llm.disabledReason ?? 'not configured' });
  }

  cached = { provider, forConfig: cfgKey };
  return provider;
}

/** For tests: reset the cached provider. */
export function resetLLMProviderCache(): void {
  cached = null;
}
