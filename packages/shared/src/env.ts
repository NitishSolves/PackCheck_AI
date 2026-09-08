import { z } from 'zod';

export const apiEnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  API_HOST: z.string().default('0.0.0.0'),
  API_PORT: z.coerce.number().int().positive().default(3001),
  WEB_ORIGIN: z.string().url().default('http://localhost:5173'),
  JWT_SECRET: z.string().min(16),
  JWT_EXPIRES_IN: z.string().default('8h'),
  DATABASE_URL: z.string().min(1),
  AI_SERVICE_URL: z.string().url(),
  OBJECT_STORAGE_DIR: z.string().default('./data/uploads'),
});
export type ApiEnv = z.infer<typeof apiEnvSchema>;

export const aiServiceEnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  AI_SERVICE_HOST: z.string().default('0.0.0.0'),
  AI_SERVICE_PORT: z.coerce.number().int().positive().default(3002),
  AI_PROVIDER: z.string().default('unconfigured'),
  AI_OCR_PROVIDER: z.string().optional(),
  USER_LLM_API_KEY: z.string().optional(),
  USER_LLM_BASE_URL: z.string().url().optional(),
  USER_LLM_MODEL: z.string().optional(),
  TESSERACT_LANG: z.string().default('eng'),
  AI_REQUEST_TIMEOUT_MS: z.coerce.number().int().positive().default(20_000),
  AI_MIN_OCR_CONFIDENCE: z.coerce.number().min(0).max(1).default(0.6),
  AI_MIN_FIELD_CONFIDENCE: z.coerce.number().min(0).max(1).default(0.5),
  AI_MIN_QUALITY_SCORE: z.coerce.number().min(0).max(1).default(0.5),
});
export type AiServiceEnv = z.infer<typeof aiServiceEnvSchema>;

export function loadApiEnv(source: NodeJS.ProcessEnv = process.env): ApiEnv {
  return apiEnvSchema.parse(source);
}

export function loadAiServiceEnv(source: NodeJS.ProcessEnv = process.env): AiServiceEnv {
  return aiServiceEnvSchema.parse(source);
}
