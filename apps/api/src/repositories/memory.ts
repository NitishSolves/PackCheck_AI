import { randomUUID } from 'node:crypto';
import {
  P0_RULE_CODES,
  P0_RULE_TITLES,
  type InspectionStatus,
  type Paginated,
  type PaginationQuery,
} from '@packcheck/shared';
import type {
  AuditRepository,
  ExtractionRepository,
  FindingRepository,
  ImageRepository,
  InspectionDetail,
  InspectionImageRecord,
  InspectionRecord,
  InspectionRepository,
  RegulatorySourceRecord,
  RegulatorySourceRepository,
  ReportRepository,
  RuleCatalogRecord,
  RuleProposalRecord,
  RuleProposalRepository,
  RuleRepository,
  RuleVersionRecord,
  RuleVersionRepository,
  SessionRecord,
  SessionRepository,
  UserRecord,
  UserRepository,
} from './types.js';

function isoNow(): string {
  return new Date().toISOString();
}

export class MemoryUserRepository implements UserRepository {
  constructor(private readonly users: UserRecord[] = []) {}

  async findByEmail(email: string): Promise<UserRecord | null> {
    return this.users.find((user) => user.email.toLowerCase() === email.toLowerCase()) ?? null;
  }

  async findById(id: string): Promise<UserRecord | null> {
    return this.users.find((user) => user.id === id) ?? null;
  }
}

export class MemorySessionRepository implements SessionRepository {
  private readonly rows = new Map<string, SessionRecord>();

  async create(input: {
    id?: string;
    userId: string;
    tokenHash: string;
    expiresAt: Date;
  }): Promise<SessionRecord> {
    const record: SessionRecord = {
      id: input.id ?? randomUUID(),
      userId: input.userId,
      tokenHash: input.tokenHash,
      expiresAt: input.expiresAt,
      revokedAt: null,
    };
    this.rows.set(record.id, record);
    return record;
  }

  async findById(id: string): Promise<SessionRecord | null> {
    return this.rows.get(id) ?? null;
  }

  async findActiveByTokenHash(tokenHash: string): Promise<SessionRecord | null> {
    const record = [...this.rows.values()].find((row) => row.tokenHash === tokenHash);
    if (!record || record.revokedAt) {
      return null;
    }
    if (record.expiresAt.getTime() <= Date.now()) {
      return null;
    }
    return record;
  }

  async revoke(id: string): Promise<void> {
    const record = this.rows.get(id);
    if (record) {
      record.revokedAt = new Date();
    }
  }
}

export class MemoryInspectionRepository implements InspectionRepository {
  private readonly rows = new Map<string, InspectionRecord>();
  private readonly images = new Map<string, InspectionImageRecord[]>();

  attachImages(images: Map<string, InspectionImageRecord[]>): void {
    this.images.clear();
    for (const [key, value] of images) {
      this.images.set(key, value);
    }
  }

  async create(input: {
    createdByUserId: string;
    referenceDate: string;
    locationNote?: string;
  }): Promise<InspectionRecord> {
    const now = isoNow();
    const record: InspectionRecord = {
      id: randomUUID(),
      createdByUserId: input.createdByUserId,
      status: 'draft',
      referenceDate: input.referenceDate,
      locationNote: input.locationNote ?? null,
      overallOutcome: null,
      finalizedAt: null,
      createdAt: now,
      updatedAt: now,
    };
    this.rows.set(record.id, record);
    return record;
  }

  async getById(id: string): Promise<InspectionRecord | null> {
    return this.rows.get(id) ?? null;
  }

  async getDetail(id: string): Promise<InspectionDetail | null> {
    const inspection = this.rows.get(id);
    if (!inspection) {
      return null;
    }
    return { ...inspection, images: this.images.get(id) ?? [] };
  }

  async list(query: PaginationQuery): Promise<Paginated<InspectionRecord>> {
    const all = [...this.rows.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const start = (query.page - 1) * query.pageSize;
    return {
      items: all.slice(start, start + query.pageSize),
      page: query.page,
      pageSize: query.pageSize,
      total: all.length,
    };
  }

  async update(
    id: string,
    patch: Partial<Pick<InspectionRecord, 'referenceDate' | 'locationNote' | 'status'>>,
  ): Promise<InspectionRecord> {
    const existing = this.rows.get(id);
    if (!existing) {
      throw new Error('Inspection not found');
    }
    const next: InspectionRecord = {
      ...existing,
      ...patch,
      status: (patch.status ?? existing.status) as InspectionStatus,
      updatedAt: isoNow(),
      finalizedAt: patch.status === 'finalized' ? isoNow() : existing.finalizedAt,
    };
    this.rows.set(id, next);
    return next;
  }
}

export class MemoryImageRepository implements ImageRepository {
  readonly rows = new Map<string, InspectionImageRecord[]>();

