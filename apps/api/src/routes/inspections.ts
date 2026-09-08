import type { FastifyInstance } from 'fastify';
import {
  createInspectionBodySchema,
  paginationQuerySchema,
  registerImageBodySchema,
  updateInspectionBodySchema,
} from '@packcheck/shared';
import { z } from 'zod';
import type { InspectionService } from '../services/inspection-service.js';
import type { ExtractionService } from '../services/extraction-service.js';
import type { ExtractionRepository, FindingRepository } from '../repositories/types.js';
import type { ReportService } from '../services/report-service.js';
import { serviceUnavailable } from '../errors.js';

const idParams = z.object({ id: z.string().uuid() });

export function registerInspectionRoutes(
  app: FastifyInstance,
  deps: {
    inspections: InspectionService;
    findings: FindingRepository;
    extractions: ExtractionRepository;
    extractionService?: ExtractionService;
    reports: ReportService;
  },
): void {
  app.post('/api/inspections', async (request, reply) => {
    const body = createInspectionBodySchema.parse(request.body);
    const inspection = await deps.inspections.create(request.authUser, body);
    return reply.code(201).send(inspection);
  });

  app.get('/api/inspections', async (request) => {
    const query = paginationQuerySchema.parse(request.query);
    return deps.inspections.list(query);
  });

  app.get('/api/inspections/:id', async (request) => {
    const params = idParams.parse(request.params);
    return deps.inspections.getById(params.id);
  });

  app.patch('/api/inspections/:id', async (request) => {
    const params = idParams.parse(request.params);
    const body = updateInspectionBodySchema.parse(request.body);
    return deps.inspections.update(request.authUser, params.id, body);
  });

  app.post('/api/inspections/:id/images', async (request, reply) => {
    const params = idParams.parse(request.params);
    const body = registerImageBodySchema.parse(request.body);
    const image = await deps.inspections.registerImage(request.authUser, params.id, body);
    return reply.code(201).send(image);
  });

  app.get('/api/inspections/:id/images', async (request) => {
    const params = idParams.parse(request.params);
    const detail = await deps.inspections.getById(params.id);
    return { items: detail.images };
  });

  app.get('/api/inspections/:id/extractions', async (request) => {
    const params = idParams.parse(request.params);
    if (deps.extractionService) {
      return deps.extractionService.getByInspection(params.id);
    }
    await deps.inspections.getById(params.id);
    return deps.extractions.listByInspection(params.id);
  });

  app.post('/api/inspections/:id/extract', async (request) => {
    const params = idParams.parse(request.params);
    if (!deps.extractionService) {
      throw serviceUnavailable('Extraction service is not configured');
    }
    return deps.extractionService.runForInspection(request.authUser, params.id);
  });

  app.get('/api/inspections/:id/findings', async (request) => {
    const params = idParams.parse(request.params);
    await deps.inspections.getById(params.id);
    return deps.findings.listByInspection(params.id);
  });

  app.get('/api/inspections/:id/reports', async (request) => {
    const params = idParams.parse(request.params);
    await deps.inspections.getById(params.id);
    return deps.reports.listByInspection(params.id);
  });

  app.post('/api/images', async (request, reply) => {
    const body = registerImageBodySchema
      .extend({ inspectionId: z.string().uuid() })
      .parse(request.body);
    const image = await deps.inspections.registerImage(request.authUser, body.inspectionId, body);
    return reply.code(201).send(image);
  });

  app.get('/api/extractions/:inspectionId', async (request) => {
    const params = z.object({ inspectionId: z.string().uuid() }).parse(request.params);
    if (deps.extractionService) {
      return deps.extractionService.getByInspection(params.inspectionId);
    }
    await deps.inspections.getById(params.inspectionId);
    return deps.extractions.listByInspection(params.inspectionId);
  });

  app.get('/api/findings/:inspectionId', async (request) => {
    const params = z.object({ inspectionId: z.string().uuid() }).parse(request.params);
    await deps.inspections.getById(params.inspectionId);
    return deps.findings.listByInspection(params.inspectionId);
  });

  app.get('/api/reports/:inspectionId', async (request) => {
    const params = z.object({ inspectionId: z.string().uuid() }).parse(request.params);
    await deps.inspections.getById(params.inspectionId);
    return deps.reports.listByInspection(params.inspectionId);
  });
}
