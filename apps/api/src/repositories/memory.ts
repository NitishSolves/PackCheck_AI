import { randomUUID } from 'node:crypto';
import {
  P0_RULE_CODES,
  P0_RULE_TITLES,
  type ExtractedField,
  type FindingOutcome,
  type ImageQualityResult,
  type InspectionStatus,
  type LayeredConfidence,
  type OcrResult,
  type PackageClassification,
  type Paginated,
  type ReviewDecision,
  type ReviewerState,
} from '@packcheck/shared';
import type {
  AuditListFilter,
  AuditLogRecord,
  AuditRepository,
  ExtractedFieldRecord,
  ExtractionRepository,
  ExtractionRunRecord,
  FindingDetail,
  FindingRecord,
  FindingRepository,
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

  async list(query: InspectionListFilter): Promise<Paginated<InspectionRecord>> {
    let all = [...this.rows.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    if (query.status) {
      all = all.filter((row) => row.status === query.status);
    }
    if (query.createdByUserId) {
      all = all.filter((row) => row.createdByUserId === query.createdByUserId);
    }
    if (query.overallOutcome) {
      all = all.filter((row) => row.overallOutcome === query.overallOutcome);
    }
    if (query.referenceDateFrom) {
      all = all.filter((row) => row.referenceDate >= query.referenceDateFrom!);
    }
    if (query.referenceDateTo) {
      all = all.filter((row) => row.referenceDate <= query.referenceDateTo!);
    }
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
    patch: Partial<
      Pick<
        InspectionRecord,
        'referenceDate' | 'locationNote' | 'status' | 'overallOutcome' | 'finalizedAt'
      >
    >,
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
      finalizedAt:
        patch.finalizedAt !== undefined
          ? patch.finalizedAt
          : patch.status === 'finalized'
            ? isoNow()
            : existing.finalizedAt,
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
      qualityMetrics: null,
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

  async getById(id: string): Promise<InspectionImageRecord | null> {
    for (const list of this.rows.values()) {
      const match = list.find((row) => row.id === id);
      if (match) {
        return match;
      }
    }
    return null;
  }

  async updateQuality(
    imageId: string,
    quality: Pick<ImageQualityResult, 'status' | 'score' | 'issues'> & { metrics?: unknown },
  ): Promise<void> {
    for (const list of this.rows.values()) {
      const match = list.find((row) => row.id === imageId);
      if (match) {
        match.qualityStatus = quality.status;
        match.qualityScore = quality.score;
        match.qualityIssues = quality.issues;
        match.qualityMetrics = (quality.metrics as Record<string, unknown> | null) ?? null;
      }
    }
  }
}

export class MemoryFindingRepository implements FindingRepository {
  readonly findings: FindingDetail[] = [];

  async listByInspection(inspectionId: string): Promise<FindingDetail[]> {
    return this.findings.filter((finding) => finding.inspectionId === inspectionId);
  }

  async getDetail(id: string): Promise<FindingDetail | null> {
    return this.findings.find((finding) => finding.id === id) ?? null;
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
    // Remove existing
    for (let i = this.findings.length - 1; i >= 0; i--) {
      if (this.findings[i]?.inspectionId === inspectionId) {
        this.findings.splice(i, 1);
      }
    }

    const created: FindingDetail[] = [];
    for (const item of items) {
      const findingId = randomUUID();
      const finding: FindingDetail = {
        id: findingId,
        inspectionId,
        ruleVersionId: item.ruleVersionId,
        outcome: item.outcome,
        engineDecision: item.engineDecision,
        detectedValue: item.detectedValue,
        expectedRequirement: item.expectedRequirement,
        explanation: item.explanation,
        reviewerState: item.reviewerState ?? 'pending',
        createdAt: isoNow(),
        evidence: item.evidence.map((ev) => ({
          id: randomUUID(),
          findingId,
          imageId: ev.imageId,
          boundingBox: ev.boundingBox,
          extractedFieldKey: ev.extractedFieldKey,
          ocrSnippet: ev.ocrSnippet,
          cropStorageKey: ev.cropStorageKey ?? null,
          createdAt: isoNow(),
        })),
        reviews: [],
        rule: {
          id: randomUUID(),
          ruleCode: 'R01',
          title: 'Mandatory Declaration',
          ruleNumber: null,
          clauseReference: null,
        },
        ruleVersion: {
          id: item.ruleVersionId,
          ruleId: randomUUID(),
          versionNumber: 1,
          sourceId: randomUUID(),
          clauseReference: 'Rule 6(1)',
          requirementText: item.expectedRequirement,
          status: 'active',
          effectiveFrom: '2011-04-01',
          effectiveTo: null,
        },
        source: {
          id: randomUUID(),
          title: 'LMPC Rules 2011',
          sourceType: 'rules',
          issuingAuthority: 'DCA',
          officialUrl: 'https://consumeraffairs.nic.in',
          documentHash: null,
          publicationDate: null,
          effectiveDate: '2011-04-01',
          verificationStatus: 'verified',
          retrievedAt: null,
        },
      };
      this.findings.push(finding);
      created.push(finding);
    }
    return created;
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
    const finding = this.findings.find((row) => row.id === input.findingId);
    if (!finding) {
      throw new Error('Finding not found');
    }
    const review: ReviewActionRecord = {
      id: randomUUID(),
      findingId: input.findingId,
      reviewerUserId: input.reviewerUserId,
      decision: input.decision,
      note: input.note ?? null,
      editedOutcome: input.editedOutcome ?? null,
      createdAt: isoNow(),
    };
    finding.reviewerState = input.reviewerState;
    finding.outcome = input.outcome;
    finding.reviews.push(review);
    return { finding, review };
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

  async listActiveVersions(referenceDate?: string): Promise<any[]> {
    return this.rows
      .filter((row) => row.status === 'active')
      .map((row) => ({
        id: row.id,
        ruleId: row.ruleId,
        ruleCode: 'R01',
        versionNumber: row.versionNumber,
        sourceId: row.sourceId,
        clauseReference: row.clauseReference,
        requirementText: row.requirementText,
        applicability: {},
        conditions: {},
        exceptions: {},
        validationType: 'FIELD_REQUIRED',
        validationConfig: { fieldKey: 'manufacturer' },
        severity: 'high',
        effectiveFrom: row.effectiveFrom,
        effectiveTo: row.effectiveTo,
        status: row.status,
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
  readonly rows: ReportRecord[] = [];

  async listByInspection(inspectionId: string): Promise<ReportRecord[]> {
    return this.rows.filter((row) => row.inspectionId === inspectionId);
  }

  async create(input: {
    inspectionId: string;
    storageKey: string;
    generatedByUserId: string;
  }): Promise<ReportRecord> {
    const record: ReportRecord = {
      id: randomUUID(),
      inspectionId: input.inspectionId,
      storageKey: input.storageKey,
      generatedByUserId: input.generatedByUserId,
      createdAt: isoNow(),
    };
    this.rows.push(record);
    return record;
  }

  async getById(id: string): Promise<ReportRecord | null> {
    return this.rows.find((row) => row.id === id) ?? null;
  }
}

export class MemoryExtractionRepository implements ExtractionRepository {
  readonly fields = new Map<string, ExtractedFieldRecord[]>();
  readonly ocr = new Map<string, OcrResultRecord[]>();
  readonly runs = new Map<string, ExtractionRunRecord>();
  readonly contexts = new Map<string, PackageContextRecord>();

  async listByInspection(inspectionId: string): Promise<unknown[]> {
    return this.fields.get(inspectionId) ?? [];
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
    void input.qualityByImageId;
    const now = isoNow();
    const run: ExtractionRunRecord = {
      id: randomUUID(),
      inspectionId: input.inspectionId,
      provider: input.provider,
      modelVersion: input.modelVersion,
      confidence: input.confidence,
      failedSafely: input.failedSafely,
      failureReason: input.failureReason,
      createdAt: now,
    };
    this.runs.set(input.inspectionId, run);

    const existingFields = this.fields.get(input.inspectionId) ?? [];
    const savedFields: ExtractedFieldRecord[] = input.fields.map((field) => ({
      id: randomUUID(),
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
      sourceOccurrenceId: field.sourceOccurrenceId ?? null,
      createdAt: now,
    }));
    this.fields.set(input.inspectionId, [...existingFields, ...savedFields]);

    const ocrRows: OcrResultRecord[] = input.ocrByImageId.map((entry) => ({
      id: randomUUID(),
      imageId: entry.imageId,
      fullText: entry.ocr.fullText,
      tokens: entry.ocr.tokens,
      blocks: entry.ocr.blocks ?? [],
      meanConfidence: entry.ocr.meanConfidence,
      provider: entry.ocr.provider,
      modelVersion: entry.ocr.modelVersion,
      createdAt: now,
    }));
    const existingOcr = this.ocr.get(input.inspectionId) ?? [];
    this.ocr.set(input.inspectionId, [...existingOcr, ...ocrRows]);

    const packageContext: PackageContextRecord = {
      id: randomUUID(),
      inspectionId: input.inspectionId,
      context: input.packageClassification.suggestedContext,
      unknownApplicability: input.packageClassification.unknownApplicability,
      confidence: input.packageClassification.confidence,
      provider: input.packageClassification.provider,
      modelVersion: input.packageClassification.modelVersion,
      evidenceNotes: input.packageClassification.evidenceNotes ?? [],
    };
    this.contexts.set(input.inspectionId, packageContext);

    return {
      run,
      fields: this.fields.get(input.inspectionId) ?? [],
      ocr: this.ocr.get(input.inspectionId) ?? [],
      packageContext,
    };
  }

  async getSnapshot(inspectionId: string): Promise<InspectionExtractionSnapshot | null> {
    const run = this.runs.get(inspectionId);
    if (!run) {
      return null;
    }
    return {
      run,
      fields: this.fields.get(inspectionId) ?? [],
      ocr: this.ocr.get(inspectionId) ?? [],
      packageContext: this.contexts.get(inspectionId) ?? null,
    };
  }
}

export class MemoryAuditRepository implements AuditRepository {
  readonly events: AuditLogRecord[] = [];

  async record(input: {
    actorUserId?: string;
    action: string;
    entityType: string;
    entityId?: string;
    payload?: Record<string, unknown>;
  }): Promise<void> {
    this.events.push({
      id: randomUUID(),
      actorUserId: input.actorUserId ?? null,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId ?? null,
      payload: input.payload ?? {},
      createdAt: isoNow(),
    });
  }

  async list(filter: AuditListFilter): Promise<Paginated<AuditLogRecord>> {
    let all = [...this.events].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    if (filter.actorUserId) {
      all = all.filter((row) => row.actorUserId === filter.actorUserId);
    }
    if (filter.action) {
      all = all.filter((row) => row.action === filter.action);
    }
    if (filter.entityType) {
      all = all.filter((row) => row.entityType === filter.entityType);
    }
    if (filter.entityId) {
      all = all.filter((row) => row.entityId === filter.entityId);
    }
    if (filter.inspectionId) {
      all = all.filter(
        (row) =>
          (row.entityType === 'inspection' && row.entityId === filter.inspectionId) ||
          row.payload.inspectionId === filter.inspectionId,
      );
    }
    const start = (filter.page - 1) * filter.pageSize;
    return {
      items: all.slice(start, start + filter.pageSize),
      page: filter.page,
      pageSize: filter.pageSize,
      total: all.length,
    };
  }
}
