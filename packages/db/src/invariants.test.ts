import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

describe('regulatory history invariants', () => {
  it('ships an extraction evidence migration without dropping historical OCR', () => {
    const folder = join(dirname(fileURLToPath(import.meta.url)), '../drizzle');
    const sql = readFileSync(join(folder, '0002_ai_extraction_evidence.sql'), 'utf8');
    expect(sql).toMatch(/inspection_extraction_runs/);
    expect(sql).toMatch(/parse_notes/);
    expect(sql).not.toMatch(/DROP TABLE ocr_results/i);
  });

  it('ships a migration that forbids deleting or overwriting rule versions', () => {
    const folder = join(dirname(fileURLToPath(import.meta.url)), '../drizzle');
    const sql = readFileSync(join(folder, '0001_auth_sessions_and_invariants.sql'), 'utf8');
    expect(sql).toMatch(/Historical rule versions must never be deleted/);
    expect(sql).toMatch(/never be destructively overwritten/);
    expect(sql).toMatch(/BEFORE UPDATE OR DELETE ON rule_versions/);
  });
});
