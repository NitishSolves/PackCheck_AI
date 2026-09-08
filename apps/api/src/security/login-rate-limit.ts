import { tooManyRequests } from '../errors.js';

type AttemptBucket = {
  count: number;
  resetAt: number;
};

export class LoginRateLimiter {
  private readonly buckets = new Map<string, AttemptBucket>();

  constructor(
    private readonly maxAttempts: number = 5,
    private readonly windowMs: number = 15 * 60 * 1000,
  ) {}

  assertAllowed(key: string): void {
    this.prune();
    const bucket = this.buckets.get(key);
    if (!bucket) {
      return;
    }
    if (Date.now() >= bucket.resetAt) {
      this.buckets.delete(key);
      return;
    }
    if (bucket.count >= this.maxAttempts) {
      throw tooManyRequests('Too many login attempts. Try again later.');
    }
  }

  recordFailure(key: string): void {
    const now = Date.now();
    const existing = this.buckets.get(key);
    if (!existing || now >= existing.resetAt) {
      this.buckets.set(key, { count: 1, resetAt: now + this.windowMs });
      return;
    }
    existing.count += 1;
  }

  recordSuccess(key: string): void {
    this.buckets.delete(key);
  }

  private prune(): void {
    const now = Date.now();
    for (const [key, bucket] of this.buckets) {
      if (now >= bucket.resetAt) {
        this.buckets.delete(key);
      }
    }
  }
}
