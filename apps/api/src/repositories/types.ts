export type InspectionRecord = {
  id: string;
  createdByUserId: string;
  status: string;
  referenceDate: string;
  locationNote: string | null;
  overallOutcome: string | null;
};

export interface InspectionRepository {
  create(input: {
    createdByUserId: string;
    referenceDate: string;
    locationNote?: string;
  }): Promise<InspectionRecord>;
  getById(id: string): Promise<InspectionRecord | null>;
  list(): Promise<InspectionRecord[]>;
}

export interface ImageRepository {
  create(input: {
    inspectionId: string;
    storageKey: string;
    mimeType: string;
    originalFilename: string;
    panelLabel?: string;
  }): Promise<{ id: string }>;
}

export interface FindingRepository {
  listByInspection(inspectionId: string): Promise<unknown[]>;
}

export interface RuleRepository {
  listCatalog(): Promise<{ ruleCode: string; title: string; status: string }[]>;
}

export interface RegulatorySourceRepository {
  list(): Promise<{ id: string; title: string; verificationStatus: string }[]>;
}

export interface RuleProposalRepository {
  list(): Promise<unknown[]>;
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
