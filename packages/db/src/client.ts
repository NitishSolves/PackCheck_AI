import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema/index.js';

export type Database = ReturnType<typeof createDb>;
export type SqlClient = ReturnType<typeof postgres>;

export function createSqlClient(url: string, max = 10) {
  return postgres(url, { max });
}

export function createDb(url: string, client?: SqlClient) {
  const sql = client ?? createSqlClient(url);
  return drizzle(sql, { schema });
}

export { schema };
