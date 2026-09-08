import path from 'node:path';
import {
  canTransitionInspectionStatus,
  type InspectionStatus,
  type Paginated,
  type PaginationQuery,
  type PublicUser,
} from '@packcheck/shared';
import { badRequest, forbidden, notFound } from '../errors.js';
import type {
  AuditRepository,
  ImageRepository,
  InspectionDetail,
  InspectionImageRecord,
  InspectionRecord,
  InspectionRepository,
} from '../repositories/types.js';
import type { ObjectStorage } from '../storage/object-storage.js';
import { assertSafeImageUpload, sanitizeFilename } from '../storage/object-storage.js';

const INSPECTOR_ROLES = ['inspector', 'reviewer', 'administrator'] as const;

export class InspectionService {
  constructor(
    private readonly inspections: InspectionRepository,
    private readonly images: ImageRepository,
    private readonly audit: AuditRepository,
    private readonly storage?: ObjectStorage,
  ) {}

  async list(query: PaginationQuery): Promise<Paginated<InspectionRecord>> {
    return this.inspections.list(query);
  }

  async getById(id: string): Promise<InspectionDetail> {
    const inspection = await this.inspections.getById(id);
    if (!inspection) {
      throw notFound('Inspection not found');
    }
    const images = await this.images.listByInspection(id);
    return { ...inspection, images };
  }

  async create(
    actor: PublicUser,
    input: { referenceDate: string; locationNote?: string },
  ): Promise<InspectionRecord> {
    this.assertCanInspect(actor);
    const inspection = await this.inspections.create({
      createdByUserId: actor.id,
      referenceDate: input.referenceDate,
      locationNote: input.locationNote,
    });
    await this.audit.record({
      actorUserId: actor.id,
      action: 'inspection.create',
      entityType: 'inspection',
      entityId: inspection.id,
    });
    return inspection;
  }

  async update(
    actor: PublicUser,
    id: string,
    patch: { referenceDate?: string; locationNote?: string | null; status?: InspectionStatus },
  ): Promise<InspectionRecord> {
    this.assertCanInspect(actor);
    const existing = await this.inspections.getById(id);
    if (!existing) {
      throw notFound('Inspection not found');
    }
    this.assertCanMutate(actor, existing);
    if (existing.status === 'finalized' && patch.status && patch.status !== 'finalized') {
      throw badRequest('Finalized inspections cannot change status');
    }
    if (patch.status && !canTransitionInspectionStatus(existing.status, patch.status)) {
      throw badRequest('Invalid inspection status transition', {
        from: existing.status,
        to: patch.status,
      });
    }
    const updated = await this.inspections.update(id, patch);
    await this.audit.record({
      actorUserId: actor.id,
      action: 'inspection.update',
      entityType: 'inspection',
      entityId: id,
      payload: patch,
    });
    return updated;
  }

  async registerImage(
    actor: PublicUser,
    inspectionId: string,
    input: {
      mimeType: string;
      originalFilename: string;
      panelLabel?: string;
      storageKey?: string;
      bytes?: Buffer;
    },
  ): Promise<InspectionImageRecord> {
    this.assertCanInspect(actor);
    const inspection = await this.inspections.getById(inspectionId);
    if (!inspection) {
      throw notFound('Inspection not found');
    }
    this.assertCanMutate(actor, inspection);
    if (inspection.status === 'finalized') {
      throw badRequest('Cannot add images to a finalized inspection');
    }

    let storageKey = input.storageKey;
    let byteSize: number | undefined;
    const originalFilename = sanitizeFilename(input.originalFilename);
    if (input.bytes) {
      if (!this.storage) {
        throw badRequest('Object storage is not configured');
      }
      const stored = await this.storage.putImage({
        inspectionId,
        originalFilename,
        mimeType: input.mimeType,
        bytes: input.bytes,
      });
      storageKey = stored.storageKey;
      byteSize = stored.byteSize;
    } else {
      assertSafeImageUpload(input.mimeType, 1);
      if (!storageKey) {
        throw badRequest('storageKey is required when file bytes are not provided');
      }
      if (storageKey.includes('..') || path.isAbsolute(storageKey)) {
        throw badRequest('Invalid storage key');
      }
    }

    const image = await this.images.create({
      inspectionId,
      storageKey: storageKey as string,
      mimeType: input.mimeType,
      originalFilename,
      panelLabel: input.panelLabel,
      byteSize,
    });

    if (inspection.status === 'draft') {
      await this.inspections.update(inspectionId, { status: 'images_uploaded' });
    }

    await this.audit.record({
      actorUserId: actor.id,
      action: 'inspection.image.register',
      entityType: 'inspection_image',
      entityId: image.id,
      payload: { inspectionId },
    });
    return image;
  }

  private assertCanInspect(actor: PublicUser): void {
    if (!INSPECTOR_ROLES.includes(actor.role)) {
      throw forbidden();
    }
  }

  private assertCanMutate(actor: PublicUser, inspection: InspectionRecord): void {
    if (actor.role === 'administrator' || actor.role === 'reviewer') {
      return;
    }
    if (inspection.createdByUserId !== actor.id) {
      throw forbidden('Inspectors may only modify their own inspections');
    }
  }
}
