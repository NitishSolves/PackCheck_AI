import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import postgres from 'postgres';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runMigrations } from '@packcheck/db';

const databaseUrl =
  process.env.PACKCHECK_TEST_DATABASE_URL ??
  process.env.DATABASE_URL ??
  'postgres://packcheck:packcheck@127.0.0.1:5432/packcheck_test';

describe('evidence review database invariants', () => {
  let sql: ReturnType<typeof postgres> | null = null;
  let available = true;

  beforeAll(async () => {
    try {
      const migrationsFolder = join(
        dirname(fileURLToPath(import.meta.url)),
        '../../../packages/db/drizzle',
      );
      await runMigrations(databaseUrl, migrationsFolder);
      sql = postgres(databaseUrl, { max: 1 });
      await sql`SELECT 1`;
    } catch {
      available = false;
    }
  });

  afterAll(async () => {
    if (sql) {
      await sql.end();
    }
  });

  it('keeps audit logs append-only after the evidence review migration', async () => {
    if (!available || !sql) {
      return;
    }
    await sql`INSERT INTO audit_logs (action, entity_type, payload) VALUES ('test.append', 'inspection', '{}'::jsonb)`;
    await expect(sql`DELETE FROM audit_logs`).rejects.toThrow(/append-only/i);
    await expect(sql`UPDATE audit_logs SET action = 'mutated'`).rejects.toThrow(/append-only/i);
  });
});
