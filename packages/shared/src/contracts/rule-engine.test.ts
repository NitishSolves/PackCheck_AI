import { describe, expect, it } from 'vitest';
import { engineDecisionToFindingOutcome } from '../domain/outcomes.js';
import { canActivateRule } from '../domain/regulatory.js';

describe('legal safety mappings', () => {
  it('maps engine ISSUE to potential non-compliance, never a legal verdict', () => {
    expect(engineDecisionToFindingOutcome('ISSUE')).toBe('POTENTIAL_NON_COMPLIANCE');
    expect(engineDecisionToFindingOutcome('REVIEW')).toBe('NEEDS_VERIFICATION');
  });

  it('refuses to activate unverified rules', () => {
    expect(canActivateRule('draft', false)).toBe(false);
    expect(canActivateRule('proposed', false)).toBe(false);
    expect(canActivateRule('active', false)).toBe(false);
    expect(canActivateRule('verified', true)).toBe(true);
  });
});
