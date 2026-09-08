import path from 'node:path';
import {
  AiProviderError,
  canTransitionInspectionStatus,
  type InspectionExtractionResult,
  type PublicUser,
} from '@packcheck/shared';
import { badRequest, forbidden, notFound, serviceUnavailable, unprocessable, gatewayTimeout } from '../errors.js';
import type {
  AuditRepository,
  ExtractionRepository,
  ImageRepository,
  InspectionRecord,
  InspectionRepository,
} from '../repositories/types.js';
import type { ObjectStorage } from '../storage/object-storage.js';

const INSPECTOR_ROLES = ['inspector', 'reviewer', 'administrator'] as const;

function mapAiError(error: unknown): never {
  if (error instanceof AiProviderError) {
    if (error.code === 'MISSING_CREDENTIALS' || error.code === 'UNCONFIGURED') {
      throw serviceUnavailable(error.message, { code: error.code });
    }
    if (error.code === 'TIMEOUT') {
      throw gatewayTimeout(error.message, { code: error.code });
    }
    if (error.code === 'IMAGE_UNREADABLE' || error.code === 'DECODE_FAILED') {
      throw unprocessable(error.message, { code: error.code });
    }
    throw unprocessable(error.message, { code: error.code });
  }
  throw error;
}

export type InspectionExtractorClient = {
  extractInspection(input: {
    images: Array<{ imagePath: string; mimeType: string; imageId?: string; panel?: string }>;
    metadata?: Record<string, unknown>;
  }): Promise<InspectionExtractionResult>;
};

export class ExtractionService {
  constructor(
    private readonly inspections: InspectionRepository,
    private readonly images: ImageRepository,
    private readonly extractions: ExtractionRepository,
    private readonly audit: AuditRepository,
    private readonly ai: InspectionExtractorClient,
    private readonly storage?: ObjectStorage,
  ) {}

  async runForInspection(actor: PublicUser, inspectionId: string) {
    this.assertCanInspect(actor);
    const inspection = await this.inspections.getById(inspectionId);
    if (!inspection) {
      throw notFound('Inspection not found');
    }
    this.assertCanMutate(actor, inspection);
    if (inspection.status === 'finalized') {
      throw badRequest('Cannot extract a finalized inspection');
    }
    const images = await this.images.listByInspection(inspectionId);
    if (images.length === 0) {
      throw badRequest('Upload at least one image before extraction');
    }

    const resolved = images.map((image) => ({
      image,
      imagePath: this.resolveImagePath(image.storageKey),
    }));

    let status = inspection.status;
    if (status === 'draft' && canTransitionInspectionStatus(status, 'images_uploaded')) {
      await this.inspections.update(inspectionId, { status: 'images_uploaded' });
      status = 'images_uploaded';
    }
    if (canTransitionInspectionStatus(status, 'extracting') && status !== 'extracting') {
      await this.inspections.update(inspectionId, { status: 'extracting' });
    }

    let result: InspectionExtractionResult;
    try {
      result = await this.ai.extractInspection({
        images: resolved.map((entry) => ({
          imagePath: entry.imagePath,
          mimeType: entry.image.mimeType,
          imageId: entry.image.id,
          panel: entry.image.panelLabel ?? undefined,
        })),
      });
    } catch (error) {
      if (canTransitionInspectionStatus('extracting', 'quality_failed')) {
        await this.inspections.update(inspectionId, { status: 'quality_failed' }).catch(() => undefined);
      }
      mapAiError(error);
    }

    if (!this.extractions.saveInspectionExtraction) {
      throw serviceUnavailable('Extraction persistence is not configured');
    }

    const snapshot = await this.extractions.saveInspectionExtraction({
      inspectionId,
      provider: result.provider,
      modelVersion: result.modelVersion,
      confidence: result.confidence,
      failedSafely: result.failedSafely,
      failureReason: result.failureReason,
      fields: result.fields,
      ocrByImageId: result.images
        .filter((image) => image.imageId)
        .map((image) => ({ imageId: image.imageId as string, ocr: image.ocr })),
      qualityByImageId: result.images
        .filter((image) => image.imageId)
        .map((image) => ({ imageId: image.imageId as string, quality: image.quality })),
      packageClassification: result.packageClassification,
    });

    const nextStatus = result.images.some((image) => image.quality.status === 'retake_required')
      ? 'quality_failed'
      : 'extraction_review';
    if (canTransitionInspectionStatus('extracting', nextStatus)) {
      await this.inspections.update(inspectionId, { status: nextStatus });
    }

    await this.audit.record({
      actorUserId: actor.id,
      action: 'inspection.extract',
      entityType: 'inspection',
      entityId: inspectionId,
      payload: {
        provider: result.provider,
        failedSafely: result.failedSafely,
        fieldCount: result.fields.length,
      },
    });

    return {
      ...snapshot,
      failedSafely: result.failedSafely,
      failureReason: result.failureReason,
      confidence: result.confidence,
      packageClassification: result.packageClassification,
      images: result.images,
    };
  }

  async getByInspection(inspectionId: string) {
    const inspection = await this.inspections.getById(inspectionId);
    if (!inspection) {
      throw notFound('Inspection not found');
    }
    if (this.extractions.getSnapshot) {
      const snapshot = await this.extractions.getSnapshot(inspectionId);
      if (snapshot) {
        return snapshot;
      }
    }
    return {
      run: null,
      fields: await this.extractions.listByInspection(inspectionId),
      ocr: [],
      packageContext: null,
    };
  }

  private resolveImagePath(storageKey: string): string {
    if (this.storage?.resolvePath) {
      return this.storage.resolvePath(storageKey);
    }
    if (storageKey.includes('..') || path.isAbsolute(storageKey)) {
      throw badRequest('Invalid storage key');
    }
    return storageKey;
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
