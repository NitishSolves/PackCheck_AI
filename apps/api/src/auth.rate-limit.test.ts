import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestApp, TEST_PASSWORD } from './test-app.js';

const { app } = await createTestApp();

beforeAll(async () => {
  await app.ready();
});

afterAll(async () => {
  await app.close();
});

describe('login rate limiting', () => {
  it('returns 429 after repeated failed logins', async () => {
    for (let i = 0; i < 5; i += 1) {
      const failed = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: { email: 'inspector@packcheck.local', password: 'wrong-password' },
      });
      expect(failed.statusCode).toBe(401);
    }
    const limited = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: 'inspector@packcheck.local', password: TEST_PASSWORD },
    });
    expect(limited.statusCode).toBe(429);
  });
});
