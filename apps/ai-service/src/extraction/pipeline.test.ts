import { mkdtemp, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { AiProviderError, emptyPackageContextFlags } from '@packcheck/shared';
import { encodeGrayPng } from '../cv/image-decode.js';
import { EvidenceExtractionPipeline } from './pipeline.js';
import { detectDeclarationRegions } from './declaration-regions.js';
import { extractDeclarationFields } from './field-extraction.js';
import { classifyPackageContext } from './package-context.js';
import type { OcrProvider } from '../providers/types.js';
import { FixtureOcrProvider } from '../providers/fixture.js';

const sampleOcr = {
  fullText:
    'Manufactured by: Acme Foods Pvt Ltd\nPacked by: Acme Packers\nMRP Rs. 50.00 inclusive of all taxes\nNet Qty 200 g\nMFD 07/2024\nBest before 01/2025\nImported by: Global Impex\nCountry of origin: Italy\nConsumer care: 1800-123-4567 care@acme.test\nUnit sale price Rs. 25.00',
  tokens: [
    { text: 'Manufactured', confidence: 0.9, box: { x: 10, y: 10, width: 80, height: 12 } },
    { text: 'by:', confidence: 0.9, box: { x: 92, y: 10, width: 20, height: 12 } },
    { text: 'Acme', confidence: 0.9, box: { x: 114, y: 10, width: 40, height: 12 } },
    { text: 'Foods', confidence: 0.9, box: { x: 156, y: 10, width: 40, height: 12 } },
    { text: 'MRP', confidence: 0.92, box: { x: 10, y: 40, width: 30, height: 12 } },
    { text: 'Rs.', confidence: 0.92, box: { x: 42, y: 40, width: 20, height: 12 } },
    { text: '50.00', confidence: 0.92, box: { x: 64, y: 40, width: 40, height: 12 } },
    { text: 'Net', confidence: 0.88, box: { x: 10, y: 70, width: 24, height: 12 } },
    { text: 'Qty', confidence: 0.88, box: { x: 36, y: 70, width: 24, height: 12 } },
    { text: '200', confidence: 0.88, box: { x: 62, y: 70, width: 24, height: 12 } },
    { text: 'g', confidence: 0.88, box: { x: 88, y: 70, width: 10, height: 12 } },
  ],
  blocks: [],
  meanConfidence: 0.9,
  provider: 'test-fixture',
  modelVersion: 'fixture-v1',
};

describe('declaration extraction', () => {
  it('keeps every occurrence instead of collapsing conflicts', () => {
    const ocr = {
      ...sampleOcr,
      fullText: `${sampleOcr.fullText}\nMRP Rs. 55.00`,
    };
    const regions = detectDeclarationRegions(ocr);
    const fields = extractDeclarationFields({
      ocr,
      regions,
      imageId: '11111111-1111-4111-8111-111111111111',
      panel: 'front',
    });
    const mrps = fields.filter((field) => field.fieldKey === 'mrp');
    expect(mrps.length).toBeGreaterThanOrEqual(2);
    expect(new Set(mrps.map((field) => field.normalizedValue)).size).toBeGreaterThan(1);
    expect(fields.some((field) => field.fieldKey === 'manufacturer')).toBe(true);
    expect(fields.some((field) => field.fieldKey === 'net_quantity')).toBe(true);
  });
});

describe('package context', () => {
  it('leaves unknown flags unknown instead of coercing to false', () => {
    const result = classifyPackageContext({
      texts: ['MRP Rs. 10 Made in India Imported by Demo'],
      provider: 'test',
      modelVersion: null,
    });
    expect(result.flags.retail).toBe('true');
    expect(result.flags.imported).toBe('true');
    expect(result.flags.wholesale).toBe('unknown');
    expect(result.flags.special).toBe('unknown');
    expect(result.unknownApplicability).toBe(true);
    expect(emptyPackageContextFlags().group).toBe('unknown');
  });
});

describe('evidence pipeline', () => {
  it('stores layered confidence and never returns a legal verdict', async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), 'packcheck-ocr-'));
    const imagePath = path.join(dir, 'front.png');
    const pixels = new Uint8Array(420 * 420).fill(180);
    await writeFile(imagePath, encodeGrayPng(420, 420, pixels));
    await writeFile(
      `${imagePath}.ocr.json`,
      JSON.stringify({ ocr: sampleOcr, quality: { status: 'accepted', score: 0.8, issues: [] } }),
    );

    const pipeline = new EvidenceExtractionPipeline(new FixtureOcrProvider(), {
      providerName: 'test-fixture',
      modelVersion: 'fixture-v1',
      minOcrConfidence: 0.6,
      minFieldConfidence: 0.5,
      minQualityScore: 0.5,
    });
    const result = await pipeline.extractInspection({
      images: [
        { imagePath, mimeType: 'image/png', imageId: '11111111-1111-4111-8111-111111111111', panel: 'front' },
        { imagePath, mimeType: 'image/png', imageId: '22222222-2222-4222-8222-222222222222', panel: 'back' },
      ],
    });
    expect(result.fields.length).toBeGreaterThan(0);
    expect(result.confidence.imageQuality).toBeGreaterThan(0);
    expect(result.confidence.ocr).toBeGreaterThan(0);
    expect(result.confidence.fieldExtraction).toBeGreaterThan(0);
    expect(result.packageClassification.unknownApplicability).toBe(true);
    expect(JSON.stringify(result)).not.toMatch(/LEGAL_VIOLATION/);
  });

  it('fails safely on provider timeout without inventing OCR', async () => {
    const failing: OcrProvider = {
      name: 'boom',
      modelVersion: null,
      extractText: async () => {
        throw new AiProviderError('TIMEOUT', 'OCR timed out', true);
      },
    };
    const pipeline = new EvidenceExtractionPipeline(failing, {
      providerName: 'boom',
      modelVersion: null,
      minOcrConfidence: 0.6,
      minFieldConfidence: 0.5,
      minQualityScore: 0.5,
    });
    const dir = await mkdtemp(path.join(os.tmpdir(), 'packcheck-ocr-'));
    const imagePath = path.join(dir, 'front.png');
    await writeFile(imagePath, encodeGrayPng(420, 420, new Uint8Array(420 * 420).fill(100)));
    const result = await pipeline.extractInspection({
      images: [{ imagePath, mimeType: 'image/png', imageId: '11111111-1111-4111-8111-111111111111' }],
    });
    expect(result.failedSafely).toBe(true);
    expect(result.images[0]?.ocr.fullText).toBe('');
    expect(result.fields).toEqual([]);
    expect(result.failureReason).toMatch(/TIMEOUT/);
  });

  it('rejects malformed OCR that includes a legal verdict', async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), 'packcheck-ocr-'));
    const imagePath = path.join(dir, 'front.png');
    await writeFile(imagePath, encodeGrayPng(32, 32, new Uint8Array(32 * 32).fill(90)));
    await writeFile(`${imagePath}.ocr.json`, JSON.stringify({ ocr: { LEGAL_VIOLATION: true } }));
    const pipeline = new EvidenceExtractionPipeline(new FixtureOcrProvider(), {
      providerName: 'test-fixture',
      modelVersion: 'fixture-v1',
      minOcrConfidence: 0.6,
      minFieldConfidence: 0.5,
      minQualityScore: 0.5,
    });
    await expect(
      pipeline.extractImage({ imagePath, mimeType: 'image/png' }),
    ).rejects.toBeInstanceOf(AiProviderError);
  });
});
