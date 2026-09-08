import { loadApiEnv, type ApiEnv } from '@packcheck/shared';

export type { ApiEnv };

export function envFrom(source: NodeJS.ProcessEnv = process.env): ApiEnv {
  return loadApiEnv(source);
}
