import { describe, expect, it } from 'vitest';
import { AppError } from '../errors.js';
import {
  MemoryAuditRepository,
  MemoryImageRepository,
  MemoryInspectionRepository,
} from '../repositories/memory.js';
import { InspectionService } from './inspection-service.js';

const actor = {
  id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  email: 'inspector@packcheck.local',
  displayName: 'Inspector',
  role: 'inspector' as const,
};

describe('InspectionService', () => {
  it('rejects invalid lifecycle transitions', async () => {
    const service = new InspectionService(
      new MemoryInspectionRepository(),
      new MemoryImageRepository(),
      new MemoryAuditRepository(),
    );
    const created = await service.create(actor, { referenceDate: '2026-01-15' });
    await expect(service.update(actor, created.id, { status: 'finalized' })).rejects.toBeInstanceOf(
      AppError,
    );
  });
});
