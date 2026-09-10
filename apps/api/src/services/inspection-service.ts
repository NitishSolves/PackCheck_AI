import path from 'node:path';
import {
  canTransitionInspectionStatus,
  overallOutcomeFrom,
  type InspectionStatus,
  type Paginated,
  type PublicUser,
} from '@packcheck/shared';
import { badRequest, conflict, forbidden, notFound } from '../errors.js';
import type {
  AuditRepository,
  FindingRepository,
  ImageRepository,
  InspectionDetail,
  InspectionImageRecord,
  InspectionListFilter,
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
    private readonly findings?: FindingRepository,
  ) {}

  async list(
    query: InspectionListFilter,
    actor?: PublicUser,
  ): Promise<Paginated<InspectionRecord>> {
    const scoped: InspectionListFilter =
      actor?.role === 'inspector' ? { ...query, createdByUserId: actor.id } : query;
    return this.inspections.list(scoped);
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
    if (existing.status === 'finalized') {
      throw conflict('Finalized inspections cannot be updated');
    }
    if (patch.status === 'finalized') {
      throw badRequest('Use POST /api/inspections/:id/finalize to finalize an inspection');
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

  async finalize(actor: PublicUser, id: string): Promise<InspectionRecord> {
    if (actor.role === 'inspector') {
      throw forbidden('Inspectors cannot finalize inspections');
    }
    this.assertCanInspect(actor);
    const existing = await this.inspections.getById(id);
    if (!existing) {
      throw notFound('Inspection not found');
    }
    this.assertCanMutate(actor, existing);
    if (existing.status === 'finalized') {
      throw conflict('Inspection is already finalized');
    }
    if (existing.status !== 'review_pending') {
      throw conflict(`Cannot finalize inspection from ${existing.status}`);
    }
    if (!this.findings) {
      throw badRequest('Finding repository is not configured');
    }
    const details = await this.findings.listByInspection(id);
    if (details.some((finding) => finding.evidence.length === 0)) {
      throw conflict('Every finding must include evidence before finalization');
    }
    if (details.some((finding) => finding.reviewerState === 'pending')) {
      throw conflict('All findings must be reviewed before finalization');
    }
    const overallOutcome = overallOutcomeFrom(details);
    const updated = await this.inspections.update(id, {
      status: 'finalized',
      finalizedAt: new Date().toISOString(),
      overallOutcome,
    });
    await this.audit.record({
      actorUserId: actor.id,
      action: 'inspection.finalize',
      entityType: 'inspection',
      entityId: id,
      payload: { overallOutcome },
    });
    return updated;
  }

  async reopen(actor: PublicUser, id: string): Promise<InspectionRecord> {
    if (actor.role !== 'administrator') {
      throw forbidden('Only administrators can reopen finalized inspections');
    }
    const existing = await this.inspections.getById(id);
    if (!existing) {
      throw notFound('Inspection not found');
    }
    if (existing.status !== 'finalized') {
      throw conflict('Only finalized inspections can be reopened');
    }
    const updated = await this.inspections.update(id, {
      status: 'review_pending',
      finalizedAt: null,
    });
    await this.audit.record({
      actorUserId: actor.id,
      action: 'inspection.reopen',
      entityType: 'inspection',
      entityId: id,
    });
    return updated;
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
