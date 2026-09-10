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

export const INSPECTION_STATUS_TRANSITIONS: Record<InspectionStatus, readonly InspectionStatus[]> =
  {
    draft: ['images_uploaded'],
    images_uploaded: ['quality_failed', 'extracting'],
    quality_failed: ['draft', 'images_uploaded'],
    extracting: ['extraction_review', 'quality_failed'],
    extraction_review: ['context_pending'],
    context_pending: ['evaluating', 'extraction_review'],
    evaluating: ['review_pending'],
    review_pending: ['finalized', 'evaluating'],
    finalized: [],
  };

export function canTransitionInspectionStatus(
  from: InspectionStatus,
  to: InspectionStatus,
): boolean {
  if (from === to) {
    return true;
  }
  return INSPECTION_STATUS_TRANSITIONS[from].includes(to);
}

export const IMAGE_QUALITY_STATUSES = ['accepted', 'retake_required', 'pending'] as const;
export type ImageQualityStatus = (typeof IMAGE_QUALITY_STATUSES)[number];

export const REVIEW_DECISIONS = ['confirm', 'reject', 'not_applicable', 'edit'] as const;
export type ReviewDecision = (typeof REVIEW_DECISIONS)[number];

export const REVIEWER_STATES = [
  'pending',
  'confirmed',
  'rejected',
  'not_applicable',
  'edited',
] as const;
export type ReviewerState = (typeof REVIEWER_STATES)[number];

export function reviewerStateForDecision(decision: ReviewDecision): ReviewerState {
  switch (decision) {
    case 'confirm':
      return 'confirmed';
    case 'reject':
      return 'rejected';
    case 'not_applicable':
      return 'not_applicable';
    case 'edit':
      return 'edited';
  }
}
