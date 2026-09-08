import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runMigrations } from './migrate.js';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error('DATABASE_URL is required to run migrations');
}

const migrationsFolder = join(dirname(fileURLToPath(import.meta.url)), '../drizzle');
await runMigrations(databaseUrl, migrationsFolder);
