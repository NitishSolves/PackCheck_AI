import Fastify from 'fastify';
import cors from '@fastify/cors';
import type { InspectionService } from './services/inspection-service.js';
import type { RegulatoryService } from './services/regulatory-service.js';
import type { AuthService } from './services/auth-service.js';
import type { ReportService } from './services/report-service.js';
import type { ExtractionService } from './services/extraction-service.js';
import type { FindingService } from './services/finding-service.js';
import type { AuditService } from './services/audit-service.js';
import type { AuditRepository, ExtractionRepository } from './repositories/types.js';
import { LoginRateLimiter } from './security/login-rate-limit.js';
import { registerErrorHandler } from './plugins/error-handler.js';
import { registerAuthHooks } from './plugins/auth.js';
import { registerAuthRoutes } from './routes/auth.js';
import { registerInspectionRoutes } from './routes/inspections.js';
import { registerRegulatoryRoutes } from './routes/regulatory.js';

export type AppDeps = {
  auth: AuthService;
  inspections: InspectionService;
  regulatory: RegulatoryService;
  reports: ReportService;
  findings: FindingService;
  extractions: ExtractionRepository;
  extractionService?: ExtractionService;
  audit: AuditRepository;
  auditService: AuditService;
  webOrigin: string;
  loginLimiter?: LoginRateLimiter;
};

export function buildApiApp(deps: AppDeps) {
  const app = Fastify({
    logger: {
      level: process.env.LOG_LEVEL ?? 'info',
    },
  });

  void app.register(cors, { origin: deps.webOrigin, credentials: true });
  registerErrorHandler(app);
  registerAuthHooks(app, deps.auth);

  const loginLimiter = deps.loginLimiter ?? new LoginRateLimiter();

  app.get('/health', async () => ({ status: 'ok', service: 'api' }));

  registerAuthRoutes(app, { auth: deps.auth, audit: deps.audit, loginLimiter });
  registerInspectionRoutes(app, {
    inspections: deps.inspections,
    findings: deps.findings,
    extractions: deps.extractions,
    extractionService: deps.extractionService,
    reports: deps.reports,
    audit: deps.auditService,
  });
  registerRegulatoryRoutes(app, deps.regulatory);

  return app;
}
