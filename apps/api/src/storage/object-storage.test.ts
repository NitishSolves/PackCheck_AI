import { mkdtemp, readFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { AppError } from '../errors.js';
import { LocalObjectStorage, sanitizeFilename } from './object-storage.js';

describe('object storage', () => {
  it('sanitizes filenames and rejects unsupported types', async () => {
    expect(sanitizeFilename('../etc/passwd')).toBe('passwd');
    const dir = await mkdtemp(path.join(os.tmpdir(), 'packcheck-storage-'));
    const storage = new LocalObjectStorage(dir);
    await expect(
      storage.putImage({
        inspectionId: '11111111-1111-1111-1111-111111111111',
        originalFilename: 'x.txt',
        mimeType: 'text/plain',
        bytes: Buffer.from('nope'),
      }),
    ).rejects.toBeInstanceOf(AppError);
  });

  it('writes jpeg bytes under the inspection prefix', async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), 'packcheck-storage-'));
    const storage = new LocalObjectStorage(dir);
    const stored = await storage.putImage({
      inspectionId: '11111111-1111-1111-1111-111111111111',
      originalFilename: 'front.jpg',
      mimeType: 'image/jpeg',
      bytes: Buffer.from([0xff, 0xd8, 0xff]),
    });
    expect(stored.storageKey.startsWith('inspections/11111111-1111-1111-1111-111111111111/')).toBe(
      true,
    );
    const written = await readFile(path.join(dir, stored.storageKey));
    expect(written.length).toBe(3);
  });
});
