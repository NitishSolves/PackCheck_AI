import type { FastifyError, FastifyInstance } from 'fastify';
import type { ZodError } from 'zod';
import { AppError } from '../errors.js';

function isZodError(error: unknown): error is ZodError {
  return Boolean(
    error &&
    typeof error === 'object' &&
    'name' in error &&
    (error as { name?: string }).name === 'ZodError' &&
    'issues' in error &&
    Array.isArray((error as { issues?: unknown }).issues),
  );
}

export function registerErrorHandler(app: FastifyInstance): void {
  app.setErrorHandler((error: FastifyError | Error, request, reply) => {
    if (isZodError(error)) {
      return reply.code(400).send({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid request',
          details: error.flatten(),
        },
      });
    }

    if (error instanceof AppError) {
      return reply.code(error.statusCode).send({
        error: {
          code: error.code,
          message: error.message,
          details: error.details,
        },
      });
    }

    const statusCode =
      'statusCode' in error && typeof error.statusCode === 'number' ? error.statusCode : 500;
    if (statusCode >= 500) {
      request.log.error({ err: error, msg: 'unhandled_error' });
      return reply.code(500).send({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Internal server error',
        },
      });
    }

    return reply.code(statusCode).send({
      error: {
        code: 'REQUEST_ERROR',
        message: error.message,
      },
    });
  });
}
