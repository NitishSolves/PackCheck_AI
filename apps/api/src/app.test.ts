import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { hashPassword } from '@packcheck/shared';
import { createTestApp, createTestUser, TEST_PASSWORD } from './test-app.js';

const inspector = await createTestUser();
const admin = await createTestUser({
  id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
  email: 'admin@packcheck.local',
  displayName: 'Admin',
  role: 'administrator',
  passwordHash: await hashPassword(TEST_PASSWORD),
});
const reviewer = await createTestUser({
  id: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
  email: 'reviewer@packcheck.local',
  displayName: 'Reviewer',
  role: 'reviewer',
  passwordHash: await hashPassword(TEST_PASSWORD),
});

const { app, findings, inspections } = await createTestApp([inspector, admin, reviewer]);

beforeAll(async () => {
  await app.ready();
});

afterAll(async () => {
  await app.close();
});

async function login(email: string) {
  const response = await app.inject({
    method: 'POST',
    url: '/api/auth/login',
    payload: { email, password: TEST_PASSWORD },
  });
  expect(response.statusCode).toBe(200);
  return response.json() as { token: string; user: { id: string; role: string } };
}

describe('API foundation', () => {
  it('exposes health', async () => {
    const response = await app.inject({ method: 'GET', url: '/health' });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ status: 'ok' });
  });

  it('rejects unauthenticated inspection access', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/inspections' });
    expect(response.statusCode).toBe(401);
  });

  it('logs in, returns current user, and logs out', async () => {
    const session = await login('inspector@packcheck.local');
    const me = await app.inject({
      method: 'GET',
      url: '/api/auth/me',
      headers: { authorization: `Bearer ${session.token}` },
    });
    expect(me.statusCode).toBe(200);
    expect(me.json()).toMatchObject({
      user: { email: 'inspector@packcheck.local', role: 'inspector' },
    });

    const logout = await app.inject({
      method: 'POST',
      url: '/api/auth/logout',
      headers: { authorization: `Bearer ${session.token}` },
    });
    expect(logout.statusCode).toBe(200);

    const meAfter = await app.inject({
      method: 'GET',
      url: '/api/auth/me',
      headers: { authorization: `Bearer ${session.token}` },
    });
    expect(meAfter.statusCode).toBe(401);
  });

  it('creates, lists, updates, and registers images for an inspection', async () => {
    const session = await login('inspector@packcheck.local');
    const headers = { authorization: `Bearer ${session.token}` };

    const created = await app.inject({
      method: 'POST',
      url: '/api/inspections',
      headers,
      payload: { referenceDate: '2026-01-15', locationNote: 'Market stall A' },
    });
    expect(created.statusCode).toBe(201);
    const inspection = created.json() as { id: string; status: string };
    expect(inspection.status).toBe('draft');

    const listed = await app.inject({
      method: 'GET',
      url: '/api/inspections?page=1&pageSize=20',
      headers,
    });
    expect(listed.statusCode).toBe(200);
    expect(listed.json()).toMatchObject({ page: 1, total: 1 });

    const image = await app.inject({
      method: 'POST',
      url: `/api/inspections/${inspection.id}/images`,
      headers,
      payload: {
        mimeType: 'image/jpeg',
        originalFilename: 'front.jpg',
        storageKey: 'inspections/demo/front.jpg',
        panelLabel: 'front',
      },
    });
    expect(image.statusCode).toBe(201);

    const detail = await app.inject({
      method: 'GET',
      url: `/api/inspections/${inspection.id}`,
      headers,
    });
    expect(detail.statusCode).toBe(200);
    expect(detail.json()).toMatchObject({
      status: 'images_uploaded',
      images: [{ originalFilename: 'front.jpg' }],
    });

    const updated = await app.inject({
      method: 'PATCH',
      url: `/api/inspections/${inspection.id}`,
      headers,
      payload: { locationNote: 'Market stall B' },
    });
    expect(updated.statusCode).toBe(200);
    expect(updated.json()).toMatchObject({ locationNote: 'Market stall B' });
  });

  it('lists unverified P0 rule catalog without activating rules', async () => {
    const session = await login('inspector@packcheck.local');
    const response = await app.inject({
      method: 'GET',
      url: '/api/rules',
      headers: { authorization: `Bearer ${session.token}` },
    });
    const body = response.json() as { ruleCode: string; latestVersionStatus: string | null }[];
    expect(response.statusCode).toBe(200);
    expect(body.length).toBe(15);
    expect(body.every((rule) => rule.latestVersionStatus !== 'active')).toBe(true);
  });

  it('allows administrators to register sources as unverified and create draft rule versions', async () => {
    const session = await login('admin@packcheck.local');
    const headers = { authorization: `Bearer ${session.token}` };

    const source = await app.inject({
      method: 'POST',
      url: '/api/regulatory-sources',
      headers,
      payload: {
        title: 'Placeholder official source',
        sourceType: 'legislation',
        issuingAuthority: 'Development seed only',
        officialUrl: 'https://example.invalid/not-a-legal-source',
      },
    });
    expect(source.statusCode).toBe(201);
    expect(source.json()).toMatchObject({ verificationStatus: 'unverified' });

    const rules = await app.inject({ method: 'GET', url: '/api/rules', headers });
    const catalog = rules.json() as { id: string; ruleCode: string }[];
    const r01 = catalog.find((rule) => rule.ruleCode === 'R01');
    expect(r01).toBeTruthy();

    const version = await app.inject({
      method: 'POST',
      url: `/api/rules/${r01?.id}/versions`,
      headers,
      payload: {
        sourceId: (source.json() as { id: string }).id,
        versionNumber: 1,
        requirementText: 'Placeholder; not verified against an official source.',
        validationType: 'FIELD_REQUIRED',
        validationConfig: { fieldKey: 'manufacturer' },
        effectiveFrom: '2011-01-01',
      },
    });
    expect(version.statusCode).toBe(201);
    expect(version.json()).toMatchObject({ status: 'draft' });

    const inspectorSession = await login('inspector@packcheck.local');
    const forbidden = await app.inject({
      method: 'POST',
      url: '/api/regulatory-sources',
      headers: { authorization: `Bearer ${inspectorSession.token}` },
      payload: {
        title: 'Should fail',
        sourceType: 'legislation',
        issuingAuthority: 'No',
        officialUrl: 'https://example.invalid/no',
      },
    });
    expect(forbidden.statusCode).toBe(403);
  });

  it('links findings to evidence and rule version without a legal verdict', async () => {
    const session = await login('inspector@packcheck.local');
    const headers = { authorization: `Bearer ${session.token}` };
    const created = await app.inject({
      method: 'POST',
      url: '/api/inspections',
      headers,
      payload: { referenceDate: '2026-01-15' },
    });
    const inspection = created.json() as { id: string };
    const image = await app.inject({
      method: 'POST',
      url: `/api/inspections/${inspection.id}/images`,
      headers,
      payload: {
        mimeType: 'image/jpeg',
        originalFilename: 'front.jpg',
        storageKey: 'inspections/demo/front.jpg',
      },
    });
    const imageId = (image.json() as { id: string }).id;
    await inspections.update(inspection.id, { status: 'review_pending' });
    findings.findings.push({
      id: 'dddddddd-dddd-dddd-dddd-dddddddddddd',
      inspectionId: inspection.id,
      ruleVersionId: 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
      outcome: 'POTENTIAL_NON_COMPLIANCE',
      engineDecision: 'ISSUE',
      detectedValue: 'missing net quantity',
      expectedRequirement: 'Synthetic test requirement only.',
      explanation: 'Potential non-compliance detected. Needs verification.',
      reviewerState: 'pending',
      createdAt: new Date().toISOString(),
      evidence: [
        {
          id: 'ffffffff-ffff-ffff-ffff-ffffffffffff',
          findingId: 'dddddddd-dddd-dddd-dddd-dddddddddddd',
          imageId,
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
    });

    const listed = await app.inject({
      method: 'GET',
      url: `/api/inspections/${inspection.id}/findings`,
      headers,
    });
    expect(listed.statusCode).toBe(200);
    const body = listed.json() as Array<{
      wording: string;
      evidence: unknown[];
      rule: { ruleCode: string };
      source: { verificationStatus: string };
    }>;
    expect(body[0]).toMatchObject({
      wording: 'Potential non-compliance detected.',
      rule: { ruleCode: 'SYNTHETIC_TEST_ONLY' },
      source: { verificationStatus: 'unverified' },
    });
    expect(body[0]?.evidence).toHaveLength(1);
    expect(JSON.stringify(body[0])).not.toMatch(/LEGAL_VIOLATION=true/);
  });

  it('lets reviewers confirm findings and forbids inspectors from reviewing', async () => {
    const inspectorSession = await login('inspector@packcheck.local');
    const inspectorHeaders = { authorization: `Bearer ${inspectorSession.token}` };
    const created = await app.inject({
      method: 'POST',
      url: '/api/inspections',
      headers: inspectorHeaders,
      payload: { referenceDate: '2026-01-16' },
    });
    const inspection = created.json() as { id: string };
    await inspections.update(inspection.id, { status: 'review_pending' });
    findings.findings.push({
      id: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
      inspectionId: inspection.id,
      ruleVersionId: 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
      outcome: 'POTENTIAL_NON_COMPLIANCE',
      engineDecision: 'ISSUE',
      detectedValue: 'missing net quantity',
      expectedRequirement: 'Synthetic test requirement only.',
      explanation: 'Potential non-compliance detected. Needs verification.',
      reviewerState: 'pending',
      createdAt: new Date().toISOString(),
      evidence: [
        {
          id: 'bbbbbbbb-cccc-dddd-eeee-ffffffffffff',
          findingId: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
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
    });

    const inspectorReview = await app.inject({
      method: 'POST',
      url: '/api/findings/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee/review',
      headers: inspectorHeaders,
      payload: { decision: 'confirm' },
    });
    expect(inspectorReview.statusCode).toBe(403);

    const reviewerSession = await login('reviewer@packcheck.local');
    const confirmed = await app.inject({
      method: 'POST',
      url: '/api/findings/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee/review',
      headers: { authorization: `Bearer ${reviewerSession.token}` },
      payload: { decision: 'confirm', note: 'Evidence matches the extracted snippet.' },
    });
    expect(confirmed.statusCode).toBe(201);
    expect(confirmed.json()).toMatchObject({
      finding: { reviewerState: 'confirmed', wording: 'Potential non-compliance detected.' },
      review: { decision: 'confirm' },
    });
  });

  it('finalizes after review, generates a PDF disclaimer, and filters history', async () => {
    const inspectorSession = await login('inspector@packcheck.local');
    const reviewerSession = await login('reviewer@packcheck.local');
    const inspectorHeaders = { authorization: `Bearer ${inspectorSession.token}` };
    const reviewerHeaders = { authorization: `Bearer ${reviewerSession.token}` };
    const created = await app.inject({
      method: 'POST',
      url: '/api/inspections',
      headers: inspectorHeaders,
      payload: { referenceDate: '2026-01-17', locationNote: 'History filter stall' },
    });
    const inspection = created.json() as { id: string };
    await inspections.update(inspection.id, { status: 'review_pending' });
    findings.findings.push({
      id: '12121212-1212-4212-8212-121212121212',
      inspectionId: inspection.id,
      ruleVersionId: 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
      outcome: 'POTENTIAL_NON_COMPLIANCE',
      engineDecision: 'ISSUE',
      detectedValue: 'missing net quantity',
      expectedRequirement: 'Synthetic test requirement only.',
      explanation: 'Potential non-compliance detected. Needs verification.',
      reviewerState: 'pending',
      createdAt: new Date().toISOString(),
      evidence: [
        {
          id: '13131313-1313-4313-8313-131313131313',
          findingId: '12121212-1212-4212-8212-121212121212',
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
    });

    const tooEarly = await app.inject({
      method: 'POST',
      url: `/api/inspections/${inspection.id}/finalize`,
      headers: reviewerHeaders,
    });
    expect(tooEarly.statusCode).toBe(409);

    await app.inject({
      method: 'POST',
      url: '/api/findings/12121212-1212-4212-8212-121212121212/review',
      headers: reviewerHeaders,
      payload: { decision: 'confirm' },
    });

    const inspectorFinalize = await app.inject({
      method: 'POST',
      url: `/api/inspections/${inspection.id}/finalize`,
      headers: inspectorHeaders,
    });
    expect(inspectorFinalize.statusCode).toBe(403);

    const finalized = await app.inject({
      method: 'POST',
      url: `/api/inspections/${inspection.id}/finalize`,
      headers: reviewerHeaders,
    });
    expect(finalized.statusCode).toBe(200);
    expect(finalized.json()).toMatchObject({
      status: 'finalized',
      overallOutcome: 'POTENTIAL_NON_COMPLIANCE',
    });

    const silentPatch = await app.inject({
      method: 'PATCH',
      url: `/api/inspections/${inspection.id}`,
      headers: reviewerHeaders,
      payload: { locationNote: 'should not change' },
    });
    expect(silentPatch.statusCode).toBe(409);

    const generated = await app.inject({
      method: 'POST',
      url: `/api/inspections/${inspection.id}/reports`,
      headers: reviewerHeaders,
    });
    expect(generated.statusCode).toBe(201);
    const report = generated.json() as { id: string };
    const download = await app.inject({
      method: 'GET',
      url: `/api/reports/${report.id}/download`,
      headers: reviewerHeaders,
    });
    expect(download.statusCode).toBe(200);
    expect(String(download.headers['content-type'])).toContain('application/pdf');
    const pdfText = Buffer.from(download.rawPayload).toString('latin1');
    expect(pdfText.startsWith('%PDF-')).toBe(true);
    expect(pdfText).toContain('Potential non-compliance detected.');
    expect(pdfText).toContain('not a legally binding determination');

    const history = await app.inject({
      method: 'GET',
      url: '/api/inspections?status=finalized&overallOutcome=POTENTIAL_NON_COMPLIANCE',
      headers: reviewerHeaders,
    });
    expect(history.statusCode).toBe(200);
    expect((history.json() as { total: number }).total).toBeGreaterThanOrEqual(1);

    const audit = await app.inject({
      method: 'GET',
      url: `/api/audit-logs?inspectionId=${inspection.id}&pageSize=50`,
      headers: reviewerHeaders,
    });
    expect(audit.statusCode).toBe(200);
    const auditBody = audit.json() as { items: Array<{ action: string }> };
    expect(auditBody.items.map((item) => item.action)).toEqual(
      expect.arrayContaining([
        'inspection.create',
        'finding.review',
        'inspection.finalize',
        'report.generate',
      ]),
    );

    const inspectorAudit = await app.inject({
      method: 'GET',
      url: '/api/audit-logs',
      headers: inspectorHeaders,
    });
    expect(inspectorAudit.statusCode).toBe(403);
  });
});
