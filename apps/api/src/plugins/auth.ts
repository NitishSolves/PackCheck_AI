import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { PublicUser, UserRole } from '@packcheck/shared';
import { unauthorized } from '../errors.js';
import type { AuthService } from '../services/auth-service.js';

declare module 'fastify' {
  interface FastifyRequest {
    authUser: PublicUser;
    sessionId: string;
  }
}

function readBearer(request: FastifyRequest): string | null {
  const header = request.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return null;
  }
  return header.slice('Bearer '.length).trim() || null;
}

export function registerAuthHooks(app: FastifyInstance, auth: AuthService): void {
  app.decorateRequest('authUser', null as unknown as PublicUser);
  app.decorateRequest('sessionId', '');

  app.addHook('preHandler', async (request) => {
    const url = request.url.split('?')[0] ?? request.url;
    if (url === '/health' || url === '/api/auth/login' || url === '/api/auth/roles') {
      return;
    }
    if (!url.startsWith('/api/')) {
      return;
    }
    const token = readBearer(request);
    if (!token) {
      throw unauthorized();
    }
    const session = await auth.authenticate(token);
    request.authUser = session.user;
    request.sessionId = session.sessionId;
  });
}

export function requireRoles(auth: AuthService, roles: readonly UserRole[]) {
  return async (request: FastifyRequest): Promise<void> => {
    auth.assertRole(request.authUser, roles);
  };
}
