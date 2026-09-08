export const CONFIDENCE_LAYERS = [
  'imageQuality',
  'ocr',
  'fieldExtraction',
  'packageContext',
] as const;
export type ConfidenceLayer = (typeof CONFIDENCE_LAYERS)[number];

export type LayeredConfidence = Record<ConfidenceLayer, number>;

export const DEFAULT_CONFIDENCE_THRESHOLDS = {
  imageQuality: 0.5,
  ocr: 0.6,
  fieldExtraction: 0.5,
  packageContext: 0.5,
} as const;

export function clampConfidence(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  if (value < 0) {
    return 0;
  }
  if (value > 1) {
    return 1;
  }
  return value;
}

export function meanConfidence(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }
  const total = values.reduce((sum, value) => sum + clampConfidence(value), 0);
  return clampConfidence(total / values.length);
}

export function isLowConfidence(value: number, threshold: number): boolean {
  return clampConfidence(value) < threshold;
}

export function emptyLayeredConfidence(): LayeredConfidence {
  return {
    imageQuality: 0,
    ocr: 0,
    fieldExtraction: 0,
    packageContext: 0,
  };
}
