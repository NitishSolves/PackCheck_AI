import { randomUUID } from 'node:crypto';
import { P0_RULE_CODES, P0_RULE_TITLES } from '@packcheck/shared';
import type {
  AuditRepository,
  ExtractionRepository,
  FindingRepository,
  ImageRepository,
  InspectionRecord,
  InspectionRepository,
  RegulatorySourceRepository,
  ReportRepository,
  RuleProposalRepository,
  RuleRepository,
} from './types.js';

export class MemoryInspectionRepository implements InspectionRepository {
  private readonly rows = new Map<string, InspectionRecord>();

  async create(input: {
    createdByUserId: string;
    referenceDate: string;
    locationNote?: string;
  }): Promise<InspectionRecord> {
    const record: InspectionRecord = {
      id: randomUUID(),
      createdByUserId: input.createdByUserId,
      status: 'draft',
      referenceDate: input.referenceDate,
      locationNote: input.locationNote ?? null,
      overallOutcome: null,
    };
    this.rows.set(record.id, record);
    return record;
  }

  async getById(id: string): Promise<InspectionRecord | null> {
    return this.rows.get(id) ?? null;
  }

  async list(): Promise<InspectionRecord[]> {
    return [...this.rows.values()];
  }
}

export class MemoryImageRepository implements ImageRepository {
  async create(): Promise<{ id: string }> {
    return { id: randomUUID() };
  }
}

export class MemoryFindingRepository implements FindingRepository {
  async listByInspection(): Promise<unknown[]> {
    return [];
  }
}

export class MemoryRuleRepository implements RuleRepository {
  async listCatalog() {
    return P0_RULE_CODES.map((ruleCode) => ({
      ruleCode,
      title: P0_RULE_TITLES[ruleCode],
      status: 'unverified',
    }));
  }
}

export class MemoryRegulatorySourceRepository implements RegulatorySourceRepository {
  async list() {
    return [];
  }
}

export class MemoryRuleProposalRepository implements RuleProposalRepository {
  async list(): Promise<unknown[]> {
    return [];
  }
}

export class MemoryReportRepository implements ReportRepository {
  async listByInspection(): Promise<unknown[]> {
    return [];
  }
}

export class MemoryExtractionRepository implements ExtractionRepository {
  async listByInspection(): Promise<unknown[]> {
    return [];
  }
}

export class MemoryAuditRepository implements AuditRepository {
  readonly events: Record<string, unknown>[] = [];

  async record(input: {
    actorUserId?: string;
    action: string;
    entityType: string;
    entityId?: string;
    payload?: Record<string, unknown>;
  }): Promise<void> {
    this.events.push(input);
  }
}
