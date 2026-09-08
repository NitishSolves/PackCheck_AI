import type {
  InspectionStatus,
  Paginated,
  PaginationQuery,
  PublicUser,
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
  createdAt: string;
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
  list(query: PaginationQuery): Promise<Paginated<InspectionRecord>>;
  update(
    id: string,
    patch: Partial<Pick<InspectionRecord, 'referenceDate' | 'locationNote' | 'status'>>,
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
}

export interface FindingRepository {
  listByInspection(inspectionId: string): Promise<unknown[]>;
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
  listByInspection(inspectionId: string): Promise<unknown[]>;
}

export interface ExtractionRepository {
  listByInspection(inspectionId: string): Promise<unknown[]>;
}

export interface AuditRepository {
  record(input: {
    actorUserId?: string;
    action: string;
    entityType: string;
    entityId?: string;
    payload?: Record<string, unknown>;
  }): Promise<void>;
}

export type { UserRole };
