import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { ALLOWED_IMAGE_MIME_TYPES } from '@packcheck/shared';
import { badRequest } from '../errors.js';

const MIME_EXTENSION: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

export type StoredObject = {
  storageKey: string;
  byteSize: number;
  mimeType: string;
  originalFilename: string;
};

export interface ObjectStorage {
  putImage(input: {
    inspectionId: string;
    originalFilename: string;
    mimeType: string;
    bytes: Buffer;
  }): Promise<StoredObject>;
}

export function sanitizeFilename(originalFilename: string): string {
  const base = path.basename(originalFilename).replace(/[^a-zA-Z0-9._-]/g, '_');
  return base.length > 0 ? base.slice(0, 255) : 'upload.bin';
}

export function assertSafeImageUpload(mimeType: string, byteSize: number): void {
  if (!(ALLOWED_IMAGE_MIME_TYPES as readonly string[]).includes(mimeType)) {
    throw badRequest('Unsupported image type', { mimeType });
  }
  if (byteSize <= 0 || byteSize > MAX_IMAGE_BYTES) {
    throw badRequest('Image exceeds size limit', { maxBytes: MAX_IMAGE_BYTES });
  }
}

export class LocalObjectStorage implements ObjectStorage {
  constructor(private readonly rootDir: string) {}

  async putImage(input: {
    inspectionId: string;
    originalFilename: string;
    mimeType: string;
    bytes: Buffer;
  }): Promise<StoredObject> {
    assertSafeImageUpload(input.mimeType, input.bytes.length);
    const originalFilename = sanitizeFilename(input.originalFilename);
    const ext = MIME_EXTENSION[input.mimeType] ?? 'bin';
    const storageKey = path.posix.join('inspections', input.inspectionId, `${randomUUID()}.${ext}`);
    const absolute = path.resolve(this.rootDir, storageKey);
    const root = path.resolve(this.rootDir);
    if (!absolute.startsWith(root + path.sep) && absolute !== root) {
      throw badRequest('Invalid storage path');
    }
    await mkdir(path.dirname(absolute), { recursive: true });
    await writeFile(absolute, input.bytes);
    return {
      storageKey,
      byteSize: input.bytes.length,
      mimeType: input.mimeType,
      originalFilename,
    };
  }
}
