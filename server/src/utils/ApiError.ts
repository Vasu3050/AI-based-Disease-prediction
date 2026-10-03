/** Operational error with an HTTP status, a safe message and optional details. */
export class ApiError extends Error {
  public readonly status: number;
  public readonly code: string;
  public readonly details?: unknown;
  public readonly expose: boolean;

  constructor(status: number, message: string, options?: { code?: string; details?: unknown }) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = options?.code ?? defaultCode(status);
    this.details = options?.details;
    this.expose = status < 500;
    Error.captureStackTrace?.(this, ApiError);
  }

  static badRequest(message: string, details?: unknown): ApiError {
    return new ApiError(400, message, { details });
  }
  static unauthorized(message = 'Authentication required.'): ApiError {
    return new ApiError(401, message);
  }
  static forbidden(message = 'You do not have permission to perform this action.'): ApiError {
    return new ApiError(403, message);
  }
  static notFound(message = 'Resource not found.'): ApiError {
    return new ApiError(404, message);
  }
  static conflict(message: string, details?: unknown): ApiError {
    return new ApiError(409, message, { details });
  }
  static tooMany(message = 'Too many requests. Please slow down.'): ApiError {
    return new ApiError(429, message);
  }
  static badGateway(message = 'Upstream provider error.'): ApiError {
    return new ApiError(502, message);
  }
  static serviceUnavailable(message = 'Service temporarily unavailable.'): ApiError {
    return new ApiError(503, message);
  }
  static validation(message: string, details?: unknown): ApiError {
    return new ApiError(422, message, { code: 'VALIDATION_ERROR', details });
  }
}

function defaultCode(status: number): string {
  switch (status) {
    case 400:
      return 'BAD_REQUEST';
    case 401:
      return 'UNAUTHORIZED';
    case 403:
      return 'FORBIDDEN';
    case 404:
      return 'NOT_FOUND';
    case 409:
      return 'CONFLICT';
    case 422:
      return 'VALIDATION_ERROR';
    case 429:
      return 'RATE_LIMITED';
    default:
      return status >= 500 ? 'INTERNAL_ERROR' : 'ERROR';
  }
}