  async create(input: {
    inspectionId: string;
    storageKey: string;
    mimeType: string;
    originalFilename: string;
    panelLabel?: string;
    byteSize?: number;
  }): Promise<InspectionImageRecord> {
    const record: InspectionImageRecord = {
      id: randomUUID(),
      inspectionId: input.inspectionId,
      storageKey: input.storageKey,
      mimeType: input.mimeType,
      originalFilename: input.originalFilename,
      panelLabel: input.panelLabel ?? null,
      byteSize: input.byteSize ?? null,
      qualityStatus: 'pending',
      qualityScore: null,
      qualityIssues: [],
      createdAt: isoNow(),
    };
    const list = this.rows.get(input.inspectionId) ?? [];
    list.push(record);
    this.rows.set(input.inspectionId, list);
    return record;
  }

  async listByInspection(inspectionId: string): Promise<InspectionImageRecord[]> {
    return this.rows.get(inspectionId) ?? [];
  }
}

export class MemoryFindingRepository implements FindingRepository {
  async listByInspection(): Promise<unknown[]> {
    return [];
  }
}

export class MemoryRuleRepository implements RuleRepository {
  async listCatalog(): Promise<RuleCatalogRecord[]> {
    return P0_RULE_CODES.map((ruleCode, index) => ({
      id: `00000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
      ruleCode,
      title: P0_RULE_TITLES[ruleCode],
      ruleNumber: null,
      clauseReference: null,
      latestVersionStatus: null,
    }));
  }

  async getById(id: string): Promise<{ id: string; ruleCode: string } | null> {
    const catalog = await this.listCatalog();
    const match = catalog.find((rule) => rule.id === id);
    return match ? { id: match.id, ruleCode: match.ruleCode } : null;
  }
}

export class MemoryRegulatorySourceRepository implements RegulatorySourceRepository {
  private readonly rows: RegulatorySourceRecord[] = [];

  async list(): Promise<RegulatorySourceRecord[]> {
    return [...this.rows];
  }

  async create(input: {
    title: string;
    sourceType: string;
    issuingAuthority: string;
    officialUrl: string;
    documentHash?: string;
    publicationDate?: string;
    effectiveDate?: string;
  }): Promise<RegulatorySourceRecord> {
    const record: RegulatorySourceRecord = {
      id: randomUUID(),
      title: input.title,
      sourceType: input.sourceType,
      issuingAuthority: input.issuingAuthority,
      officialUrl: input.officialUrl,
      documentHash: input.documentHash ?? null,
      publicationDate: input.publicationDate ?? null,
      effectiveDate: input.effectiveDate ?? null,
      verificationStatus: 'unverified',
      retrievedAt: null,
    };
    this.rows.push(record);
    return record;
  }

  async getById(id: string): Promise<RegulatorySourceRecord | null> {
    return this.rows.find((row) => row.id === id) ?? null;
  }
}

export class MemoryRuleVersionRepository implements RuleVersionRepository {
  private readonly rows: RuleVersionRecord[] = [];

  async listByRule(ruleId: string): Promise<RuleVersionRecord[]> {
    return this.rows.filter((row) => row.ruleId === ruleId);
  }

  async create(input: {
    ruleId: string;
    sourceId: string;
    versionNumber: number;
    clauseReference?: string;
    requirementText: string;
    applicability: Record<string, unknown>;
    conditions: Record<string, unknown>;
    exceptions: Record<string, unknown>;
    validationType: string;
    validationConfig: Record<string, unknown>;
    severity: string;
    effectiveFrom: string;
    effectiveTo?: string | null;
  }): Promise<RuleVersionRecord> {
    const record: RuleVersionRecord = {
      id: randomUUID(),
      ruleId: input.ruleId,
      versionNumber: input.versionNumber,
      sourceId: input.sourceId,
      clauseReference: input.clauseReference ?? null,
      requirementText: input.requirementText,
      status: 'draft',
      effectiveFrom: input.effectiveFrom,
      effectiveTo: input.effectiveTo ?? null,
    };
    this.rows.push(record);
    return record;
  }
}

export class MemoryRuleProposalRepository implements RuleProposalRepository {
  private readonly rows: RuleProposalRecord[] = [];

  async list(): Promise<RuleProposalRecord[]> {
    return [...this.rows];
  }

  async create(input: {
    sourceId: string;
    ruleId?: string;
    proposedChange: Record<string, unknown>;
    submittedByUserId: string;
  }): Promise<RuleProposalRecord> {
    const record: RuleProposalRecord = {
      id: randomUUID(),
      sourceId: input.sourceId,
      ruleId: input.ruleId ?? null,
      proposedChange: input.proposedChange,
      status: 'proposed',
    };
    this.rows.push(record);
    return record;
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
