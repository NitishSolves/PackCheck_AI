import type { FastifyBaseLogger } from 'fastify';

export type LogFields = Record<string, unknown>;

export function logInfo(logger: FastifyBaseLogger, message: string, fields: LogFields = {}): void {
  logger.info({ msg: message, ...fields });
}

export function logWarn(logger: FastifyBaseLogger, message: string, fields: LogFields = {}): void {
  logger.warn({ msg: message, ...fields });
}

export function logError(logger: FastifyBaseLogger, message: string, fields: LogFields = {}): void {
  logger.error({ msg: message, ...fields });
}
