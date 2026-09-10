import { describe, expect, it } from 'vitest';
import {
  engineDecisionToFindingOutcome,
  findingOutcomeWording,
  overallOutcomeFrom,
  REPORT_DISCLAIMER,
} from '../domain/outcomes.js';
import { reviewerStateForDecision } from '../domain/inspection.js';
import { canActivateRule } from '../domain/regulatory.js';

describe('legal safety mappings', () => {
  it('maps engine ISSUE to potential non-compliance, never a legal verdict', () => {
    expect(engineDecisionToFindingOutcome('ISSUE')).toBe('POTENTIAL_NON_COMPLIANCE');
    expect(engineDecisionToFindingOutcome('REVIEW')).toBe('NEEDS_VERIFICATION');
    expect(findingOutcomeWording('POTENTIAL_NON_COMPLIANCE')).toBe(
      'Potential non-compliance detected.',
    );
    expect(findingOutcomeWording('NEEDS_VERIFICATION')).toBe('Needs verification.');
    expect(REPORT_DISCLAIMER).toMatch(/not a legally binding determination/);
    expect(overallOutcomeFrom([{ outcome: 'POTENTIAL_NON_COMPLIANCE' }])).toBe(
      'POTENTIAL_NON_COMPLIANCE',
    );
    expect(reviewerStateForDecision('confirm')).toBe('confirmed');
    expect(reviewerStateForDecision('not_applicable')).toBe('not_applicable');
  });

  it('refuses to activate unverified rules', () => {
    expect(canActivateRule('draft', false)).toBe(false);
    expect(canActivateRule('proposed', false)).toBe(false);
    expect(canActivateRule('active', false)).toBe(false);
    expect(canActivateRule('verified', true)).toBe(true);
  });
});
