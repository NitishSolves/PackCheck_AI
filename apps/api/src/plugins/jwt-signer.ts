import { createHmac, timingSafeEqual } from 'node:crypto';
import type { TokenClaims, TokenSigner } from '../services/auth-service.js';
import { unauthorized } from '../errors.js';

function base64url(input: Buffer | string): string {
  const buf = typeof input === 'string' ? Buffer.from(input) : input;
  return buf.toString('base64url');
}

function signHmac(secret: string, data: string): string {
  return createHmac('sha256', secret).update(data).digest('base64url');
}

export class HmacJwtSigner implements TokenSigner {
  constructor(
    private readonly secret: string,
    private readonly expiresInMs: number,
  ) {}

  async sign(claims: TokenClaims): Promise<string> {
    const header = base64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
    const exp = Math.floor((Date.now() + this.expiresInMs) / 1000);
    const payload = base64url(JSON.stringify({ ...claims, exp }));
    const signature = signHmac(this.secret, `${header}.${payload}`);
    return `${header}.${payload}.${signature}`;
  }

  async verify(token: string): Promise<TokenClaims> {
    const parts = token.split('.');
    if (parts.length !== 3) {
      throw unauthorized('Invalid or expired session');
    }
    const [header, payload, signature] = parts;
    const expected = signHmac(this.secret, `${header}.${payload}`);
    const sigBuf = Buffer.from(signature ?? '', 'utf8');
    const expectedBuf = Buffer.from(expected, 'utf8');
    if (sigBuf.length !== expectedBuf.length || !timingSafeEqual(sigBuf, expectedBuf)) {
      throw unauthorized('Invalid or expired session');
    }
    const parsed = JSON.parse(
      Buffer.from(payload ?? '', 'base64url').toString('utf8'),
    ) as TokenClaims & {
      exp?: number;
    };
    if (!parsed.sub || !parsed.sid || !parsed.role) {
      throw unauthorized('Invalid or expired session');
    }
    if (parsed.exp && parsed.exp * 1000 <= Date.now()) {
      throw unauthorized('Invalid or expired session');
    }
    return { sub: parsed.sub, sid: parsed.sid, role: parsed.role };
  }
}

export function durationToMs(value: string): number {
  const match = /^(\d+)([smhd])$/.exec(value.trim());
  if (!match) {
    return 8 * 60 * 60 * 1000;
  }
  const amount = Number(match[1]);
  const unit = match[2];
  const multipliers: Record<string, number> = {
    s: 1000,
    m: 60_000,
    h: 3_600_000,
    d: 86_400_000,
  };
  return amount * (multipliers[unit ?? 'h'] ?? 3_600_000);
}
