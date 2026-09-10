import { and, count, desc, eq, gte, inArray, isNull, lte, or, sql } from 'drizzle-orm';
import {
  authSessions,
  auditLogs,
  extractedFields,
  findingEvidence,
  findings,
  inspectionExtractionRuns,
  inspectionImages,
  inspections,
  ocrResults,
  packageContexts,
  regulatoryRules,
  regulatorySources,
  reports,
  reviewActions,
  ruleProposals,
  ruleVersions,
  users,
  type Database,
} from '@packcheck/db';
import type {
  ExtractedField,
  FindingOutcome,
  ImageQualityResult,
  InspectionStatus,
  LayeredConfidence,
  OcrResult,
  PackageClassification,
  Paginated,
  ReviewDecision,
  ReviewerState,
} from '@packcheck/shared';
import { paginateOffset, parseBoundingBox } from '@packcheck/shared';
import { notFound } from '../errors.js';
import type {
  ActiveRuleVersionRecord,
  AuditListFilter,
  AuditLogRecord,
  AuditRepository,
  ExtractedFieldRecord,
  ExtractionRepository,
  ExtractionRunRecord,
  FindingDetail,
  FindingEvidenceRecord,
  FindingRecord,
  FindingRepository,
  FindingRuleRecord,
  ImageRepository,
  InspectionDetail,
  InspectionExtractionSnapshot,
  InspectionImageRecord,
  InspectionListFilter,
  InspectionRecord,
  InspectionRepository,
  OcrResultRecord,
  PackageContextRecord,
  RegulatorySourceRecord,
  RegulatorySourceRepository,
  ReportRecord,
  ReportRepository,
  ReviewActionRecord,
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
    qualityMetrics: (row.qualityMetrics as Record<string, unknown> | null) ?? null,
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

  async list(query: InspectionListFilter): Promise<Paginated<InspectionRecord>> {
    const { limit, offset } = paginateOffset(query.page, query.pageSize);
    const clauses = [];
    if (query.status) {
      clauses.push(eq(inspections.status, query.status));
    }
    if (query.createdByUserId) {
      clauses.push(eq(inspections.createdByUserId, query.createdByUserId));
    }
    if (query.overallOutcome) {
      clauses.push(eq(inspections.overallOutcome, query.overallOutcome));
    }
    if (query.referenceDateFrom) {
      clauses.push(gte(inspections.referenceDate, query.referenceDateFrom));
    }
    if (query.referenceDateTo) {
      clauses.push(lte(inspections.referenceDate, query.referenceDateTo));
    }
    const where = clauses.length > 0 ? and(...clauses) : undefined;
    const [totalRow] = await this.db.select({ value: count() }).from(inspections).where(where);
    const rows = await this.db
      .select()
      .from(inspections)
      .where(where)
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
    patch: Partial<
      Pick<
        InspectionRecord,
        'referenceDate' | 'locationNote' | 'status' | 'overallOutcome' | 'finalizedAt'
      >
    >,
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
    if (patch.overallOutcome !== undefined) {
      values.overallOutcome = patch.overallOutcome;
    }
    if (patch.finalizedAt !== undefined) {
      values.finalizedAt = patch.finalizedAt ? new Date(patch.finalizedAt) : null;
    }
    if (patch.status !== undefined) {
      values.status = patch.status;
      if (patch.status === 'finalized' && patch.finalizedAt === undefined) {
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

  async getById(id: string): Promise<InspectionImageRecord | null> {
    const [row] = await this.db
      .select()
      .from(inspectionImages)
      .where(eq(inspectionImages.id, id))
      .limit(1);
    return row ? mapImage(row) : null;
  }

  async updateQuality(
    imageId: string,
    quality: Pick<ImageQualityResult, 'status' | 'score' | 'issues'> & { metrics?: unknown },
  ): Promise<void> {
    await this.db
      .update(inspectionImages)
      .set({
        qualityStatus: quality.status,
        qualityScore: quality.score,
        qualityIssues: quality.issues,
        qualityMetrics: quality.metrics ?? null,
      })
      .where(eq(inspectionImages.id, imageId));
  }
}

function mapFinding(row: typeof findings.$inferSelect): FindingRecord {
  return {
    id: row.id,
    inspectionId: row.inspectionId,
    ruleVersionId: row.ruleVersionId,
    outcome: row.outcome as FindingOutcome,
    engineDecision: row.engineDecision,
    detectedValue: row.detectedValue,
    expectedRequirement: row.expectedRequirement,
    explanation: row.explanation,
    reviewerState: row.reviewerState as ReviewerState,
    createdAt: asIso(row.createdAt) ?? new Date().toISOString(),
  };
}

function mapEvidence(row: typeof findingEvidence.$inferSelect): FindingEvidenceRecord {
  return {
    id: row.id,
    findingId: row.findingId,
    imageId: row.imageId,
    boundingBox: parseBoundingBox(row.boundingBox),
    extractedFieldKey: row.extractedFieldKey,
    ocrSnippet: row.ocrSnippet,
    cropStorageKey: row.cropStorageKey,
    createdAt: asIso(row.createdAt) ?? new Date().toISOString(),
  };
}

function mapReview(row: typeof reviewActions.$inferSelect): ReviewActionRecord {
  return {
    id: row.id,
    findingId: row.findingId,
    reviewerUserId: row.reviewerUserId,
    decision: row.decision as ReviewDecision,
    note: row.note,
    editedOutcome: (row.editedOutcome as FindingOutcome | null) ?? null,
    createdAt: asIso(row.createdAt) ?? new Date().toISOString(),
  };
}

function mapFindingRule(row: typeof regulatoryRules.$inferSelect): FindingRuleRecord {
  return {
    id: row.id,
    ruleCode: row.ruleCode,
    title: row.title,
    ruleNumber: row.ruleNumber,
    clauseReference: row.clauseReference,
  };
}

function mapFindingRuleVersion(row: typeof ruleVersions.$inferSelect): RuleVersionRecord {
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

function mapFindingSource(row: typeof regulatorySources.$inferSelect): RegulatorySourceRecord {
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

function mapReport(row: typeof reports.$inferSelect): ReportRecord {
  return {
    id: row.id,
    inspectionId: row.inspectionId,
    storageKey: row.storageKey,
    generatedByUserId: row.generatedByUserId,
    createdAt: asIso(row.createdAt) ?? new Date().toISOString(),
  };
}

function mapAudit(row: typeof auditLogs.$inferSelect): AuditLogRecord {
  return {
    id: row.id,
    actorUserId: row.actorUserId,
    action: row.action,
    entityType: row.entityType,
    entityId: row.entityId,
    payload: (row.payload ?? {}) as Record<string, unknown>,
    createdAt: asIso(row.createdAt) ?? new Date().toISOString(),
  };
}

export class PostgresFindingRepository implements FindingRepository {
  constructor(private readonly db: Database) {}

  async listByInspection(inspectionId: string): Promise<FindingDetail[]> {
    const rows = await this.db
      .select()
      .from(findings)
      .where(eq(findings.inspectionId, inspectionId))
      .orderBy(desc(findings.createdAt));
    return this.hydrate(rows);
  }

  async getDetail(id: string): Promise<FindingDetail | null> {
    const rows = await this.db.select().from(findings).where(eq(findings.id, id)).limit(1);
    if (!rows[0]) {
      return null;
    }
    const [detail] = await this.hydrate(rows);
    return detail ?? null;
  }

  async saveInspectionFindings(
    inspectionId: string,
    items: Array<{
      ruleVersionId: string;
      outcome: FindingOutcome;
      engineDecision: string;
      detectedValue: string | null;
      expectedRequirement: string;
      explanation: string;
      reviewerState?: ReviewerState;
      evidence: Array<{
        imageId: string;
        boundingBox: any;
        extractedFieldKey: string | null;
        ocrSnippet: string | null;
        cropStorageKey?: string | null;
      }>;
    }>,
  ): Promise<FindingDetail[]> {
    return this.db.transaction(async (tx) => {
      const existing = await tx.select({ id: findings.id }).from(findings).where(eq(findings.inspectionId, inspectionId));
      if (existing.length > 0) {
        const existingIds = existing.map((r) => r.id);
        await tx.delete(findingEvidence).where(inArray(findingEvidence.findingId, existingIds));
        await tx.delete(reviewActions).where(inArray(reviewActions.findingId, existingIds));
        await tx.delete(findings).where(eq(findings.inspectionId, inspectionId));
      }

      if (items.length === 0) {
        return [];
      }

      for (const item of items) {
        const [insertedFinding] = await tx
          .insert(findings)
          .values({
            inspectionId,
            ruleVersionId: item.ruleVersionId,
            outcome: item.outcome,
            engineDecision: item.engineDecision,
            detectedValue: item.detectedValue,
            expectedRequirement: item.expectedRequirement,
            explanation: item.explanation,
            reviewerState: item.reviewerState ?? 'pending',
          })
          .returning();

        if (insertedFinding && item.evidence.length > 0) {
          for (const ev of item.evidence) {
            await tx.insert(findingEvidence).values({
              findingId: insertedFinding.id,
              imageId: ev.imageId,
              boundingBox: ev.boundingBox,
              extractedFieldKey: ev.extractedFieldKey,
              ocrSnippet: ev.ocrSnippet,
              cropStorageKey: ev.cropStorageKey ?? null,
            });
          }
        }
      }

      const rows = await tx
        .select()
        .from(findings)
        .where(eq(findings.inspectionId, inspectionId))
        .orderBy(desc(findings.createdAt));
      return this.hydrate(rows);
    });
  }

  async applyReview(input: {
    findingId: string;
    reviewerUserId: string;
    decision: ReviewDecision;
    note?: string;
    editedOutcome?: FindingOutcome;
    reviewerState: ReviewerState;
    outcome: FindingOutcome;
  }): Promise<{ finding: FindingRecord; review: ReviewActionRecord }> {
    return this.db.transaction(async (tx) => {
      const [reviewRow] = await tx
        .insert(reviewActions)
        .values({
          findingId: input.findingId,
          reviewerUserId: input.reviewerUserId,
          decision: input.decision,
          note: input.note,
          editedOutcome: input.editedOutcome,
        })
        .returning();
      if (!reviewRow) {
        throw new Error('Failed to record review action');
      }
      const [findingRow] = await tx
        .update(findings)
        .set({
          reviewerState: input.reviewerState,
          outcome: input.outcome,
        })
        .where(eq(findings.id, input.findingId))
        .returning();
      if (!findingRow) {
        throw new Error('Finding not found');
      }
      return { finding: mapFinding(findingRow), review: mapReview(reviewRow) };
    });
  }

  private async hydrate(rows: (typeof findings.$inferSelect)[]): Promise<FindingDetail[]> {
    if (rows.length === 0) {
      return [];
    }
    const findingIds = rows.map((row) => row.id);
    const versionIds = [...new Set(rows.map((row) => row.ruleVersionId))];
    const [evidenceRows, reviewRows, versionRows] = await Promise.all([
      this.db
        .select()
        .from(findingEvidence)
        .where(inArray(findingEvidence.findingId, findingIds))
        .orderBy(findingEvidence.createdAt),
      this.db
        .select()
        .from(reviewActions)
        .where(inArray(reviewActions.findingId, findingIds))
        .orderBy(reviewActions.createdAt),
      this.db.select().from(ruleVersions).where(inArray(ruleVersions.id, versionIds)),
    ]);
    const ruleIds = [...new Set(versionRows.map((row) => row.ruleId))];
    const sourceIds = [...new Set(versionRows.map((row) => row.sourceId))];
    const [ruleRows, sourceRows] = await Promise.all([
      ruleIds.length > 0
        ? this.db.select().from(regulatoryRules).where(inArray(regulatoryRules.id, ruleIds))
        : Promise.resolve([]),
      sourceIds.length > 0
        ? this.db.select().from(regulatorySources).where(inArray(regulatorySources.id, sourceIds))
        : Promise.resolve([]),
    ]);
    const versionsById = new Map(versionRows.map((row) => [row.id, mapFindingRuleVersion(row)]));
    const rulesById = new Map(ruleRows.map((row) => [row.id, mapFindingRule(row)]));
    const sourcesById = new Map(sourceRows.map((row) => [row.id, mapFindingSource(row)]));
    const evidenceByFinding = new Map<string, FindingEvidenceRecord[]>();
    for (const row of evidenceRows) {
      const list = evidenceByFinding.get(row.findingId) ?? [];
      list.push(mapEvidence(row));
      evidenceByFinding.set(row.findingId, list);
    }
    const reviewsByFinding = new Map<string, ReviewActionRecord[]>();
    for (const row of reviewRows) {
      const list = reviewsByFinding.get(row.findingId) ?? [];
      list.push(mapReview(row));
      reviewsByFinding.set(row.findingId, list);
    }
    return rows.map((row) => {
      const ruleVersion = versionsById.get(row.ruleVersionId);
      if (!ruleVersion) {
        throw new Error(`Missing rule version ${row.ruleVersionId} for finding ${row.id}`);
      }
      const rule = rulesById.get(ruleVersion.ruleId);
      if (!rule) {
        throw new Error(`Missing rule ${ruleVersion.ruleId} for finding ${row.id}`);
      }
      const source = sourcesById.get(ruleVersion.sourceId);
      if (!source) {
        throw new Error(`Missing source ${ruleVersion.sourceId} for finding ${row.id}`);
      }
      return {
        ...mapFinding(row),
        evidence: evidenceByFinding.get(row.id) ?? [],
        reviews: reviewsByFinding.get(row.id) ?? [],
        rule,
        ruleVersion,
        source,
      };
    });
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

  async listActiveVersions(referenceDate?: string): Promise<ActiveRuleVersionRecord[]> {
    const rows = await this.db
      .select({
        id: ruleVersions.id,
        ruleId: ruleVersions.ruleId,
        ruleCode: regulatoryRules.ruleCode,
        versionNumber: ruleVersions.versionNumber,
        sourceId: ruleVersions.sourceId,
        clauseReference: ruleVersions.clauseReference,
        requirementText: ruleVersions.requirementText,
        applicability: ruleVersions.applicability,
        conditions: ruleVersions.conditions,
        exceptions: ruleVersions.exceptions,
        validationType: ruleVersions.validationType,
        validationConfig: ruleVersions.validationConfig,
        severity: ruleVersions.severity,
        effectiveFrom: ruleVersions.effectiveFrom,
        effectiveTo: ruleVersions.effectiveTo,
        status: ruleVersions.status,
      })
      .from(ruleVersions)
      .innerJoin(regulatoryRules, eq(ruleVersions.ruleId, regulatoryRules.id))
      .where(eq(ruleVersions.status, 'active'));

    return rows.map((r) => ({
      id: r.id,
      ruleId: r.ruleId,
      ruleCode: r.ruleCode,
      versionNumber: r.versionNumber,
      sourceId: r.sourceId,
      clauseReference: r.clauseReference,
      requirementText: r.requirementText,
      applicability: (r.applicability as Record<string, unknown>) ?? {},
      conditions: (r.conditions as Record<string, unknown>) ?? {},
      exceptions: (r.exceptions as Record<string, unknown>) ?? {},
      validationType: r.validationType,
      validationConfig: (r.validationConfig as Record<string, unknown>) ?? {},
      severity: r.severity,
      effectiveFrom: asDate(r.effectiveFrom),
      effectiveTo: r.effectiveTo ? asDate(r.effectiveTo) : null,
      status: r.status,
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

  async listByInspection(inspectionId: string): Promise<ReportRecord[]> {
    const rows = await this.db
      .select()
      .from(reports)
      .where(eq(reports.inspectionId, inspectionId))
      .orderBy(desc(reports.createdAt));
    return rows.map(mapReport);
  }

  async create(input: {
    inspectionId: string;
    storageKey: string;
    generatedByUserId: string;
  }): Promise<ReportRecord> {
    const [row] = await this.db
      .insert(reports)
      .values({
        inspectionId: input.inspectionId,
        storageKey: input.storageKey,
        generatedByUserId: input.generatedByUserId,
      })
      .returning();
    if (!row) {
      throw new Error('Failed to create report');
    }
    return mapReport(row);
  }

  async getById(id: string): Promise<ReportRecord | null> {
    const [row] = await this.db.select().from(reports).where(eq(reports.id, id)).limit(1);
    return row ? mapReport(row) : null;
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

  async saveInspectionExtraction(input: {
    inspectionId: string;
    provider: string;
    modelVersion: string | null;
    confidence: LayeredConfidence;
    failedSafely: boolean;
    failureReason: string | null;
    fields: ExtractedField[];
    ocrByImageId: Array<{ imageId: string; ocr: OcrResult }>;
    qualityByImageId: Array<{ imageId: string; quality: ImageQualityResult }>;
    packageClassification: PackageClassification;
  }): Promise<InspectionExtractionSnapshot> {
    for (const entry of input.qualityByImageId) {
      await this.db
        .update(inspectionImages)
        .set({
          qualityStatus: entry.quality.status,
          qualityScore: entry.quality.score,
          qualityIssues: entry.quality.issues,
          qualityMetrics: entry.quality.metrics ?? null,
        })
        .where(eq(inspectionImages.id, entry.imageId));
    }

    const [runRow] = await this.db
      .insert(inspectionExtractionRuns)
      .values({
        inspectionId: input.inspectionId,
        provider: input.provider,
        modelVersion: input.modelVersion,
        confidence: input.confidence,
        failedSafely: input.failedSafely,
        failureReason: input.failureReason,
      })
      .returning();
    if (!runRow) {
      throw new Error('Failed to persist extraction run');
    }

    const ocrRows =
      input.ocrByImageId.length === 0
        ? []
        : await this.db
            .insert(ocrResults)
            .values(
              input.ocrByImageId.map((entry) => ({
                imageId: entry.imageId,
                fullText: entry.ocr.fullText,
                tokens: entry.ocr.tokens,
                blocks: entry.ocr.blocks ?? [],
                meanConfidence: entry.ocr.meanConfidence,
                provider: entry.ocr.provider,
                modelVersion: entry.ocr.modelVersion,
              })),
            )
            .returning();

    const fieldRows =
      input.fields.length === 0
        ? []
        : await this.db
            .insert(extractedFields)
            .values(
              input.fields.map((field) => ({
                inspectionId: input.inspectionId,
                imageId: field.imageId,
                fieldKey: field.fieldKey,
                rawValue: field.rawValue,
                normalizedValue: field.normalizedValue,
                confidence: field.confidence,
                panel: field.panel,
                boundingBox: field.box,
                needsReview: field.needsReview,
                parseNotes: field.parseNotes ?? [],
                sourceOccurrenceId: field.sourceOccurrenceId,
              })),
            )
            .returning();

    await this.db
      .insert(packageContexts)
      .values({
        inspectionId: input.inspectionId,
        context: input.packageClassification.suggestedContext,
        unknownApplicability: input.packageClassification.unknownApplicability,
        confidence: input.packageClassification.confidence,
        provider: input.packageClassification.provider,
        modelVersion: input.packageClassification.modelVersion,
        evidenceNotes: input.packageClassification.evidenceNotes ?? [],
      })
      .onConflictDoUpdate({
        target: packageContexts.inspectionId,
        set: {
          context: input.packageClassification.suggestedContext,
          unknownApplicability: input.packageClassification.unknownApplicability,
          confidence: input.packageClassification.confidence,
          provider: input.packageClassification.provider,
          modelVersion: input.packageClassification.modelVersion,
          evidenceNotes: input.packageClassification.evidenceNotes ?? [],
        },
      });

    const [contextRow] = await this.db
      .select()
      .from(packageContexts)
      .where(eq(packageContexts.inspectionId, input.inspectionId))
      .limit(1);

    return {
      run: mapRun(runRow),
      fields: fieldRows.map(mapField),
      ocr: ocrRows.map(mapOcr),
      packageContext: contextRow ? mapContext(contextRow) : null,
    };
  }

  async getSnapshot(inspectionId: string): Promise<InspectionExtractionSnapshot | null> {
    const [runRow] = await this.db
      .select()
      .from(inspectionExtractionRuns)
      .where(eq(inspectionExtractionRuns.inspectionId, inspectionId))
      .orderBy(desc(inspectionExtractionRuns.createdAt))
      .limit(1);
    if (!runRow) {
      return null;
    }
    const fieldRows = await this.db
      .select()
      .from(extractedFields)
      .where(eq(extractedFields.inspectionId, inspectionId));
    const imageRows = await this.db
      .select({ id: inspectionImages.id })
      .from(inspectionImages)
      .where(eq(inspectionImages.inspectionId, inspectionId));
    const imageIds = imageRows.map((row) => row.id);
    const ocrRows =
      imageIds.length === 0
        ? []
        : await this.db.select().from(ocrResults).where(inArray(ocrResults.imageId, imageIds));
    const [contextRow] = await this.db
      .select()
      .from(packageContexts)
      .where(eq(packageContexts.inspectionId, inspectionId))
      .limit(1);
    return {
      run: mapRun(runRow),
      fields: fieldRows.map(mapField),
      ocr: ocrRows.map(mapOcr),
      packageContext: contextRow ? mapContext(contextRow) : null,
    };
  }
}

function mapRun(row: typeof inspectionExtractionRuns.$inferSelect): ExtractionRunRecord {
  return {
    id: row.id,
    inspectionId: row.inspectionId,
    provider: row.provider,
    modelVersion: row.modelVersion,
    confidence: row.confidence as LayeredConfidence,
    failedSafely: row.failedSafely,
    failureReason: row.failureReason,
    createdAt: asIso(row.createdAt) ?? new Date().toISOString(),
  };
}

function mapField(row: typeof extractedFields.$inferSelect): ExtractedFieldRecord {
  return {
    id: row.id,
    inspectionId: row.inspectionId,
    imageId: row.imageId,
    fieldKey: row.fieldKey,
    rawValue: row.rawValue,
    normalizedValue: row.normalizedValue,
    confidence: row.confidence,
    panel: row.panel,
    boundingBox: row.boundingBox,
    needsReview: row.needsReview,
    parseNotes: row.parseNotes ?? [],
    sourceOccurrenceId: row.sourceOccurrenceId,
    createdAt: asIso(row.createdAt) ?? new Date().toISOString(),
  };
}

function mapOcr(row: typeof ocrResults.$inferSelect): OcrResultRecord {
  return {
    id: row.id,
    imageId: row.imageId,
    fullText: row.fullText,
    tokens: row.tokens,
    blocks: row.blocks,
    meanConfidence: row.meanConfidence,
    provider: row.provider,
    modelVersion: row.modelVersion,
    createdAt: asIso(row.createdAt) ?? new Date().toISOString(),
  };
}

function mapContext(row: typeof packageContexts.$inferSelect): PackageContextRecord {
  return {
    id: row.id,
    inspectionId: row.inspectionId,
    context: (row.context ?? {}) as Record<string, unknown>,
    unknownApplicability: row.unknownApplicability,
    confidence: row.confidence,
    provider: row.provider,
    modelVersion: row.modelVersion,
    evidenceNotes: row.evidenceNotes ?? [],
  };
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

  async list(filter: AuditListFilter): Promise<Paginated<AuditLogRecord>> {
    const { limit, offset } = paginateOffset(filter.page, filter.pageSize);
    const clauses = [];
    if (filter.actorUserId) {
      clauses.push(eq(auditLogs.actorUserId, filter.actorUserId));
    }
    if (filter.action) {
      clauses.push(eq(auditLogs.action, filter.action));
    }
    if (filter.entityType) {
      clauses.push(eq(auditLogs.entityType, filter.entityType));
    }
    if (filter.entityId) {
      clauses.push(eq(auditLogs.entityId, filter.entityId));
    }
    if (filter.inspectionId) {
      clauses.push(
        or(
          and(eq(auditLogs.entityType, 'inspection'), eq(auditLogs.entityId, filter.inspectionId)),
          sql`${auditLogs.payload} ->> 'inspectionId' = ${filter.inspectionId}`,
        ),
      );
    }
    const where = clauses.length > 0 ? and(...clauses) : undefined;
    const [totalRow] = await this.db.select({ value: count() }).from(auditLogs).where(where);
    const rows = await this.db
      .select()
      .from(auditLogs)
      .where(where)
      .orderBy(desc(auditLogs.createdAt))
      .limit(limit)
      .offset(offset);
    return {
      items: rows.map(mapAudit),
      page: filter.page,
      pageSize: filter.pageSize,
      total: Number(totalRow?.value ?? 0),
    };
  }
}
