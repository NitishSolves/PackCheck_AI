import Fastify from 'fastify';
import cors from '@fastify/cors';
import { z } from 'zod';
import type { InspectionService } from './services/inspection-service.js';
import type { RegulatoryService } from './services/regulatory-service.js';
import type { AuthService } from './services/auth-service.js';
import type { ReportService } from './services/report-service.js';
import type {
  ExtractionRepository,
  FindingRepository,
  ImageRepository,
} from './repositories/types.js';

export type AppDeps = {
  auth: AuthService;
  inspections: InspectionService;
  regulatory: RegulatoryService;
  reports: ReportService;
  images: ImageRepository;
  findings: FindingRepository;
  extractions: ExtractionRepository;
  webOrigin: string;
};

export function buildApiApp(deps: AppDeps) {
  const app = Fastify({ logger: true });

  void app.register(cors, { origin: deps.webOrigin, credentials: true });

  app.get('/health', async () => ({ status: 'ok', service: 'api' }));

  app.get('/api/auth/roles', async () => ({ roles: deps.auth.roles() }));

  app.post('/api/inspections', async (request, reply) => {
    const body = z
      .object({
        createdByUserId: z.string().uuid(),
        referenceDate: z.string(),
        locationNote: z.string().optional(),
      })
      .parse(request.body);
    const inspection = await deps.inspections.create(body);
    return reply.code(201).send(inspection);
  });

  app.get('/api/inspections', async () => deps.inspections.list());

  app.get('/api/inspections/:id', async (request, reply) => {
    const params = z.object({ id: z.string().uuid() }).parse(request.params);
    const inspection = await deps.inspections.getById(params.id);
    if (!inspection) {
      return reply.code(404).send({ error: 'Inspection not found' });
    }
    return inspection;
  });

  app.post('/api/images', async (request, reply) => {
    const body = z
      .object({
        inspectionId: z.string().uuid(),
        storageKey: z.string().min(1),
        mimeType: z.string().min(1),
        originalFilename: z.string().min(1),
        panelLabel: z.string().optional(),
      })
      .parse(request.body);
    const image = await deps.images.create(body);
    return reply.code(201).send(image);
  });

  app.get('/api/extractions/:inspectionId', async (request) => {
    const params = z.object({ inspectionId: z.string().uuid() }).parse(request.params);
    return deps.extractions.listByInspection(params.inspectionId);
  });

  app.get('/api/findings/:inspectionId', async (request) => {
    const params = z.object({ inspectionId: z.string().uuid() }).parse(request.params);
    return deps.findings.listByInspection(params.inspectionId);
  });

  app.get('/api/rules', async () => deps.regulatory.listRules());
  app.get('/api/regulatory-sources', async () => deps.regulatory.listSources());
  app.get('/api/rule-proposals', async () => deps.regulatory.listProposals());

  app.get('/api/reports/:inspectionId', async (request) => {
    const params = z.object({ inspectionId: z.string().uuid() }).parse(request.params);
    return deps.reports.listByInspection(params.inspectionId);
  });

  return app;
}
