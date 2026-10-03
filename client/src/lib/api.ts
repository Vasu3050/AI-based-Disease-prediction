/**
 * Typed fetch wrapper for the MediPredict API.
 * - Always sends cookies (HTTP-only auth cookie).
 * - Normalizes errors into ApiClientError with code/message/details.
 */
export class ApiClientError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code: string = 'ERROR',
    public readonly details?: unknown
  ) {
    super(message);
    this.name = 'ApiClientError';
  }
}

export interface FieldIssue {
  path: string;
  message: string;
}

function flattenDetails(details: unknown): FieldIssue[] | null {
  if (!Array.isArray(details)) return null;
  const issues: FieldIssue[] = [];
  for (const d of details) {
    if (d && typeof d === 'object' && 'message' in d) {
      const rec = d as { path?: unknown; message?: unknown };
      issues.push({
        path: typeof rec.path === 'string' ? rec.path : '',
        message: String(rec.message ?? 'Invalid value'),
      });
    }
  }
  return issues.length > 0 ? issues : null;
}

export function fieldIssues(error: unknown): FieldIssue[] | null {
  if (error instanceof ApiClientError) return flattenDetails(error.details);
  return null;
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`/api${path}`, {
      method,
      credentials: 'include',
      headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiClientError(
      'Network error — could not reach the server. Check your connection and try again.',
      0,
      'NETWORK_ERROR'
    );
  }

  const text = await res.text();
  let data: unknown = {};
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = {};
    }
  }

  if (!res.ok) {
    const err = (data as { error?: { message?: string; code?: string; details?: unknown } }).error;
    throw new ApiClientError(
      err?.message ?? `Request failed (${res.status}).`,
      res.status,
      err?.code ?? 'ERROR',
      err?.details
    );
  }
  return data as T;
}

export const api = {
  get: <T>(path: string) => request<T>('GET', path),
  post: <T>(path: string, body?: unknown) => request<T>('POST', path, body),
  patch: <T>(path: string, body?: unknown) => request<T>('PATCH', path, body),
  del: <T>(path: string, body?: unknown) => request<T>('DELETE', path, body),
};
