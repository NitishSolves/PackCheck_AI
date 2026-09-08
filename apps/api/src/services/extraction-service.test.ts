import { describe, expect, it } from 'vitest';
import { AiProviderError, emptyPackageContextFlags } from '@packcheck/shared';
import { AppError } from '../errors.js';
import {
  MemoryAuditRepository,
  MemoryExtractionRepository,
  MemoryImageRepository,
  MemoryInspectionRepository,
} from '../repositories/memory.js';
import { ExtractionService } from './extraction-service.js';

const actor = {
  id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  email: 'inspector@packcheck.local',
  displayName: 'Inspector',
  role: 'inspector' as const,
};

function emptyResult(overrides: Partial<{ failedSafely: boolean; failureReason: string | null }> = {}) {
  const flags = emptyPackageContextFlags();
  return {
    images: [
      {
        imageId: '',
        quality: {
          status: 'accepted' as const,
          score: 0.8,
          issues: [],
          structuredIssues: [],
          metrics: null,
          provider: 'test-fixture',
          modelVersion: 'fixture-v1',
        },
        ocr: {
          fullText: 'MRP Rs. 10',
          tokens: [],
          blocks: [],
          meanConfidence: 0.8,
          provider: 'test-fixture',
          modelVersion: 'fixture-v1',
        },
        regions: [],
        fields: [
          {
            fieldKey: 'mrp',
            rawValue: 'Rs. 10',
            normalizedValue: 'INR 10.00',
            confidence: 0.8,
            panel: 'front',
            imageId: '',
            box: null,
            needsReview: false,
            parseNotes: [],
          },
        ],
      },
    ],
    fields: [
      {
        fieldKey: 'mrp',
        rawValue: 'Rs. 10',
        normalizedValue: 'INR 10.00',
        confidence: 0.8,
        panel: 'front',
        imageId: '',
        box: null,
        needsReview: false,
        parseNotes: [],
      },
    ],
    packageClassification: {
      suggestedContext: { ...flags },
      flags,
      confidence: 0.3,
      unknownApplicability: true,
      evidenceNotes: [],
      provider: 'test-fixture',
      modelVersion: 'fixture-v1',
    },
    confidence: { imageQuality: 0.8, ocr: 0.8, fieldExtraction: 0.8, packageContext: 0.3 },
    failedSafely: overrides.failedSafely ?? false,
    failureReason: overrides.failureReason ?? null,
    provider: 'test-fixture',
    modelVersion: 'fixture-v1',
  };
}

describe('ExtractionService', () => {
  it('persists every field occurrence and layered confidence', async () => {
    const inspections = new MemoryInspectionRepository();
    const images = new MemoryImageRepository();
    const extractions = new MemoryExtractionRepository();
    const created = await inspections.create({ createdByUserId: actor.id, referenceDate: '2026-01-15' });
    const image = await images.create({
      inspectionId: created.id,
      storageKey: 'inspections/demo/front.jpg',
      mimeType: 'image/jpeg',
      originalFilename: 'front.jpg',
      panelLabel: 'front',
    });
    const service = new ExtractionService(inspections, images, extractions, new MemoryAuditRepository(), {
      extractInspection: async () => {
        const result = emptyResult();
        result.images[0]!.imageId = image.id;
        result.images[0]!.fields[0]!.imageId = image.id;
        result.fields.push({
          ...result.fields[0]!,
          rawValue: 'Rs. 12',
          normalizedValue: 'INR 12.00',
          imageId: image.id,
        });
        result.fields[0]!.imageId = image.id;
        return result;
      },
    });

    const saved = await service.runForInspection(actor, created.id);
    expect(saved.fields.length).toBe(2);
    expect(saved.confidence.ocr).toBe(0.8);
    expect(saved.packageClassification.unknownApplicability).toBe(true);
    const updated = await inspections.getById(created.id);
    expect(updated?.status).toBe('extraction_review');
  });

  it('maps missing credentials to a safe service-unavailable error', async () => {
    const inspections = new MemoryInspectionRepository();
    const images = new MemoryImageRepository();
    const created = await inspections.create({ createdByUserId: actor.id, referenceDate: '2026-01-15' });
    await images.create({
      inspectionId: created.id,
      storageKey: 'inspections/demo/front.jpg',
      mimeType: 'image/jpeg',
      originalFilename: 'front.jpg',
    });
    const service = new ExtractionService(
      inspections,
      images,
      new MemoryExtractionRepository(),
      new MemoryAuditRepository(),
      {
        extractInspection: async () => {
          throw new AiProviderError('MISSING_CREDENTIALS', 'USER_LLM_API_KEY is not configured');
        },
      },
    );
    await expect(service.runForInspection(actor, created.id)).rejects.toBeInstanceOf(AppError);
    await expect(service.runForInspection(actor, created.id)).rejects.toMatchObject({
      statusCode: 503,
      code: 'SERVICE_UNAVAILABLE',
    });
  });
});
