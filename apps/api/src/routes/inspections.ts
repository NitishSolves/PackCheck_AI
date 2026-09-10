import type { FastifyInstance } from 'fastify';
import {
  auditListQuerySchema,
  createInspectionBodySchema,
  inspectionListQuerySchema,
  registerImageBodySchema,
  reviewFindingBodySchema,
  updateInspectionBodySchema,
} from '@packcheck/shared';
import { z } from 'zod';
import type { InspectionService } from '../services/inspection-service.js';
import type { ExtractionService } from '../services/extraction-service.js';
import type { ExtractionRepository } from '../repositories/types.js';
import type { ReportService } from '../services/report-service.js';
import type { FindingService } from '../services/finding-service.js';
import type { AuditService } from '../services/audit-service.js';
import { serviceUnavailable } from '../errors.js';

const idParams = z.object({ id: z.string().uuid() });
const findingParams = z.object({ findingId: z.string().uuid() });
const evidenceParams = z.object({
  findingId: z.string().uuid(),
  evidenceId: z.string().uuid(),
});
const imageParams = z.object({ imageId: z.string().uuid() });
const reportParams = z.object({ reportId: z.string().uuid() });

export function registerInspectionRoutes(
  app: FastifyInstance,
  deps: {
    inspections: InspectionService;
    findings: FindingService;
    extractions: ExtractionRepository;
    extractionService?: ExtractionService;
    reports: ReportService;
    audit: AuditService;
  },
): void {
  app.post('/api/inspections', async (request, reply) => {
    const body = createInspectionBodySchema.parse(request.body);
    const inspection = await deps.inspections.create(request.authUser, body);
    return reply.code(201).send(inspection);
  });

  app.get('/api/inspections', async (request) => {
    const query = inspectionListQuerySchema.parse(request.query);
    return deps.inspections.list(query, request.authUser);
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

  app.post('/api/inspections/:id/finalize', async (request) => {
    const params = idParams.parse(request.params);
    return deps.inspections.finalize(request.authUser, params.id);
  });

  app.post('/api/inspections/:id/reopen', async (request) => {
    const params = idParams.parse(request.params);
    return deps.inspections.reopen(request.authUser, params.id);
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
    return deps.findings.listByInspection(request.authUser, params.id);
  });

  app.get('/api/inspections/:id/reports', async (request) => {
    const params = idParams.parse(request.params);
    return deps.reports.listForActor(request.authUser, params.id);
  });

  app.post('/api/inspections/:id/reports', async (request, reply) => {
    const params = idParams.parse(request.params);
    const report = await deps.reports.generate(request.authUser, params.id);
    return reply.code(201).send(report);
  });

  app.post('/api/images', async (request, reply) => {
    const body = registerImageBodySchema
      .extend({ inspectionId: z.string().uuid() })
      .parse(request.body);
    const image = await deps.inspections.registerImage(request.authUser, body.inspectionId, body);
    return reply.code(201).send(image);
  });

  app.get('/api/images/:imageId/original', async (request, reply) => {
    const params = imageParams.parse(request.params);
    const { image, buffer } = await deps.findings.originalImage(request.authUser, params.imageId);
    return reply
      .header('Content-Type', image.mimeType)
      .header('Content-Disposition', `inline; filename="${image.originalFilename}"`)
      .send(buffer);
  });

  app.get('/api/extractions/:inspectionId', async (request) => {
    const params = z.object({ inspectionId: z.string().uuid() }).parse(request.params);
    if (deps.extractionService) {
      return deps.extractionService.getByInspection(params.inspectionId);
    }
    await deps.inspections.getById(params.inspectionId);
    return deps.extractions.listByInspection(params.inspectionId);
  });

  app.get('/api/findings/:findingId', async (request) => {
    const params = findingParams.parse(request.params);
    try {
      return await deps.findings.getById(request.authUser, params.findingId);
    } catch (error) {
      if (error && typeof error === 'object' && 'statusCode' in error && error.statusCode === 404) {
        return deps.findings.listByInspection(request.authUser, params.findingId);
      }
      throw error;
    }
  });

  app.get('/api/findings/:findingId/evidence/:evidenceId/crop', async (request, reply) => {
    const params = evidenceParams.parse(request.params);
    const { buffer } = await deps.findings.evidenceCrop(
      request.authUser,
      params.findingId,
      params.evidenceId,
    );
    return reply
      .header('Content-Type', 'image/png')
      .header('Content-Disposition', 'inline; filename="evidence-crop.png"')
      .send(buffer);
  });

  app.post('/api/findings/:findingId/review', async (request, reply) => {
    const params = findingParams.parse(request.params);
    const body = reviewFindingBodySchema.parse(request.body);
    const result = await deps.findings.review(request.authUser, params.findingId, body);
    return reply.code(201).send(result);
  });

  app.get('/api/reports/:inspectionId', async (request) => {
    const params = z.object({ inspectionId: z.string().uuid() }).parse(request.params);
    return deps.reports.listForActor(request.authUser, params.inspectionId);
  });

  app.get('/api/reports/:reportId/download', async (request, reply) => {
    const params = reportParams.parse(request.params);
    const { report, buffer } = await deps.reports.download(request.authUser, params.reportId);
    return reply
      .header('Content-Type', 'application/pdf')
      .header('Content-Disposition', `attachment; filename="packcheck-${report.inspectionId}.pdf"`)
      .send(buffer);
  });

  app.get('/api/audit-logs', async (request) => {
    const query = auditListQuerySchema.parse(request.query);
    return deps.audit.list(request.authUser, query);
  });
}
