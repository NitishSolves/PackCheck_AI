import { describe, expect, it } from 'vitest';
import type { RuleEngineInput } from '@packcheck/shared';
import { DeterministicRuleEngine } from '../engine.js';

const engine = new DeterministicRuleEngine();

function baseInput(overrides: Partial<RuleEngineInput> = {}): RuleEngineInput {
  return {
    inspectionId: '11111111-1111-1111-1111-111111111111',
    referenceDate: '2026-01-15',
    packageContext: {},
    extractedFields: [],
    selectedRuleVersions: [],
    ...overrides,
  };
}

describe('DeterministicRuleEngine', () => {
  it('does not evaluate unverified or inactive rule versions', () => {
    const result = engine.evaluate(
      baseInput({
        selectedRuleVersions: [
          {
            id: '22222222-2222-2222-2222-222222222222',
            ruleCode: 'R01',
            versionNumber: 1,
            requirementText: 'Placeholder; not verified against official source.',
            validationType: 'FIELD_REQUIRED',
            validationConfig: { fieldKey: 'manufacturer' },
            applicability: {},
            exceptions: {},
            status: 'draft',
            effectiveFrom: '2011-01-01',
            effectiveTo: null,
          },
        ],
      }),
    );

    expect(result.findings[0]?.decision).toBe('REVIEW');
    expect(result.findings[0]?.outcome).toBe('NEEDS_VERIFICATION');
    expect(result.skippedUnverifiedRules).toContain('R01');
  });

  it('maps missing required fields to potential non-compliance, not a legal verdict', () => {
    const result = engine.evaluate(
      baseInput({
        extractedFields: [],
        selectedRuleVersions: [
          {
            id: '33333333-3333-3333-3333-333333333333',
            ruleCode: 'SYNTHETIC_REQUIRED',
            versionNumber: 1,
            requirementText: 'Synthetic test requirement only.',
            validationType: 'FIELD_REQUIRED',
            validationConfig: { fieldKey: 'commodity_name' },
            applicability: {},
            exceptions: {},
            status: 'active',
            effectiveFrom: '2011-01-01',
            effectiveTo: null,
          },
        ],
      }),
    );

    expect(result.findings[0]?.outcome).toBe('POTENTIAL_NON_COMPLIANCE');
    expect(result.findings[0]?.explanation).not.toMatch(/illegal/i);
  });

  it('forces REVIEW when conditional applicability is unknown', () => {
    const result = engine.evaluate(
      baseInput({
        packageContext: {},
        selectedRuleVersions: [
          {
            id: '44444444-4444-4444-4444-444444444444',
            ruleCode: 'SYNTHETIC_CONDITIONAL',
            versionNumber: 1,
            requirementText: 'Synthetic conditional requirement.',
            validationType: 'CONDITIONAL_REQUIRED',
            validationConfig: { whenContextKey: 'imported', fieldKey: 'country_of_origin' },
            applicability: {},
            exceptions: {},
            status: 'active',
            effectiveFrom: '2011-01-01',
            effectiveTo: null,
          },
        ],
      }),
    );

    expect(result.findings[0]?.decision).toBe('REVIEW');
  });
});
