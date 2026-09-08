import { z } from 'zod';

export const boundingBoxSchema = z.object({
  x: z.number().min(0),
  y: z.number().min(0),
  width: z.number().positive(),
  height: z.number().positive(),
  imageId: z.string().uuid().optional(),
});
export type BoundingBox = z.infer<typeof boundingBoxSchema>;

export const imageQualityResultSchema = z.object({
  status: z.enum(['accepted', 'retake_required']),
  score: z.number().min(0).max(1),
  issues: z.array(z.string()),
  provider: z.string(),
  modelVersion: z.string().nullable(),
});
export type ImageQualityResult = z.infer<typeof imageQualityResultSchema>;

export const ocrTokenSchema = z.object({
  text: z.string(),
  confidence: z.number().min(0).max(1),
  box: boundingBoxSchema,
});
export type OcrToken = z.infer<typeof ocrTokenSchema>;

export const ocrResultSchema = z.object({
  fullText: z.string(),
  tokens: z.array(ocrTokenSchema),
  meanConfidence: z.number().min(0).max(1),
  provider: z.string(),
  modelVersion: z.string().nullable(),
});
export type OcrResult = z.infer<typeof ocrResultSchema>;

export const declarationRegionSchema = z.object({
  label: z.string(),
  box: boundingBoxSchema,
  confidence: z.number().min(0).max(1),
  ocrText: z.string(),
});
export type DeclarationRegion = z.infer<typeof declarationRegionSchema>;

export const extractedFieldSchema = z.object({
  fieldKey: z.string(),
  rawValue: z.string().nullable(),
  normalizedValue: z.string().nullable(),
  confidence: z.number().min(0).max(1),
  panel: z.string().nullable(),
  imageId: z.string().uuid().nullable(),
  box: boundingBoxSchema.nullable(),
  needsReview: z.boolean(),
});
export type ExtractedField = z.infer<typeof extractedFieldSchema>;

export const packageClassificationSchema = z.object({
  suggestedContext: z.record(z.unknown()),
  confidence: z.number().min(0).max(1),
  unknownApplicability: z.boolean(),
  provider: z.string(),
  modelVersion: z.string().nullable(),
});
export type PackageClassification = z.infer<typeof packageClassificationSchema>;

export type ExtractTextInput = {
  imagePath: string;
  mimeType: string;
};

export type DetectDeclarationsInput = {
  imagePath: string;
  mimeType: string;
  ocr: OcrResult;
};

export type ClassifyPackageInput = {
  imagePaths: string[];
  metadata: Record<string, unknown>;
};

export type ScoreImageQualityInput = {
  imagePath: string;
  mimeType: string;
};

export interface AiExtractionService {
  scoreImageQuality(input: ScoreImageQualityInput): Promise<ImageQualityResult>;
  extractText(input: ExtractTextInput): Promise<OcrResult>;
  detectDeclarations(input: DetectDeclarationsInput): Promise<DeclarationRegion[]>;
  classifyPackage(input: ClassifyPackageInput): Promise<PackageClassification>;
}

export const UNCONFIGURED_AI_PROVIDER = 'unconfigured';
