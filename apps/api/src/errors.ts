export class AppError extends Error {
  readonly statusCode: number;
  readonly code: string;
  readonly details: unknown;

  constructor(statusCode: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

export function badRequest(message: string, details?: unknown): AppError {
  return new AppError(400, 'BAD_REQUEST', message, details);
}

export function unauthorized(message = 'Authentication required'): AppError {
  return new AppError(401, 'UNAUTHENTICATED', message);
}

export function forbidden(message = 'Insufficient permissions'): AppError {
  return new AppError(403, 'FORBIDDEN', message);
}

export function notFound(message: string): AppError {
  return new AppError(404, 'NOT_FOUND', message);
}

export function conflict(message: string): AppError {
  return new AppError(409, 'CONFLICT', message);
}

export function tooManyRequests(message = 'Too many login attempts'): AppError {
  return new AppError(429, 'RATE_LIMITED', message);
}

export function serviceUnavailable(message: string, details?: unknown): AppError {
  return new AppError(503, 'SERVICE_UNAVAILABLE', message, details);
}

export function gatewayTimeout(message: string, details?: unknown): AppError {
  return new AppError(504, 'GATEWAY_TIMEOUT', message, details);
}

export function unprocessable(message: string, details?: unknown): AppError {
  return new AppError(422, 'UNPROCESSABLE', message, details);
}
