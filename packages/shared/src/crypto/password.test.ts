import { describe, expect, it } from 'vitest';
import { hashPassword, verifyPassword } from './password.js';

describe('password hashing', () => {
  it('verifies a hash of the original password', async () => {
    const hash = await hashPassword('PackCheckInspector!dev');
    expect(hash.startsWith('scrypt:')).toBe(true);
    expect(await verifyPassword('PackCheckInspector!dev', hash)).toBe(true);
    expect(await verifyPassword('wrong-password', hash)).toBe(false);
  });

  it('rejects malformed stored hashes', async () => {
    expect(await verifyPassword('secret', 'bcrypt:not-supported')).toBe(false);
  });
});
