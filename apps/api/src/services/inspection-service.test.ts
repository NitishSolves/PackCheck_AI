import { describe, expect, it } from 'vitest';
import { AppError } from '../errors.js';
import {
  MemoryAuditRepository,
  MemoryFindingRepository,
  MemoryImageRepository,
  MemoryInspectionRepository,
} from '../repositories/memory.js';
import type { FindingDetail } from '../repositories/types.js';
import { InspectionService } from './inspection-service.js';

const inspector = {
  id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  email: 'inspector@packcheck.local',
  displayName: 'Inspector',
  role: 'inspector' as const,
};

const reviewer = {
  id: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
  email: 'reviewer@packcheck.local',
  displayName: 'Reviewer',
  role: 'reviewer' as const,
};

const administrator = {
  id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
  email: 'admin@packcheck.local',
  displayName: 'Admin',
  role: 'administrator' as const,
};

function finding(inspectionId: string, overrides: Partial<FindingDetail> = {}): FindingDetail {
  return {
    id: 'dddddddd-dddd-dddd-dddd-dddddddddddd',
    inspectionId,
    ruleVersionId: 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
    outcome: 'POTENTIAL_NON_COMPLIANCE',
    engineDecision: 'ISSUE',
    detectedValue: 'missing net quantity',
    expectedRequirement: 'Synthetic test requirement only.',
    explanation: 'Potential non-compliance detected. Needs verification.',
    reviewerState: 'confirmed',
    createdAt: new Date().toISOString(),
    evidence: [
      {
        id: 'ffffffff-ffff-ffff-ffff-ffffffffffff',
        findingId: 'dddddddd-dddd-dddd-dddd-dddddddddddd',
        imageId: '99999999-9999-9999-9999-999999999999',
        boundingBox: { x: 0.1, y: 0.2, width: 0.3, height: 0.1 },
        extractedFieldKey: 'net_quantity',
        ocrSnippet: 'NET 0 g',
        cropStorageKey: null,
        createdAt: new Date().toISOString(),
      },
    ],
    reviews: [],
    rule: {
      id: '11111111-1111-4111-8111-111111111111',
      ruleCode: 'SYNTHETIC_TEST_ONLY',
      title: 'Synthetic test rule',
      ruleNumber: null,
      clauseReference: null,
    },
    ruleVersion: {
      id: 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
      ruleId: '11111111-1111-4111-8111-111111111111',
      versionNumber: 1,
      sourceId: '22222222-2222-4222-8222-222222222222',
      clauseReference: null,
      requirementText: 'Synthetic test requirement only.',
      status: 'draft',
      effectiveFrom: '2011-01-01',
      effectiveTo: null,
    },
    source: {
      id: '22222222-2222-4222-8222-222222222222',
      title: 'Synthetic test source',
      sourceType: 'test',
      issuingAuthority: 'Test only',
      officialUrl: 'https://example.invalid/test',
      documentHash: null,
      publicationDate: null,
      effectiveDate: null,
      verificationStatus: 'unverified',
      retrievedAt: null,
    },
    ...overrides,
  };
}

describe('InspectionService', () => {
  it('rejects invalid lifecycle transitions', async () => {
    const svc = new InspectionService(
      new MemoryInspectionRepository(),
      new MemoryImageRepository(),
      new MemoryAuditRepository(),
    );
    const created = await svc.create(inspector, { referenceDate: '2026-01-15' });
    await expect(svc.update(inspector, created.id, { status: 'finalized' })).rejects.toMatchObject({
      statusCode: 400,
    });
  });

  it('does not allow silent finalize via PATCH', async () => {
    const inspections = new MemoryInspectionRepository();
    const findings = new MemoryFindingRepository();
    const svc = new InspectionService(
      inspections,
      new MemoryImageRepository(),
      new MemoryAuditRepository(),
      undefined,
      findings,
    );
    const created = await svc.create(inspector, { referenceDate: '2026-01-15' });
    await inspections.update(created.id, { status: 'review_pending' });
    await expect(svc.update(reviewer, created.id, { status: 'finalized' })).rejects.toBeInstanceOf(
      AppError,
    );
  });

  it('forbids inspectors from finalizing', async () => {
    const inspections = new MemoryInspectionRepository();
    const findings = new MemoryFindingRepository();
    const svc = new InspectionService(
      inspections,
      new MemoryImageRepository(),
      new MemoryAuditRepository(),
      undefined,
      findings,
    );
    const created = await svc.create(inspector, { referenceDate: '2026-01-15' });
    await inspections.update(created.id, { status: 'review_pending' });
    findings.findings.push(finding(created.id));
    await expect(svc.finalize(inspector, created.id)).rejects.toMatchObject({ statusCode: 403 });
  });

  it('finalizes after review and lets administrators reopen', async () => {
    const inspections = new MemoryInspectionRepository();
    const findings = new MemoryFindingRepository();
    const svc = new InspectionService(
      inspections,
      new MemoryImageRepository(),
      new MemoryAuditRepository(),
      undefined,
      findings,
    );
    const created = await svc.create(inspector, { referenceDate: '2026-01-15' });
    await inspections.update(created.id, { status: 'review_pending' });
    findings.findings.push(finding(created.id));
    const finalized = await svc.finalize(reviewer, created.id);
    expect(finalized).toMatchObject({
      status: 'finalized',
      overallOutcome: 'POTENTIAL_NON_COMPLIANCE',
    });
    await expect(svc.reopen(reviewer, created.id)).rejects.toMatchObject({ statusCode: 403 });
    const reopened = await svc.reopen(administrator, created.id);
    expect(reopened.status).toBe('review_pending');
    expect(reopened.finalizedAt).toBeNull();
  });
});
