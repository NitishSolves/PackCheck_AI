import { and, count, desc, eq, isNull, sql } from 'drizzle-orm';
import {
  authSessions,
  auditLogs,
  extractedFields,
  findings,
  inspectionImages,
  inspections,
  regulatoryRules,
  regulatorySources,
  reports,
  ruleProposals,
  ruleVersions,
  users,
  type Database,
} from '@packcheck/db';
import type { InspectionStatus, Paginated, PaginationQuery } from '@packcheck/shared';
import { paginateOffset } from '@packcheck/shared';
import { notFound } from '../errors.js';
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

function asIso(value: Date | string | null | undefined): string | null {
  if (!value) {
    return null;
  }
  if (typeof value === 'string') {
    return value.slice(0, 10) === value ? value : new Date(value).toISOString();
  }
  return value.toISOString();
}

function asDate(value: Date | string): string {
  if (typeof value === 'string') {
    return value.slice(0, 10);
  }
  return value.toISOString().slice(0, 10);
}

function mapUser(row: typeof users.$inferSelect): UserRecord {
  return {
    id: row.id,
    email: row.email,
    displayName: row.displayName,
    role: row.role as UserRecord['role'],
    passwordHash: row.passwordHash,
    isActive: row.isActive,
  };
}

function mapInspection(row: typeof inspections.$inferSelect): InspectionRecord {
  return {
    id: row.id,
    createdByUserId: row.createdByUserId,
    status: row.status as InspectionStatus,
    referenceDate: asDate(row.referenceDate),
    locationNote: row.locationNote,
    overallOutcome: row.overallOutcome,
    finalizedAt: asIso(row.finalizedAt),
    createdAt: asIso(row.createdAt) ?? new Date().toISOString(),
    updatedAt: asIso(row.updatedAt) ?? new Date().toISOString(),
  };
}

function mapImage(row: typeof inspectionImages.$inferSelect): InspectionImageRecord {
  return {
    id: row.id,
    inspectionId: row.inspectionId,
    storageKey: row.storageKey,
    mimeType: row.mimeType,
    originalFilename: row.originalFilename,
    panelLabel: row.panelLabel,
    byteSize: row.byteSize,
    qualityStatus: row.qualityStatus,
    qualityScore: row.qualityScore,
    qualityIssues: row.qualityIssues ?? [],
    createdAt: asIso(row.createdAt) ?? new Date().toISOString(),
  };
}

export class PostgresUserRepository implements UserRepository {
  constructor(private readonly db: Database) {}

  async findByEmail(email: string): Promise<UserRecord | null> {
    const [row] = await this.db
      .select()
      .from(users)
      .where(sql`lower(${users.email}) = ${email.toLowerCase()}`)
      .limit(1);
    return row ? mapUser(row) : null;
  }

  async findById(id: string): Promise<UserRecord | null> {
    const [row] = await this.db.select().from(users).where(eq(users.id, id)).limit(1);
    return row ? mapUser(row) : null;
  }
}

export class PostgresSessionRepository implements SessionRepository {
  constructor(private readonly db: Database) {}

  async create(input: {
    id?: string;
    userId: string;
    tokenHash: string;
    expiresAt: Date;
  }): Promise<SessionRecord> {
    const [row] = await this.db
      .insert(authSessions)
      .values({
        ...(input.id ? { id: input.id } : {}),
        userId: input.userId,
        tokenHash: input.tokenHash,
        expiresAt: input.expiresAt,
      })
      .returning();
    if (!row) {
      throw new Error('Failed to create session');
    }
    return {
      id: row.id,
      userId: row.userId,
      tokenHash: row.tokenHash,
      expiresAt: row.expiresAt,
      revokedAt: row.revokedAt,
    };
  }

  async findById(id: string): Promise<SessionRecord | null> {
    const [row] = await this.db.select().from(authSessions).where(eq(authSessions.id, id)).limit(1);
    if (!row) {
      return null;
    }
    return {
      id: row.id,
      userId: row.userId,
      tokenHash: row.tokenHash,
      expiresAt: row.expiresAt,
      revokedAt: row.revokedAt,
    };
  }

