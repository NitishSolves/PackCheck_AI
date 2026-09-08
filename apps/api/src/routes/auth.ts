import type { FastifyInstance } from 'fastify';
import { loginBodySchema } from '@packcheck/shared';
import type { LoginRateLimiter } from '../security/login-rate-limit.js';
import type { AuthService } from '../services/auth-service.js';
import type { AuditRepository } from '../repositories/types.js';

export function registerAuthRoutes(
  app: FastifyInstance,
  deps: { auth: AuthService; audit: AuditRepository; loginLimiter: LoginRateLimiter },
): void {
  app.get('/api/auth/roles', async () => ({ roles: deps.auth.roles() }));

  app.post('/api/auth/login', async (request, reply) => {
    const body = loginBodySchema.parse(request.body);
    const ipKey = `ip:${request.ip}`;
    const emailKey = `email:${body.email.toLowerCase()}`;
    deps.loginLimiter.assertAllowed(ipKey);
    deps.loginLimiter.assertAllowed(emailKey);
    try {
      const session = await deps.auth.login(body.email, body.password);
      deps.loginLimiter.recordSuccess(ipKey);
      deps.loginLimiter.recordSuccess(emailKey);
      await deps.audit.record({
        actorUserId: session.user.id,
        action: 'auth.login',
        entityType: 'user',
        entityId: session.user.id,
      });
      return reply.send(session);
    } catch (error) {
      deps.loginLimiter.recordFailure(ipKey);
      deps.loginLimiter.recordFailure(emailKey);
      throw error;
    }
  });

  app.post('/api/auth/logout', async (request) => {
    await deps.auth.logout(request.sessionId);
    await deps.audit.record({
      actorUserId: request.authUser.id,
      action: 'auth.logout',
      entityType: 'user',
      entityId: request.authUser.id,
    });
    return { ok: true };
  });

  app.get('/api/auth/me', async (request) => ({ user: request.authUser }));
}
