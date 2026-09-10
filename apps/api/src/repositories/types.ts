import type {
  BoundingBox,
  ExtractedField,
  FindingOutcome,
  ImageQualityResult,
  InspectionStatus,
  LayeredConfidence,
  OcrResult,
  PackageClassification,
  Paginated,
  PaginationQuery,
  PublicUser,
  ReviewDecision,
  ReviewerState,
  UserRole,
} from '@packcheck/shared';

export type UserRecord = PublicUser & {
  passwordHash: string;
  isActive: boolean;
};

export type SessionRecord = {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  revokedAt: Date | null;
};

export type InspectionRecord = {
  id: string;
  createdByUserId: string;
  status: InspectionStatus;
  referenceDate: string;
  locationNote: string | null;
  overallOutcome: string | null;
  finalizedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type InspectionImageRecord = {
  id: string;
  inspectionId: string;
  storageKey: string;
  mimeType: string;
  originalFilename: string;
  panelLabel: string | null;
  byteSize: number | null;
  qualityStatus: string;
  qualityScore: number | null;
  qualityIssues: string[];
  qualityMetrics: Record<string, unknown> | null;
  createdAt: string;
};

export type OcrResultRecord = {
  id: string;
  imageId: string;
  fullText: string;
  tokens: unknown;
  blocks: unknown;
  meanConfidence: number;
  provider: string;
  modelVersion: string | null;
  createdAt: string;
};

export type ExtractedFieldRecord = {
  id: string;
  inspectionId: string;
  imageId: string | null;
  fieldKey: string;
  rawValue: string | null;
  normalizedValue: string | null;
  confidence: number;
  panel: string | null;
  boundingBox: unknown;
  needsReview: boolean;
  parseNotes: string[];
  sourceOccurrenceId: string | null;
  createdAt: string;
};

export type PackageContextRecord = {
  id: string;
  inspectionId: string;
  context: Record<string, unknown>;
  unknownApplicability: boolean;
  confidence: number | null;
  provider: string | null;
  modelVersion: string | null;
  evidenceNotes: string[];
};

export type ExtractionRunRecord = {
  id: string;
  inspectionId: string;
  provider: string;
  modelVersion: string | null;
  confidence: LayeredConfidence;
  failedSafely: boolean;
  failureReason: string | null;
  createdAt: string;
};

export type InspectionExtractionSnapshot = {
  run: ExtractionRunRecord;
  fields: ExtractedFieldRecord[];
  ocr: OcrResultRecord[];
  packageContext: PackageContextRecord | null;
};

export type InspectionDetail = InspectionRecord & {
  images: InspectionImageRecord[];
};

export type RuleCatalogRecord = {
  id: string;
  ruleCode: string;
  title: string;
  ruleNumber: string | null;
  clauseReference: string | null;
  latestVersionStatus: string | null;
};

export type RegulatorySourceRecord = {
  id: string;
  title: string;
  sourceType: string;
  issuingAuthority: string;
  officialUrl: string;
  documentHash: string | null;
  publicationDate: string | null;
  effectiveDate: string | null;
  verificationStatus: string;
  retrievedAt: string | null;
};

export type RuleVersionRecord = {
  id: string;
  ruleId: string;
  versionNumber: number;
  sourceId: string;
  clauseReference: string | null;
  requirementText: string;
  status: string;
  effectiveFrom: string;
  effectiveTo: string | null;
};

export type RuleProposalRecord = {
  id: string;
  sourceId: string;
  ruleId: string | null;
  proposedChange: Record<string, unknown>;
  status: string;
};

export type FindingRecord = {
  id: string;
  inspectionId: string;
  ruleVersionId: string;
  outcome: FindingOutcome;
  engineDecision: string;
  detectedValue: string | null;
  expectedRequirement: string;
  explanation: string;
  reviewerState: ReviewerState;
  createdAt: string;
};

export type FindingEvidenceRecord = {
  id: string;
  findingId: string;
  imageId: string;
  boundingBox: BoundingBox | null;
  extractedFieldKey: string | null;
  ocrSnippet: string | null;
  cropStorageKey: string | null;
  createdAt: string;
};

export type ReviewActionRecord = {
  id: string;
  findingId: string;
  reviewerUserId: string;
  decision: ReviewDecision;
  note: string | null;
  editedOutcome: FindingOutcome | null;
  createdAt: string;
};

export type FindingRuleRecord = {
  id: string;
  ruleCode: string;
  title: string;
  ruleNumber: string | null;
  clauseReference: string | null;
};

export type FindingDetail = FindingRecord & {
  evidence: FindingEvidenceRecord[];
  reviews: ReviewActionRecord[];
  rule: FindingRuleRecord;
  ruleVersion: RuleVersionRecord;
  source: RegulatorySourceRecord;
};

export type ReportRecord = {
  id: string;
  inspectionId: string;
  storageKey: string;
  generatedByUserId: string | null;
  createdAt: string;
};

export type AuditLogRecord = {
  id: string;
  actorUserId: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  payload: Record<string, unknown>;
  createdAt: string;
};

export type InspectionListFilter = PaginationQuery & {
  status?: InspectionStatus;
  createdByUserId?: string;
  overallOutcome?: FindingOutcome;
  referenceDateFrom?: string;
  referenceDateTo?: string;
};

export type AuditListFilter = PaginationQuery & {
  actorUserId?: string;
  action?: string;
  entityType?: string;
  entityId?: string;
  inspectionId?: string;
};

export interface UserRepository {
  findByEmail(email: string): Promise<UserRecord | null>;
  findById(id: string): Promise<UserRecord | null>;
}

export interface SessionRepository {
  create(input: {
    id?: string;
    userId: string;
    tokenHash: string;
    expiresAt: Date;
  }): Promise<SessionRecord>;
  findById(id: string): Promise<SessionRecord | null>;
  findActiveByTokenHash(tokenHash: string): Promise<SessionRecord | null>;
  revoke(id: string): Promise<void>;
}

export interface InspectionRepository {
  create(input: {
    createdByUserId: string;
    referenceDate: string;
    locationNote?: string;
  }): Promise<InspectionRecord>;
  getById(id: string): Promise<InspectionRecord | null>;
  getDetail(id: string): Promise<InspectionDetail | null>;
  list(query: InspectionListFilter): Promise<Paginated<InspectionRecord>>;
  update(
    id: string,
    patch: Partial<
      Pick<
        InspectionRecord,
        'referenceDate' | 'locationNote' | 'status' | 'overallOutcome' | 'finalizedAt'
      >
    >,
  ): Promise<InspectionRecord>;
}

export interface ImageRepository {
  create(input: {
    inspectionId: string;
    storageKey: string;
    mimeType: string;
    originalFilename: string;
    panelLabel?: string;
    byteSize?: number;
  }): Promise<InspectionImageRecord>;
  listByInspection(inspectionId: string): Promise<InspectionImageRecord[]>;
  getById(id: string): Promise<InspectionImageRecord | null>;
  updateQuality?(
    imageId: string,
    quality: Pick<ImageQualityResult, 'status' | 'score' | 'issues'> & { metrics?: unknown },
  ): Promise<void>;
}

export type ActiveRuleVersionRecord = {
  id: string;
  ruleId: string;
  ruleCode: string;
  versionNumber: number;
  sourceId: string;
  clauseReference: string | null;
  requirementText: string;
  applicability: Record<string, unknown>;
  conditions: Record<string, unknown>;
  exceptions: Record<string, unknown>;
  validationType: string;
  validationConfig: Record<string, unknown>;
  severity: string;
  effectiveFrom: string;
  effectiveTo: string | null;
  status: string;
};

export interface FindingRepository {
  listByInspection(inspectionId: string): Promise<FindingDetail[]>;
  getDetail(id: string): Promise<FindingDetail | null>;
  saveInspectionFindings?(
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
        boundingBox: BoundingBox | null;
        extractedFieldKey: string | null;
        ocrSnippet: string | null;
        cropStorageKey?: string | null;
      }>;
    }>,
  ): Promise<FindingDetail[]>;
  applyReview(input: {
    findingId: string;
    reviewerUserId: string;
    decision: ReviewDecision;
    note?: string;
    editedOutcome?: FindingOutcome;
    reviewerState: ReviewerState;
    outcome: FindingOutcome;
  }): Promise<{ finding: FindingRecord; review: ReviewActionRecord }>;
}