  async findActiveByTokenHash(tokenHash: string): Promise<SessionRecord | null> {
    const [row] = await this.db
      .select()
      .from(authSessions)
      .where(and(eq(authSessions.tokenHash, tokenHash), isNull(authSessions.revokedAt)))
      .limit(1);
    if (!row || row.expiresAt.getTime() <= Date.now()) {
      return null;
    }
    return {
      id: row.id,
      userId: row.userId,
      tokenHash: row.tokenHash,
      expiresAt: row.expiresAt,
      revokedAt: row.revokedAt,
    };
  }

  async revoke(id: string): Promise<void> {
    await this.db
      .update(authSessions)
      .set({ revokedAt: new Date() })
      .where(eq(authSessions.id, id));
  }
}

export class PostgresInspectionRepository implements InspectionRepository {
  constructor(private readonly db: Database) {}

  async create(input: {
    createdByUserId: string;
    referenceDate: string;
    locationNote?: string;
  }): Promise<InspectionRecord> {
    const [row] = await this.db
      .insert(inspections)
      .values({
        createdByUserId: input.createdByUserId,
        referenceDate: input.referenceDate,
        locationNote: input.locationNote,
        status: 'draft',
      })
      .returning();
    if (!row) {
      throw new Error('Failed to create inspection');
    }
    return mapInspection(row);
  }

  async getById(id: string): Promise<InspectionRecord | null> {
    const [row] = await this.db.select().from(inspections).where(eq(inspections.id, id)).limit(1);
    return row ? mapInspection(row) : null;
  }

  async getDetail(id: string): Promise<InspectionDetail | null> {
    const inspection = await this.getById(id);
    if (!inspection) {
      return null;
    }
    const images = await this.db
      .select()
      .from(inspectionImages)
      .where(eq(inspectionImages.inspectionId, id));
    return { ...inspection, images: images.map(mapImage) };
  }

  async list(query: PaginationQuery): Promise<Paginated<InspectionRecord>> {
    const { limit, offset } = paginateOffset(query.page, query.pageSize);
    const [totalRow] = await this.db.select({ value: count() }).from(inspections);
    const rows = await this.db
      .select()
      .from(inspections)
      .orderBy(desc(inspections.createdAt))
      .limit(limit)
      .offset(offset);
    return {
      items: rows.map(mapInspection),
      page: query.page,
      pageSize: query.pageSize,
      total: Number(totalRow?.value ?? 0),
    };
  }

  async update(
    id: string,
    patch: Partial<Pick<InspectionRecord, 'referenceDate' | 'locationNote' | 'status'>>,
  ): Promise<InspectionRecord> {
    const values: Partial<typeof inspections.$inferInsert> = {
      updatedAt: new Date(),
    };
    if (patch.referenceDate !== undefined) {
      values.referenceDate = patch.referenceDate;
    }
    if (patch.locationNote !== undefined) {
      values.locationNote = patch.locationNote;
    }
    if (patch.status !== undefined) {
      values.status = patch.status;
      if (patch.status === 'finalized') {
        values.finalizedAt = new Date();
      }
    }
    const [row] = await this.db
      .update(inspections)
      .set(values)
      .where(eq(inspections.id, id))
      .returning();
    if (!row) {
      throw notFound('Inspection not found');
    }
    return mapInspection(row);
  }
}

export class PostgresImageRepository implements ImageRepository {
  constructor(private readonly db: Database) {}

  async create(input: {
    inspectionId: string;
    storageKey: string;
    mimeType: string;
    originalFilename: string;
    panelLabel?: string;
    byteSize?: number;
  }): Promise<InspectionImageRecord> {
    const [row] = await this.db
      .insert(inspectionImages)
      .values({
        inspectionId: input.inspectionId,
        storageKey: input.storageKey,
        mimeType: input.mimeType,
        originalFilename: input.originalFilename,
        panelLabel: input.panelLabel,
        byteSize: input.byteSize,
      })
      .returning();
    if (!row) {
      throw new Error('Failed to register image');
    }
    return mapImage(row);
  }

