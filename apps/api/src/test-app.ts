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
import { HmacJwtSigner, durationToMs } from './plugins/jwt-signer.js';
import { LoginRateLimiter } from './security/login-rate-limit.js';
import type { UserRecord } from './repositories/types.js';

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
  const auth = new AuthService(
    userRepo,
    sessions,
    new HmacJwtSigner('test-jwt-secret-key-32', durationToMs('8h')),
    '8h',
  );

  const app = buildApiApp({
    auth,
    inspections: new InspectionService(inspections, images, audit),
    regulatory: new RegulatoryService(rules, sources, proposals, versions, audit),
    reports: new ReportService(reports),
    findings,
    extractions,
    audit,
    webOrigin: 'http://localhost:5173',
    loginLimiter: new LoginRateLimiter(5, 60_000),
  });

  return { app, audit, users: seeded };
}