export interface RuleRepository {
  listCatalog(): Promise<RuleCatalogRecord[]>;
  getById(id: string): Promise<{ id: string; ruleCode: string } | null>;
}

export interface RegulatorySourceRepository {
  list(): Promise<RegulatorySourceRecord[]>;
  create(input: {
    title: string;
    sourceType: string;
    issuingAuthority: string;
    officialUrl: string;
    documentHash?: string;
    publicationDate?: string;
    effectiveDate?: string;
  }): Promise<RegulatorySourceRecord>;
  getById(id: string): Promise<RegulatorySourceRecord | null>;
}

export interface RuleVersionRepository {
  listByRule(ruleId: string): Promise<RuleVersionRecord[]>;
  listActiveVersions?(referenceDate?: string): Promise<ActiveRuleVersionRecord[]>;
  create(input: {
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
  }): Promise<RuleVersionRecord>;
}

export interface RuleProposalRepository {
  list(): Promise<RuleProposalRecord[]>;
  create(input: {
    sourceId: string;
    ruleId?: string;
    proposedChange: Record<string, unknown>;
    submittedByUserId: string;
  }): Promise<RuleProposalRecord>;
}

export interface ReportRepository {
  listByInspection(inspectionId: string): Promise<ReportRecord[]>;
  create(input: {
    inspectionId: string;
    storageKey: string;
    generatedByUserId: string;
  }): Promise<ReportRecord>;
  getById(id: string): Promise<ReportRecord | null>;
}

export interface ExtractionRepository {
  listByInspection(inspectionId: string): Promise<unknown[]>;
  saveInspectionExtraction?(input: {
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
  }): Promise<InspectionExtractionSnapshot>;
  getSnapshot?(inspectionId: string): Promise<InspectionExtractionSnapshot | null>;
}

export interface AuditRepository {
  record(input: {
    actorUserId?: string;
    action: string;
    entityType: string;
    entityId?: string;
    payload?: Record<string, unknown>;
  }): Promise<void>;
  list(filter: AuditListFilter): Promise<Paginated<AuditLogRecord>>;
}

export type { UserRole };
