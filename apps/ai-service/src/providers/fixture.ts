import { readFile } from 'node:fs/promises';
import {
  AiProviderError,
  assertNoLegalVerdict,
  emptyPackageContextFlags,
  ocrResultSchema,
  type ClassifyPackageInput,
  type DetectDeclarationsInput,
  type ExtractTextInput,
  type ImageQualityResult,
  type OcrResult,
  type ScoreImageQualityInput,
} from '@packcheck/shared';
import type { AiExtractionService } from '@packcheck/shared';
import type { OcrProvider } from './types.js';

export const TEST_FIXTURE_PROVIDER = 'test-fixture';

type FixtureFile = {
  ocr?: unknown;
  quality?: unknown;
};

async function loadSidecar(imagePath: string): Promise<FixtureFile | null> {
  const candidates = [`${imagePath}.ocr.json`, imagePath.replace(/\.[^.]+$/, '.ocr.json')];
  for (const candidate of candidates) {
    try {
      const raw = await readFile(candidate, 'utf8');
      const parsed = JSON.parse(raw) as FixtureFile;
      assertNoLegalVerdict(parsed);
      return parsed;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        continue;
      }
      if (error instanceof AiProviderError) {
        throw error;
      }
      throw new AiProviderError('MALFORMED_RESPONSE', `Fixture OCR sidecar is invalid: ${candidate}`);
    }
  }
  return null;
}

export class FixtureOcrProvider implements OcrProvider {
  readonly name = TEST_FIXTURE_PROVIDER;
  readonly modelVersion = 'fixture-v1';

  async extractText(input: ExtractTextInput): Promise<OcrResult> {
    const sidecar = await loadSidecar(input.imagePath);
    if (!sidecar?.ocr) {
      return {
        fullText: '',
        tokens: [],
        blocks: [],
        meanConfidence: 0,
        provider: this.name,
        modelVersion: this.modelVersion,
      };
    }
    const parsed = ocrResultSchema.safeParse({
      ...sidecar.ocr,
      provider: this.name,
      modelVersion: this.modelVersion,
    });
    if (!parsed.success) {
      throw new AiProviderError('MALFORMED_RESPONSE', 'Fixture OCR sidecar failed schema validation');
    }
    return parsed.data;
  }
}

export class FixtureAiProvider implements AiExtractionService {
  readonly provider = TEST_FIXTURE_PROVIDER;
  private readonly ocr = new FixtureOcrProvider();

  async scoreImageQuality(input: ScoreImageQualityInput): Promise<ImageQualityResult> {
    const sidecar = await loadSidecar(input.imagePath);
    const quality = sidecar?.quality as ImageQualityResult | undefined;
    if (quality) {
      assertNoLegalVerdict(quality);
      return {
        ...quality,
        structuredIssues: quality.structuredIssues ?? [],
        metrics: quality.metrics ?? null,
        provider: this.provider,
        modelVersion: this.ocr.modelVersion,
      };
    }
    return {
      status: 'retake_required',
      score: 0,
      issues: ['No quality fixture sidecar provided'],
      structuredIssues: [{ code: 'unreadable', score: 0, detail: 'missing fixture' }],
      metrics: null,
      provider: this.provider,
      modelVersion: this.ocr.modelVersion,
    };
  }

  async extractText(input: ExtractTextInput): Promise<OcrResult> {
    return this.ocr.extractText(input);
  }

  async detectDeclarations(input: DetectDeclarationsInput) {
    void input;
    return [];
  }

  async classifyPackage(input: ClassifyPackageInput) {
    void input;
    const flags = emptyPackageContextFlags();
    return {
      suggestedContext: { ...flags },
      flags,
      confidence: 0,
      unknownApplicability: true,
      evidenceNotes: ['Fixture provider does not invent package context'],
      provider: this.provider,
      modelVersion: this.ocr.modelVersion,
    };
  }
}
