import { describe, expect, it } from 'vitest';
import { canTransitionInspectionStatus, reviewerStateForDecision } from './inspection.js';

describe('inspection lifecycle', () => {
  it('allows draft to images_uploaded and rejects skipping to finalized', () => {
    expect(canTransitionInspectionStatus('draft', 'images_uploaded')).toBe(true);
    expect(canTransitionInspectionStatus('draft', 'finalized')).toBe(false);
    expect(canTransitionInspectionStatus('finalized', 'draft')).toBe(false);
    expect(canTransitionInspectionStatus('review_pending', 'review_pending')).toBe(true);
    expect(canTransitionInspectionStatus('review_pending', 'finalized')).toBe(true);
  });

  it('maps reviewer decisions to reviewer state without a note-only action', () => {
    expect(reviewerStateForDecision('confirm')).toBe('confirmed');
    expect(reviewerStateForDecision('reject')).toBe('rejected');
    expect(reviewerStateForDecision('edit')).toBe('edited');
  });
});
