import { afterAll, describe, expect, it } from 'vitest';
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
} from './repositories/memory.js';
import { AuthService } from './services/auth-service.js';
import { InspectionService } from './services/inspection-service.js';
import { RegulatoryService } from './services/regulatory-service.js';
import { ReportService } from './services/report-service.js';

const inspections = new MemoryInspectionRepository();
const audit = new MemoryAuditRepository();

const app = buildApiApp({
  auth: new AuthService({ async sign() { return 'test'; } }),
  inspections: new InspectionService(inspections, audit),
  regulatory: new RegulatoryService(
    new MemoryRuleRepository(),
    new MemoryRegulatorySourceRepository(),
    new MemoryRuleProposalRepository(),
  ),
  reports: new ReportService(new MemoryReportRepository()),
  images: new MemoryImageRepository(),
  findings: new MemoryFindingRepository(),
  extractions: new MemoryExtractionRepository(),
  webOrigin: 'http://localhost:5173',
});

afterAll(async () => {
  await app.close();
});

describe('API foundation', () => {
  it('exposes health', async () => {
    const response = await app.inject({ method: 'GET', url: '/health' });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ status: 'ok' });
  });

  it('lists unverified P0 rule catalog without activating rules', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/rules' });
    const body = response.json() as { ruleCode: string; status: string }[];
    expect(response.statusCode).toBe(200);
    expect(body.length).toBe(15);
    expect(body.every((rule) => rule.status === 'unverified')).toBe(true);
  });

  it('creates an inspection', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/inspections',
      payload: {
        createdByUserId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        referenceDate: '2026-01-15',
      },
    });
    expect(response.statusCode).toBe(201);
    expect(response.json()).toMatchObject({ status: 'draft' });
  });
});