  async listByInspection(inspectionId: string): Promise<InspectionImageRecord[]> {
    const rows = await this.db
      .select()
      .from(inspectionImages)
      .where(eq(inspectionImages.inspectionId, inspectionId));
    return rows.map(mapImage);
  }
}

export class PostgresFindingRepository implements FindingRepository {
  constructor(private readonly db: Database) {}

  async listByInspection(inspectionId: string): Promise<unknown[]> {
    return this.db.select().from(findings).where(eq(findings.inspectionId, inspectionId));
  }
}

export class PostgresRuleRepository implements RuleRepository {
  constructor(private readonly db: Database) {}

  async listCatalog(): Promise<RuleCatalogRecord[]> {
    const rows = await this.db
      .select({
        id: regulatoryRules.id,
        ruleCode: regulatoryRules.ruleCode,
        title: regulatoryRules.title,
        ruleNumber: regulatoryRules.ruleNumber,
        clauseReference: regulatoryRules.clauseReference,
        latestVersionStatus: sql<string | null>`(
          SELECT rv.status FROM rule_versions rv
          WHERE rv.rule_id = ${regulatoryRules.id}
          ORDER BY rv.version_number DESC
          LIMIT 1
        )`,
      })
      .from(regulatoryRules)
      .orderBy(regulatoryRules.ruleCode);
    return rows.map((row) => ({
      ...row,
      latestVersionStatus: row.latestVersionStatus,
    }));
  }

  async getById(id: string): Promise<{ id: string; ruleCode: string } | null> {
    const [row] = await this.db
      .select({ id: regulatoryRules.id, ruleCode: regulatoryRules.ruleCode })
      .from(regulatoryRules)
      .where(eq(regulatoryRules.id, id))
      .limit(1);
    return row ?? null;
  }
}

export class PostgresRegulatorySourceRepository implements RegulatorySourceRepository {
  constructor(private readonly db: Database) {}

  async list(): Promise<RegulatorySourceRecord[]> {
    const rows = await this.db.select().from(regulatorySources);
    return rows.map((row) => ({
      id: row.id,
      title: row.title,
      sourceType: row.sourceType,
      issuingAuthority: row.issuingAuthority,
      officialUrl: row.officialUrl,
      documentHash: row.documentHash,
      publicationDate: row.publicationDate ? asDate(row.publicationDate) : null,
      effectiveDate: row.effectiveDate ? asDate(row.effectiveDate) : null,
      verificationStatus: row.verificationStatus,
      retrievedAt: asIso(row.retrievedAt),
    }));
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
    const [row] = await this.db
      .insert(regulatorySources)
      .values({
        title: input.title,
        sourceType: input.sourceType,
        issuingAuthority: input.issuingAuthority,
        officialUrl: input.officialUrl,
        documentHash: input.documentHash,
        publicationDate: input.publicationDate,
        effectiveDate: input.effectiveDate,
        verificationStatus: 'unverified',
      })
      .returning();
    if (!row) {
      throw new Error('Failed to create regulatory source');
    }
    return {
      id: row.id,
      title: row.title,
      sourceType: row.sourceType,
      issuingAuthority: row.issuingAuthority,
      officialUrl: row.officialUrl,
      documentHash: row.documentHash,
      publicationDate: row.publicationDate ? asDate(row.publicationDate) : null,
      effectiveDate: row.effectiveDate ? asDate(row.effectiveDate) : null,
      verificationStatus: row.verificationStatus,
      retrievedAt: asIso(row.retrievedAt),
    };
  }

  async getById(id: string): Promise<RegulatorySourceRecord | null> {
    const [row] = await this.db
      .select()
      .from(regulatorySources)
      .where(eq(regulatorySources.id, id))
      .limit(1);
    if (!row) {
      return null;
    }
    return {
      id: row.id,
      title: row.title,
      sourceType: row.sourceType,
      issuingAuthority: row.issuingAuthority,
      officialUrl: row.officialUrl,
      documentHash: row.documentHash,
      publicationDate: row.publicationDate ? asDate(row.publicationDate) : null,
      effectiveDate: row.effectiveDate ? asDate(row.effectiveDate) : null,
      verificationStatus: row.verificationStatus,
      retrievedAt: asIso(row.retrievedAt),
    };
  }
}

