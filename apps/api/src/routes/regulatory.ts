import type { FastifyInstance } from 'fastify';
import {
  createRegulatorySourceBodySchema,
  createRuleProposalBodySchema,
  createRuleVersionBodySchema,
} from '@packcheck/shared';
import { z } from 'zod';
import type { RegulatoryService } from '../services/regulatory-service.js';

const ruleIdParams = z.object({ id: z.string().uuid() });

export function registerRegulatoryRoutes(app: FastifyInstance, service: RegulatoryService): void {
  app.get('/api/rules', async (request) => {
    service.assertCanRead(request.authUser);
    return service.listRules();
  });

  app.get('/api/rules/:id/versions', async (request) => {
    service.assertCanRead(request.authUser);
    const params = ruleIdParams.parse(request.params);
    return service.listRuleVersions(params.id);
  });

  app.post('/api/rules/:id/versions', async (request, reply) => {
    const params = ruleIdParams.parse(request.params);
    const body = createRuleVersionBodySchema.parse({
      ...(request.body as object),
      ruleId: params.id,
    });
    const version = await service.createRuleVersion(request.authUser, body);
    return reply.code(201).send(version);
  });

  app.get('/api/regulatory-sources', async (request) => {
    service.assertCanRead(request.authUser);
    return service.listSources();
  });

  app.post('/api/regulatory-sources', async (request, reply) => {
    const body = createRegulatorySourceBodySchema.parse(request.body);
    const source = await service.createSource(request.authUser, body);
    return reply.code(201).send(source);
  });

  app.get('/api/rule-proposals', async (request) => {
    service.assertCanRead(request.authUser);
    return service.listProposals();
  });

  app.post('/api/rule-proposals', async (request, reply) => {
    const body = createRuleProposalBodySchema.parse(request.body);
    const proposal = await service.createProposal(request.authUser, body);
    return reply.code(201).send(proposal);
  });
}
