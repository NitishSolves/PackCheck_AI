import { describe, expect, it } from 'vitest';
import { apiEnvSchema } from './env.js';

describe('apiEnvSchema', () => {
  it('rejects missing database and jwt secrets', () => {
    const result = apiEnvSchema.safeParse({
      NODE_ENV: 'test',
      AI_SERVICE_URL: 'http://localhost:3002',
    });
    expect(result.success).toBe(false);
  });
});
