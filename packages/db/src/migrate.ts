import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import postgres from 'postgres';

export async function runMigrations(databaseUrl: string, migrationsFolder: string): Promise<void> {
  const sql = postgres(databaseUrl, { max: 1 });
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `;
    const files = (await readdir(migrationsFolder)).filter((file) => file.endsWith('.sql')).sort();
    for (const file of files) {
      const applied = await sql<{ id: string }[]>`
        SELECT id FROM schema_migrations WHERE id = ${file}
      `;
      if (applied.length > 0) {
        continue;
      }
      const content = await readFile(path.join(migrationsFolder, file), 'utf8');
      await sql.begin(async (tx) => {
        await tx.unsafe(content);
        await tx`INSERT INTO schema_migrations (id) VALUES (${file})`;
      });
    }
  } finally {
    await sql.end();
  }
}
