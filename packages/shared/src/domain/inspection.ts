export const INSPECTION_STATUSES = [
  'draft',
  'images_uploaded',
  'quality_failed',
  'extracting',
  'extraction_review',
  'context_pending',
  'evaluating',
  'review_pending',
  'finalized',
] as const;
export type InspectionStatus = (typeof INSPECTION_STATUSES)[number];

export const IMAGE_QUALITY_STATUSES = ['accepted', 'retake_required', 'pending'] as const;
export type ImageQualityStatus = (typeof IMAGE_QUALITY_STATUSES)[number];

export const REVIEW_DECISIONS = ['confirm', 'reject', 'not_applicable', 'edit'] as const;
export type ReviewDecision = (typeof REVIEW_DECISIONS)[number];
