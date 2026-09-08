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

const { app } = await createTestApp([inspector, admin]);

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
});
