import { createHash, randomUUID } from 'node:crypto';
import {
  USER_ROLES,
  hashPassword,
  verifyPassword,
  type PublicUser,
  type UserRole,
} from '@packcheck/shared';
import { forbidden, unauthorized } from '../errors.js';
import type { SessionRepository, UserRecord, UserRepository } from '../repositories/types.js';

export type AuthUser = PublicUser;

export type TokenClaims = {
  sub: string;
  sid: string;
  role: UserRole;
};

export interface TokenSigner {
  sign(claims: TokenClaims): Promise<string>;
  verify(token: string): Promise<TokenClaims>;
}

export function hashSessionToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function toPublicUser(user: UserRecord): PublicUser {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    role: user.role,
  };
}

function parseDuration(value: string): number {
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

export class AuthService {
  constructor(
    private readonly users: UserRepository,
    private readonly sessions: SessionRepository,
    private readonly signer: TokenSigner,
    private readonly tokenTtl: string = '8h',
  ) {}

  roles(): readonly UserRole[] {
    return USER_ROLES;
  }

  async hashPassword(password: string): Promise<string> {
    return hashPassword(password);
  }

  async login(email: string, password: string): Promise<{ token: string; user: PublicUser }> {
    const user = await this.users.findByEmail(email);
    if (!user || !user.isActive) {
      throw unauthorized('Invalid email or password');
    }
    const ok = await verifyPassword(password, user.passwordHash);
    if (!ok) {
      throw unauthorized('Invalid email or password');
    }
    const sessionId = randomUUID();
    const token = await this.signer.sign({
      sub: user.id,
      sid: sessionId,
      role: user.role,
    });
    await this.sessions.create({
      id: sessionId,
      userId: user.id,
      tokenHash: hashSessionToken(token),
      expiresAt: new Date(Date.now() + parseDuration(this.tokenTtl)),
    });
    return { token, user: toPublicUser(user) };
  }

  async authenticate(token: string): Promise<{ user: PublicUser; sessionId: string }> {
    let claims: TokenClaims;
    try {
      claims = await this.signer.verify(token);
    } catch {
      throw unauthorized('Invalid or expired session');
    }
    const session = await this.sessions.findById(claims.sid);
    if (!session || session.revokedAt || session.expiresAt.getTime() <= Date.now()) {
      throw unauthorized('Invalid or expired session');
    }
    if (session.tokenHash !== hashSessionToken(token)) {
      throw unauthorized('Invalid or expired session');
    }
    const user = await this.users.findById(claims.sub);
    if (!user || !user.isActive) {
      throw unauthorized('Invalid or expired session');
    }
    return { user: toPublicUser(user), sessionId: session.id };
  }

  async logout(sessionId: string): Promise<void> {
    await this.sessions.revoke(sessionId);
  }

  assertRole(user: PublicUser, allowed: readonly UserRole[]): void {
    if (!allowed.includes(user.role)) {
      throw forbidden();
    }
  }
}
