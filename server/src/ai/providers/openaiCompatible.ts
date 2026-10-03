/**
 * OpenAI-compatible chat-completions provider.
 *
 * Works with: OpenAI, xAI (Grok), Groq, OpenRouter, Together, and local
 * servers exposing an OpenAI-compatible API (Ollama, LM Studio, llama.cpp).
 * Configuration comes exclusively from server-side environment variables.
 *
 * Implementation notes:
 *   - Uses node:http(s) directly so the request timeout is fully controllable
 *     (Node's global fetch hard-caps at 300s via undici, which is too short
 *     for large local reasoning models).
 *   - `useJsonMode` should be false for local "thinking" models: constrained
 *     JSON decoding can dramatically slow reasoning models down; the
 *     explanation layer extracts JSON from plain output anyway.
 */
import http from 'node:http';
import https from 'node:https';
import { URL } from 'node:url';
import { logger } from '../../utils/logger';
import type { LLMCompletionArgs, LLMProvider } from '../provider';

export class LLMHttpError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly bodySnippet?: string
  ) {
    super(message);
    this.name = 'LLMHttpError';
  }
}

interface HttpResponse {
  status: number;
  text: string;
}

function postJson(
  urlString: string,
  headers: Record<string, string>,
  body: string,
  timeoutMs: number
): Promise<HttpResponse> {
  return new Promise((resolve, reject) => {
    let url: URL;
    try {
      url = new URL(urlString);
    } catch {
      reject(new Error(`Invalid LLM base URL: ${urlString}`));
      return;
    }
    const lib = url.protocol === 'https:' ? https : http;
    const req = lib.request(
      {
        hostname: url.hostname,
        port: url.port || (url.protocol === 'https:' ? 443 : 80),
        path: `${url.pathname.replace(/\/$/, '')}${url.search}`,
        method: 'POST',
        headers: { ...headers, 'Content-Length': Buffer.byteLength(body) },
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk) => chunks.push(chunk));
        res.on('end', () =>
          resolve({ status: res.statusCode ?? 0, text: Buffer.concat(chunks).toString('utf8') })
        );
      }
    );
    // Socket inactivity timeout: for non-streaming completions the server stays
    // quiet until generation finishes, so this acts as the overall cap.
    req.setTimeout(timeoutMs, () => {
      req.destroy(new Error(`LLM request timed out after ${Math.round(timeoutMs / 1000)}s`));
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

export class OpenAICompatibleProvider implements LLMProvider {
  public readonly name: string;
  public readonly label: string;
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly model: string;
  private readonly timeoutMs: number;
  private readonly defaultMaxTokens: number;
  private readonly useJsonMode: boolean;

  constructor(opts: {
    baseUrl: string;
    apiKey: string;
    model: string;
    timeoutMs: number;
    name: string;
    defaultMaxTokens?: number;
    useJsonMode?: boolean;
  }) {
    this.baseUrl = opts.baseUrl.replace(/\/+$/, '');
    this.apiKey = opts.apiKey;
    this.model = opts.model;
    this.timeoutMs = opts.timeoutMs;
    this.name = opts.name;
    this.defaultMaxTokens = opts.defaultMaxTokens ?? 1600;
    this.useJsonMode = opts.useJsonMode ?? true;
    this.label = `${opts.name} · ${opts.model}`;
  }

  async complete(args: LLMCompletionArgs): Promise<string> {
    try {
      return await this.request(args, this.useJsonMode);
    } catch (err) {
      if (err instanceof LLMHttpError && err.status === 400) {
        // Some OpenAI-compatible servers do not support response_format —
        // retry once without it before giving up.
        logger.warn('LLM rejected JSON mode; retrying without response_format', {
          status: err.status,
        });
        return this.request(args, false);
      }
      throw err;
    }
  }

  private async request(args: LLMCompletionArgs, jsonMode: boolean): Promise<string> {
    const body = JSON.stringify({
      model: this.model,
      messages: [
        { role: 'system', content: args.system },
        { role: 'user', content: args.user },
      ],
      temperature: 0.2,
      max_tokens: args.maxTokens ?? this.defaultMaxTokens,
      ...(jsonMode ? { response_format: { type: 'json_object' } } : {}),
      stream: false,
    });

    const { status, text } = await postJson(
      `${this.baseUrl}/chat/completions`,
      {
        'Content-Type': 'application/json',
        ...(this.apiKey ? { Authorization: `Bearer ${this.apiKey}` } : {}),
      },
      body,
      this.timeoutMs
    );

    if (status < 200 || status >= 300) {
      throw new LLMHttpError(status, `LLM request failed with status ${status}`, text.slice(0, 300));
    }

    let data: { choices?: { message?: { content?: unknown; reasoning?: unknown } }[] };
    try {
      data = JSON.parse(text) as typeof data;
    } catch {
      throw new LLMHttpError(502, 'LLM returned a non-JSON response', text.slice(0, 200));
    }

    const message = data.choices?.[0]?.message;
    let content = typeof message?.content === 'string' ? message.content : '';
    // Some local "thinking" models (e.g. DeepSeek-R1 via Ollama) route their
    // entire output — final answer included — into a separate `reasoning`
    // field when the completion budget is small. Use it as a fallback so the
    // explanation layer can still try to extract JSON.
    if (content.trim() === '' && typeof message?.reasoning === 'string') {
      content = message.reasoning;
    }
    if (content.trim() === '') {
      throw new LLMHttpError(502, 'LLM returned an empty response');
    }
    return content;
  }
}
