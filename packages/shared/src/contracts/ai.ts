import { z } from 'zod';
import { DECLARATION_FIELD_KEYS } from '../domain/declaration-fields.js';
import { PACKAGE_CONTEXT_FLAGS } from '../domain/package-context.js';
import { TRI_STATES } from '../domain/tri-state.js';

export const boundingBoxSchema = z.object({
  x: z.number().min(0),
  y: z.number().min(0),
  width: z.number().positive(),
  height: z.number().positive(),
  imageId: z.string().uuid().optional(),
});
export type BoundingBox = z.infer<typeof boundingBoxSchema>;

export const IMAGE_QUALITY_ISSUE_CODES = [
  'low_resolution',
  'blur',
  'glare',
  'occlusion',
  'orientation',
  'unreadable',
] as const;
export type ImageQualityIssueCode = (typeof IMAGE_QUALITY_ISSUE_CODES)[number];

export const imageQualityIssueSchema = z.object({
  code: z.enum(IMAGE_QUALITY_ISSUE_CODES),
  score: z.number().min(0).max(1),
  detail: z.string(),
});
export type ImageQualityIssue = z.infer<typeof imageQualityIssueSchema>;

export const imageQualityMetricsSchema = z.object({
  resolution: z.object({
    width: z.number().int().nonnegative(),
    height: z.number().int().nonnegative(),
    megapixels: z.number().nonnegative(),
    score: z.number().min(0).max(1),
  }),
  blur: z.object({
    laplacianVariance: z.number().nonnegative(),
    score: z.number().min(0).max(1),
  }),
  glare: z.object({
    saturatedRatio: z.number().min(0).max(1),
    score: z.number().min(0).max(1),
  }),
  occlusion: z.object({
    estimatedCoveredRatio: z.number().min(0).max(1),
    score: z.number().min(0).max(1),
  }),
  orientation: z.object({
    degrees: z.number(),
    uprightLikely: z.boolean(),
    score: z.number().min(0).max(1),
  }),
});
export type ImageQualityMetrics = z.infer<typeof imageQualityMetricsSchema>;

export const imageQualityResultSchema = z.object({
  status: z.enum(['accepted', 'retake_required']),
  score: z.number().min(0).max(1),
  issues: z.array(z.string()),
  structuredIssues: z.array(imageQualityIssueSchema).default([]),
  metrics: imageQualityMetricsSchema.nullable().default(null),
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

export const ocrBlockSchema = z.object({
  text: z.string(),
  confidence: z.number().min(0).max(1),
  box: boundingBoxSchema,
  tokens: z.array(ocrTokenSchema).default([]),
});
export type OcrBlock = z.infer<typeof ocrBlockSchema>;

export const ocrResultSchema = z.object({
  fullText: z.string(),
  tokens: z.array(ocrTokenSchema),
  blocks: z.array(ocrBlockSchema).default([]),
  meanConfidence: z.number().min(0).max(1),
  provider: z.string(),
  modelVersion: z.string().nullable(),
});
export type OcrResult = z.infer<typeof ocrResultSchema>;

export const declarationRegionSchema = z.object({
  label: z.string(),
  fieldKey: z.string().nullable().default(null),
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
  sourceOccurrenceId: z.string().optional(),
  parseNotes: z.array(z.string()).default([]),
});
export type ExtractedField = z.infer<typeof extractedFieldSchema>;

export const triStateSchema = z.enum(TRI_STATES);

export const packageContextFlagsSchema = z.object({
  retail: triStateSchema,
  wholesale: triStateSchema,
  imported: triStateSchema,
  multiPiece: triStateSchema,
  group: triStateSchema,
  combination: triStateSchema,
  special: triStateSchema,
});
export type PackageContextFlagsContract = z.infer<typeof packageContextFlagsSchema>;

export const packageClassificationSchema = z.object({
  suggestedContext: z.record(z.unknown()),
  flags: packageContextFlagsSchema,
  confidence: z.number().min(0).max(1),
  unknownApplicability: z.boolean(),
  evidenceNotes: z.array(z.string()).default([]),
  provider: z.string(),
  modelVersion: z.string().nullable(),
});
export type PackageClassification = z.infer<typeof packageClassificationSchema>;

export const layeredConfidenceSchema = z.object({
  imageQuality: z.number().min(0).max(1),
  ocr: z.number().min(0).max(1),
  fieldExtraction: z.number().min(0).max(1),
  packageContext: z.number().min(0).max(1),
});
export type LayeredConfidenceContract = z.infer<typeof layeredConfidenceSchema>;

export const imageExtractionResultSchema = z.object({
  imageId: z.string().uuid().nullable(),
  quality: imageQualityResultSchema,
  ocr: ocrResultSchema,
  regions: z.array(declarationRegionSchema),
  fields: z.array(extractedFieldSchema),
});
export type ImageExtractionResult = z.infer<typeof imageExtractionResultSchema>;

export const inspectionExtractionResultSchema = z.object({
  images: z.array(imageExtractionResultSchema),
  fields: z.array(extractedFieldSchema),
  packageClassification: packageClassificationSchema,
  confidence: layeredConfidenceSchema,
  failedSafely: z.boolean(),
  failureReason: z.string().nullable(),
  provider: z.string(),
  modelVersion: z.string().nullable(),
});
export type InspectionExtractionResult = z.infer<typeof inspectionExtractionResultSchema>;

export type ExtractTextInput = {
  imagePath: string;
  mimeType: string;
  imageId?: string;
};

export type DetectDeclarationsInput = {
  imagePath: string;
  mimeType: string;
  ocr: OcrResult;
  imageId?: string;
};

export type ClassifyPackageInput = {
  imagePaths: string[];
  metadata: Record<string, unknown>;
  ocrTexts?: string[];
};

export type ScoreImageQualityInput = {
  imagePath: string;
  mimeType: string;
};

export type NormalizeDeclarationFieldsInput = {
  fields: Array<{
    fieldKey: string;
    rawValue: string | null;
    confidence?: number;
    panel?: string | null;
    imageId?: string | null;
    box?: BoundingBox | null;
  }>;
};

export interface AiExtractionService {
  scoreImageQuality(input: ScoreImageQualityInput): Promise<ImageQualityResult>;
  extractText(input: ExtractTextInput): Promise<OcrResult>;
  detectDeclarations(input: DetectDeclarationsInput): Promise<DeclarationRegion[]>;
  detectDeclarationRegions?(input: DetectDeclarationsInput): Promise<DeclarationRegion[]>;
  classifyPackage(input: ClassifyPackageInput): Promise<PackageClassification>;
  normalizeDeclarationFields?(input: NormalizeDeclarationFieldsInput): Promise<ExtractedField[]>;
}

export const UNCONFIGURED_AI_PROVIDER = 'unconfigured';
export const LOCAL_CV_PROVIDER = 'local-cv';
export const TEST_FIXTURE_PROVIDER = 'test-fixture';

export const DECLARATION_FIELD_KEY_ENUM = DECLARATION_FIELD_KEYS;
export const PACKAGE_CONTEXT_FLAG_ENUM = PACKAGE_CONTEXT_FLAGS;
