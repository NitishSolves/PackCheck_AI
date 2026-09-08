import { createDb } from '@packcheck/db';
import { envFrom } from './env.js';
import { buildApiApp } from './app.js';
import {
  PostgresAuditRepository,
  PostgresExtractionRepository,
  PostgresFindingRepository,
  PostgresImageRepository,
  PostgresInspectionRepository,
  PostgresRegulatorySourceRepository,
  PostgresReportRepository,
  PostgresRuleProposalRepository,
  PostgresRuleRepository,
  PostgresRuleVersionRepository,
  PostgresSessionRepository,
  PostgresUserRepository,
} from './repositories/postgres.js';
import { AuthService } from './services/auth-service.js';
import { InspectionService } from './services/inspection-service.js';
import { RegulatoryService } from './services/regulatory-service.js';
import { ReportService } from './services/report-service.js';
import { HttpAiClient } from './services/ai-client.js';
import { ExtractionService } from './services/extraction-service.js';
import { durationToMs, HmacJwtSigner } from './plugins/jwt-signer.js';
import { LocalObjectStorage } from './storage/object-storage.js';
import { LoginRateLimiter } from './security/login-rate-limit.js';

const env = envFrom();
const db = createDb(env.DATABASE_URL);

const users = new PostgresUserRepository(db);
const sessions = new PostgresSessionRepository(db);
const inspections = new PostgresInspectionRepository(db);
const images = new PostgresImageRepository(db);
const audit = new PostgresAuditRepository(db);
const findings = new PostgresFindingRepository(db);
const extractions = new PostgresExtractionRepository(db);
const rules = new PostgresRuleRepository(db);
const sources = new PostgresRegulatorySourceRepository(db);
const proposals = new PostgresRuleProposalRepository(db);
const versions = new PostgresRuleVersionRepository(db);
const reports = new PostgresReportRepository(db);
const storage = new LocalObjectStorage(env.OBJECT_STORAGE_DIR);

const auth = new AuthService(
  users,
  sessions,
  new HmacJwtSigner(env.JWT_SECRET, durationToMs(env.JWT_EXPIRES_IN)),
  env.JWT_EXPIRES_IN,
);

const ai = new HttpAiClient(env.AI_SERVICE_URL);
const inspectionService = new InspectionService(inspections, images, audit, storage);
const extractionService = new ExtractionService(
  inspections,
  images,
  extractions,
  audit,
  ai,
  storage,
);

const app = buildApiApp({
  auth,
  inspections: inspectionService,
  regulatory: new RegulatoryService(rules, sources, proposals, versions, audit),
  reports: new ReportService(reports),
  findings,
  extractions,
  extractionService,
  audit,
  webOrigin: env.WEB_ORIGIN,
  loginLimiter: new LoginRateLimiter(),
});

await app.listen({ host: env.API_HOST, port: env.API_PORT });