export class PostgresRuleVersionRepository implements RuleVersionRepository {
  constructor(private readonly db: Database) {}

  async listByRule(ruleId: string): Promise<RuleVersionRecord[]> {
    const rows = await this.db
      .select()
      .from(ruleVersions)
      .where(eq(ruleVersions.ruleId, ruleId))
      .orderBy(desc(ruleVersions.versionNumber));
    return rows.map((row) => ({
      id: row.id,
      ruleId: row.ruleId,
      versionNumber: row.versionNumber,
      sourceId: row.sourceId,
      clauseReference: row.clauseReference,
      requirementText: row.requirementText,
      status: row.status,
      effectiveFrom: asDate(row.effectiveFrom),
      effectiveTo: row.effectiveTo ? asDate(row.effectiveTo) : null,
    }));
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
    const [row] = await this.db
      .insert(ruleVersions)
      .values({
        ruleId: input.ruleId,
        sourceId: input.sourceId,
        versionNumber: input.versionNumber,
        clauseReference: input.clauseReference,
        requirementText: input.requirementText,
        applicability: input.applicability,
        conditions: input.conditions,
        exceptions: input.exceptions,
        validationType: input.validationType,
        validationConfig: input.validationConfig,
        severity: input.severity,
        effectiveFrom: input.effectiveFrom,
        effectiveTo: input.effectiveTo ?? null,
        status: 'draft',
      })
      .returning();
    if (!row) {
      throw new Error('Failed to create rule version');
    }
    return {
      id: row.id,
      ruleId: row.ruleId,
      versionNumber: row.versionNumber,
      sourceId: row.sourceId,
      clauseReference: row.clauseReference,
      requirementText: row.requirementText,
      status: row.status,
      effectiveFrom: asDate(row.effectiveFrom),
      effectiveTo: row.effectiveTo ? asDate(row.effectiveTo) : null,
    };
  }
}

export class PostgresRuleProposalRepository implements RuleProposalRepository {
  constructor(private readonly db: Database) {}

  async list(): Promise<RuleProposalRecord[]> {
    const rows = await this.db.select().from(ruleProposals);
    return rows.map((row) => ({
      id: row.id,
      sourceId: row.sourceId,
      ruleId: row.ruleId,
      proposedChange: (row.proposedChange ?? {}) as Record<string, unknown>,
      status: row.status,
    }));
  }

  async create(input: {
    sourceId: string;
    ruleId?: string;
    proposedChange: Record<string, unknown>;
    submittedByUserId: string;
  }): Promise<RuleProposalRecord> {
    const [row] = await this.db
      .insert(ruleProposals)
      .values({
        sourceId: input.sourceId,
        ruleId: input.ruleId,
        proposedChange: input.proposedChange,
        submittedByUserId: input.submittedByUserId,
        status: 'proposed',
      })
      .returning();
    if (!row) {
      throw new Error('Failed to create rule proposal');
    }
    return {
      id: row.id,
      sourceId: row.sourceId,
      ruleId: row.ruleId,
      proposedChange: (row.proposedChange ?? {}) as Record<string, unknown>,
      status: row.status,
    };
  }
}

export class PostgresReportRepository implements ReportRepository {
  constructor(private readonly db: Database) {}

  async listByInspection(inspectionId: string): Promise<unknown[]> {
    return this.db.select().from(reports).where(eq(reports.inspectionId, inspectionId));
  }
}

export class PostgresExtractionRepository implements ExtractionRepository {
  constructor(private readonly db: Database) {}

  async listByInspection(inspectionId: string): Promise<unknown[]> {
    return this.db
      .select()
      .from(extractedFields)
      .where(eq(extractedFields.inspectionId, inspectionId));
  }
}

export class PostgresAuditRepository implements AuditRepository {
  constructor(private readonly db: Database) {}

  async record(input: {
    actorUserId?: string;
    action: string;
    entityType: string;
    entityId?: string;
    payload?: Record<string, unknown>;
  }): Promise<void> {
    await this.db.insert(auditLogs).values({
      actorUserId: input.actorUserId,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      payload: input.payload ?? {},
    });
  }
}
