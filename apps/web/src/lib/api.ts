const API_BASE = (import.meta as any).env?.VITE_API_URL || '';

export type User = {
  id: string;
  email: string;
  displayName: string;
  role: 'inspector' | 'reviewer' | 'administrator';
};

export type Inspection = {
  id: string;
  createdByUserId: string;
  status: string;
  referenceDate: string;
  locationNote: string | null;
  overallOutcome: 'PASS' | 'POTENTIAL_NON_COMPLIANCE' | 'NEEDS_VERIFICATION' | 'NOT_APPLICABLE' | null;
  finalizedAt: string | null;
  createdAt: string;
  updatedAt: string;
  images?: InspectionImage[];
};

export type InspectionImage = {
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

export type ExtractedField = {
  id?: string;
  fieldKey: string;
  rawValue: string | null;
  normalizedValue: string | null;
  confidence: number;
  panel: string | null;
  boundingBox?: { x: number; y: number; width: number; height: number } | null;
  needsReview: boolean;
  parseNotes: string[];
};

export type ExtractionSnapshot = {
  run: any;
  fields: ExtractedField[];
  ocr: Array<{ imageId: string; fullText: string; tokens: any[]; blocks: any[]; meanConfidence: number }>;
  packageContext: { context?: Record<string, any>; unknownApplicability?: boolean } | null;
};

export type FindingEvidence = {
  id: string;
  findingId: string;
  imageId: string;
  boundingBox: { x: number; y: number; width: number; height: number } | null;
  extractedFieldKey: string | null;
  ocrSnippet: string | null;
  cropStorageKey: string | null;
};

export type FindingReview = {
  id: string;
  reviewerUserId: string;
  decision: 'confirm' | 'reject' | 'edit';
  note: string | null;
  editedOutcome: string | null;
  createdAt: string;
};

export type Finding = {
  id: string;
  inspectionId: string;
  ruleVersionId: string;
  outcome: 'PASS' | 'POTENTIAL_NON_COMPLIANCE' | 'NEEDS_VERIFICATION' | 'NOT_APPLICABLE';
  engineDecision: string;
  detectedValue: string | null;
  expectedRequirement: string;
  explanation: string;
  reviewerState: 'pending' | 'confirmed' | 'rejected' | 'edited';
  createdAt: string;
  evidence: FindingEvidence[];
  reviews: FindingReview[];
  rule?: {
    id: string;
    ruleCode: string;
    title: string;
    clauseReference: string | null;
  };
  ruleVersion?: {
    id: string;
    versionNumber: number;
    clauseReference: string | null;
    requirementText: string;
    severity: string;
    status: string;
  };
  source?: {
    id: string;
    title: string;
    officialUrl: string;
    issuingAuthority: string;
  };
};

export type RegulatoryRule = {
  id: string;
  ruleCode: string;
  title: string;
  ruleNumber: string | null;
  clauseReference: string | null;
  latestVersionStatus: string | null;
};

function getAuthToken(): string | null {
  return localStorage.getItem('packcheck_token');
}

export function setAuthToken(token: string) {
  localStorage.setItem('packcheck_token', token);
}

export function clearAuthToken() {
  localStorage.removeItem('packcheck_token');
  localStorage.removeItem('packcheck_user');
}

export function getStoredUser(): User | null {
  const raw = localStorage.getItem('packcheck_user');
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function setStoredUser(user: User) {
  localStorage.setItem('packcheck_user', JSON.stringify(user));
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getAuthToken();
  const headers = new Headers(options.headers || {});
  
  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  if (!(options.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const url = path.startsWith('http') ? path : `${API_BASE}${path}`;
  const res = await fetch(url, { ...options, credentials: 'omit', headers });

  if (!res.ok) {
    let msg = `HTTP error ${res.status}`;
    try {
      const err = await res.json();
      msg = err.message || err.error?.message || msg;
    } catch {}
    throw new Error(msg);
  }

  return res.json() as Promise<T>;
}

// Authentication API
export async function apiLogin(email: string, password: string): Promise<{ token: string; user: User }> {
  const data = await request<{ token: string; user: User }>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  setAuthToken(data.token);
  setStoredUser(data.user);
  return data;
}

export async function apiGetMe(): Promise<User> {
  const user = await request<User>('/api/auth/me');
  setStoredUser(user);
  return user;
}

export async function apiLogout(): Promise<void> {
  try {
    await request('/api/auth/logout', { method: 'POST' });
  } finally {
    clearAuthToken();
  }
}

// Inspection API
export async function apiListInspections(params: { page?: number; pageSize?: number; status?: string } = {}): Promise<{ items: Inspection[]; total: number }> {
  const query = new URLSearchParams();
  if (params.page) query.set('page', String(params.page));
  if (params.pageSize) query.set('pageSize', String(params.pageSize));
  if (params.status && params.status !== 'ALL') query.set('status', params.status);
  
  return request<{ items: Inspection[]; total: number }>(`/api/inspections?${query.toString()}`);
}

export async function apiGetInspection(id: string): Promise<Inspection & { images: InspectionImage[] }> {
  return request<Inspection & { images: InspectionImage[] }>(`/api/inspections/${id}`);
}

export async function apiCreateInspection(input: { referenceDate: string; locationNote?: string }): Promise<Inspection> {
  return request<Inspection>('/api/inspections', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function apiUploadImage(inspectionId: string, file: File, panelLabel?: string): Promise<InspectionImage> {
  const formData = new FormData();
  formData.append('file', file);
  if (panelLabel) formData.append('panelLabel', panelLabel);

  return request<InspectionImage>(`/api/inspections/${inspectionId}/upload`, {
    method: 'POST',
    body: formData,
  });
}

export async function apiRegisterImage(inspectionId: string, input: { storageKey: string; mimeType: string; originalFilename: string; panelLabel?: string }): Promise<InspectionImage> {
  return request<InspectionImage>(`/api/inspections/${inspectionId}/images`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function apiRunExtraction(inspectionId: string): Promise<any> {
  return request<any>(`/api/inspections/${inspectionId}/extract`, {
    method: 'POST',
  });
}

export async function apiGetExtractions(inspectionId: string): Promise<ExtractionSnapshot> {
  return request<ExtractionSnapshot>(`/api/inspections/${inspectionId}/extractions`);
}

export async function apiGetFindings(inspectionId: string): Promise<Finding[]> {
  return request<Finding[]>(`/api/inspections/${inspectionId}/findings`);
}

export async function apiReviewFinding(
  findingId: string,
  input: { decision: 'confirm' | 'reject' | 'edit'; note?: string; editedOutcome?: string },
): Promise<{ finding: any; review: any }> {
  return request<{ finding: any; review: any }>(`/api/findings/${findingId}/review`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function apiGenerateReport(inspectionId: string): Promise<{ id: string; storageKey: string }> {
  return request<{ id: string; storageKey: string }>(`/api/inspections/${inspectionId}/reports`, {
    method: 'POST',
  });
}

export function apiGetReportDownloadUrl(reportId: string): string {
  const token = getAuthToken();
  return `${API_BASE}/api/reports/${reportId}/download?token=${token || ''}`;
}

export function apiGetImageOriginalUrl(imageId: string): string {
  return `${API_BASE}/api/images/${imageId}/original`;
}

// Regulatory Rules API
export async function apiListRules(): Promise<{ items: RegulatoryRule[] }> {
  return request<{ items: RegulatoryRule[] }>('/api/regulatory/rules');
}
