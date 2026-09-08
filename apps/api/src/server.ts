import { envFrom } from './env.js';
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

const env = envFrom();

const inspections = new MemoryInspectionRepository();
const audit = new MemoryAuditRepository();
const images = new MemoryImageRepository();
const findings = new MemoryFindingRepository();
const extractions = new MemoryExtractionRepository();
const rules = new MemoryRuleRepository();
const sources = new MemoryRegulatorySourceRepository();
const proposals = new MemoryRuleProposalRepository();
const reports = new MemoryReportRepository();

const app = buildApiApp({
  auth: new AuthService({
    async sign() {
      return 'dev-unsigned';
    },
  }),
  inspections: new InspectionService(inspections, audit),
  regulatory: new RegulatoryService(rules, sources, proposals),
  reports: new ReportService(reports),
  images,
  findings,
  extractions,
  webOrigin: env.WEB_ORIGIN,
});

await app.listen({ host: env.API_HOST, port: env.API_PORT });
