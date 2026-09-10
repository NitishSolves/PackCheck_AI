import { hashPassword, type UserRole } from '@packcheck/shared';
import { buildApiApp } from './app.js';
import {
  MemoryAuditRepository,
  MemoryExtractionRepository,
  MemoryFindingRepository,
  MemoryImageRepository,
  MemoryInspectionRepository,
  MemoryRegulatorySourceRepository,
  MemoryReportRepository,
  MemoryRuleProposalRepository,
  MemoryRuleRepository,
  MemoryRuleVersionRepository,
  MemorySessionRepository,
  MemoryUserRepository,
} from './repositories/memory.js';
import { AuthService } from './services/auth-service.js';
import { InspectionService } from './services/inspection-service.js';
import { RegulatoryService } from './services/regulatory-service.js';
import { ReportService } from './services/report-service.js';
import { FindingService } from './services/finding-service.js';
import { AuditService } from './services/audit-service.js';
import { ExtractionService } from './services/extraction-service.js';
import { HttpAiClient } from './services/ai-client.js';
import { HmacJwtSigner, durationToMs } from './plugins/jwt-signer.js';
import { LoginRateLimiter } from './security/login-rate-limit.js';
import type { UserRecord } from './repositories/types.js';
import { LocalObjectStorage } from './storage/object-storage.js';
import os from 'node:os';
import path from 'node:path';

export const TEST_PASSWORD = 'PackCheckInspector!dev';

export async function createTestUser(overrides: Partial<UserRecord> = {}): Promise<UserRecord> {
  return {
    id: overrides.id ?? 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    email: overrides.email ?? 'inspector@packcheck.local',
    displayName: overrides.displayName ?? 'Inspector',
    role: (overrides.role ?? 'inspector') as UserRole,
    passwordHash: overrides.passwordHash ?? (await hashPassword(TEST_PASSWORD)),
    isActive: overrides.isActive ?? true,
  };
}

export async function createTestApp(users: UserRecord[] = []) {
  const seeded = users.length > 0 ? users : [await createTestUser()];
  const userRepo = new MemoryUserRepository(seeded);
  const sessions = new MemorySessionRepository();
  const inspections = new MemoryInspectionRepository();
  const images = new MemoryImageRepository();
  const audit = new MemoryAuditRepository();
  const findings = new MemoryFindingRepository();
  const extractions = new MemoryExtractionRepository();
  const rules = new MemoryRuleRepository();
  const sources = new MemoryRegulatorySourceRepository();
  const proposals = new MemoryRuleProposalRepository();
  const versions = new MemoryRuleVersionRepository();
  const reports = new MemoryReportRepository();
  const storage = new LocalObjectStorage(path.join(os.tmpdir(), 'packcheck-test-uploads'));
  const auth = new AuthService(
    userRepo,
    sessions,
    new HmacJwtSigner('test-jwt-secret-key-32', durationToMs('8h')),
    '8h',
  );
  const extractionService = new ExtractionService(
    inspections,
    images,
    extractions,
    audit,
    new HttpAiClient(process.env.AI_SERVICE_URL ?? 'http://127.0.0.1:9'),
    storage,
  );
  const findingService = new FindingService(findings, inspections, images, audit, storage);
  const reportService = new ReportService(
    reports,
    inspections,
    findings,
    extractions,
    images,
    audit,
    storage,
  );

  const app = buildApiApp({
    auth,
    inspections: new InspectionService(inspections, images, audit, storage, findings),
    regulatory: new RegulatoryService(rules, sources, proposals, versions, audit),
    reports: reportService,
    findings: findingService,
    extractions,
    extractionService,
    audit,
    auditService: new AuditService(audit),
    webOrigin: 'http://localhost:5173',
    loginLimiter: new LoginRateLimiter(5, 60_000),
  });

  return {
    app,
    audit,
    users: seeded,
    inspections,
    images,
    extractions,
    extractionService,
    findings,
    reports,
    storage,
  };
}
