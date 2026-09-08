import { describe, expect, it } from 'vitest';
import { AppError } from '../errors.js';
import { LoginRateLimiter } from './login-rate-limit.js';

describe('LoginRateLimiter', () => {
  it('blocks after the configured number of failures', () => {
    const limiter = new LoginRateLimiter(2, 60_000);
    limiter.assertAllowed('ip:1');
    limiter.recordFailure('ip:1');
    limiter.recordFailure('ip:1');
    expect(() => limiter.assertAllowed('ip:1')).toThrow(AppError);
  });

  it('clears failures after success', () => {
    const limiter = new LoginRateLimiter(1, 60_000);
    limiter.recordFailure('email:a');
    limiter.recordSuccess('email:a');
    expect(() => limiter.assertAllowed('email:a')).not.toThrow();
  });
});
