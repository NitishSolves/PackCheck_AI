import {
  AiProviderError,
  assertNoLegalVerdict,
  clampConfidence,
  emptyLayeredConfidence,
  inspectionExtractionResultSchema,
  isLowConfidence,
  meanConfidence,
  normalizeDeclarationFields,
  type AiExtractionService,
  type ClassifyPackageInput,
  type DeclarationRegion,
  type DetectDeclarationsInput,
  type ExtractedField,
  type ExtractTextInput,
  type ImageExtractionResult,
  type ImageQualityResult,
  type InspectionExtractionResult,
  type NormalizeDeclarationFieldsInput,
  type OcrResult,
  type PackageClassification,
  type ScoreImageQualityInput,
} from '@packcheck/shared';
import { readDecodedImage } from '../cv/read-image.js';
import { scoreDecodedImage } from '../cv/quality.js';
import { detectDeclarationRegions } from './declaration-regions.js';
import { extractDeclarationFields, mergeOccurrences } from './field-extraction.js';
import { classifyPackageContext } from './package-context.js';
import type { OcrProvider } from '../providers/types.js';

export type PipelineConfig = {
  providerName: string;
  modelVersion: string | null;
  minOcrConfidence: number;
  minFieldConfidence: number;
  minQualityScore: number;
};

export class EvidenceExtractionPipeline implements AiExtractionService {
  constructor(
    private readonly ocr: OcrProvider,
    private readonly config: PipelineConfig,
  ) {}

  async scoreImageQuality(input: ScoreImageQualityInput): Promise<ImageQualityResult> {
    const { image } = await readDecodedImage(input.imagePath);
    return scoreDecodedImage(image, {
      provider: this.config.providerName,
      modelVersion: this.config.modelVersion,
    });
  }

  async extractText(input: ExtractTextInput): Promise<OcrResult> {
    const result = await this.ocr.extractText(input);
    assertNoLegalVerdict(result);
    return {
      ...result,
      blocks: result.blocks ?? [],
      provider: result.provider || this.ocr.name,
      modelVersion: result.modelVersion ?? this.ocr.modelVersion,
    };
  }

  async detectDeclarations(input: DetectDeclarationsInput): Promise<DeclarationRegion[]> {
    return detectDeclarationRegions(input.ocr);
  }

  async detectDeclarationRegions(input: DetectDeclarationsInput): Promise<DeclarationRegion[]> {
    return this.detectDeclarations(input);
  }

  async classifyPackage(input: ClassifyPackageInput): Promise<PackageClassification> {
    const texts = input.ocrTexts ?? [];
    return classifyPackageContext({
      texts,
      metadata: input.metadata,
      provider: this.config.providerName,
      modelVersion: this.config.modelVersion,
    });
  }

  async normalizeDeclarationFields(input: NormalizeDeclarationFieldsInput): Promise<ExtractedField[]> {
    return normalizeDeclarationFields(input.fields).map((field, index) => {
      const source = input.fields[index];
      const confidence = clampConfidence(
        Math.min(source?.confidence ?? field.parseConfidence, field.parseConfidence),
      );
      return {
        fieldKey: field.fieldKey,
        rawValue: field.rawValue,
        normalizedValue: field.normalizedValue,
        confidence,
        panel: source?.panel ?? null,
        imageId: source?.imageId ?? null,
        box: source?.box ?? null,
        needsReview: isLowConfidence(confidence, this.config.minFieldConfidence) || field.parseNotes.length > 0,
        parseNotes: field.parseNotes,
      };
    });
  }

  async extractImage(input: {
    imagePath: string;
    mimeType: string;
    imageId?: string | null;
    panel?: string | null;
  }): Promise<ImageExtractionResult> {
    const quality = await this.scoreImageQuality(input);
    const ocr = await this.extractText({
      imagePath: input.imagePath,
      mimeType: input.mimeType,
      imageId: input.imageId ?? undefined,
    });
    const regions = detectDeclarationRegions(ocr);
    const fields = extractDeclarationFields({
      ocr,
      regions,
      imageId: input.imageId,
      panel: input.panel,
      minFieldConfidence: this.config.minFieldConfidence,
    });
    return {
      imageId: input.imageId ?? null,
      quality,
      ocr,
      regions,
      fields,
    };
  }

  async extractInspection(input: {
    images: Array<{ imagePath: string; mimeType: string; imageId?: string | null; panel?: string | null }>;
    metadata?: Record<string, unknown>;
  }): Promise<InspectionExtractionResult> {
    const images: ImageExtractionResult[] = [];
    let failureReason: string | null = null;
    let failedSafely = false;

    for (const image of input.images) {
      try {
        images.push(await this.extractImage(image));
      } catch (error) {
        failedSafely = true;
        failureReason =
          error instanceof AiProviderError
            ? `${error.code}: ${error.message}`
            : error instanceof Error
              ? error.message
              : 'unknown extraction failure';
        images.push({
          imageId: image.imageId ?? null,
          quality: {
            status: 'retake_required',
            score: 0,
            issues: [failureReason],
            structuredIssues: [{ code: 'unreadable', score: 0, detail: failureReason }],
            metrics: null,
            provider: this.config.providerName,
            modelVersion: this.config.modelVersion,
          },
          ocr: {
            fullText: '',
            tokens: [],
            blocks: [],
            meanConfidence: 0,
            provider: this.config.providerName,
            modelVersion: this.config.modelVersion,
          },
          regions: [],
          fields: [],
        });
      }
    }

    const fields = mergeOccurrences(images.flatMap((image) => image.fields));
    const packageClassification = classifyPackageContext({
      texts: images.map((image) => image.ocr.fullText),
      metadata: input.metadata,
      provider: this.config.providerName,
      modelVersion: this.config.modelVersion,
    });

    const qualityScores = images.map((image) => image.quality.score);
    const ocrScores = images.map((image) => image.ocr.meanConfidence);
    const fieldScores = fields.map((field) => field.confidence);
    const confidence = {
      ...emptyLayeredConfidence(),
      imageQuality: meanConfidence(qualityScores),
      ocr: meanConfidence(ocrScores),
      fieldExtraction: meanConfidence(fieldScores),
      packageContext: packageClassification.confidence,
    };

    if (!failedSafely) {
      const lowOcr = images.some((image) => isLowConfidence(image.ocr.meanConfidence, this.config.minOcrConfidence));
      const lowQuality = images.some((image) => isLowConfidence(image.quality.score, this.config.minQualityScore));
      if (lowOcr || lowQuality) {
        failedSafely = true;
        failureReason = lowQuality
          ? 'LOW_CONFIDENCE: image quality below review threshold'
          : 'LOW_CONFIDENCE: OCR confidence below review threshold';
      }
    }

    const result: InspectionExtractionResult = {
      images,
      fields,
      packageClassification,
      confidence,
      failedSafely,
      failureReason,
      provider: this.config.providerName,
      modelVersion: this.config.modelVersion,
    };
    assertNoLegalVerdict(result);
    return inspectionExtractionResultSchema.parse(result);
  }
}
