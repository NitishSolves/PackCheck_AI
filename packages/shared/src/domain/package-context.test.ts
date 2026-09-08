import { describe, expect, it } from 'vitest';
import { emptyPackageContextFlags, hasUnknownApplicability } from './package-context.js';
import { asTriState } from './tri-state.js';
import { clampConfidence, isLowConfidence, meanConfidence } from './confidence.js';
import { assertNoLegalVerdict, containsForbiddenLegalVerdict } from '../errors/ai.js';

describe('package context tri-state', () => {
  it('keeps true, false, and unknown distinct', () => {
    const flags = emptyPackageContextFlags();
    expect(flags.imported).toBe('unknown');
    expect(hasUnknownApplicability(flags)).toBe(true);
    flags.imported = 'true';
    flags.retail = 'false';
    expect(flags.imported).not.toBe(flags.retail);
    expect(asTriState('maybe')).toBe('unknown');
    expect(hasUnknownApplicability(flags)).toBe(true);
  });
});

describe('confidence layers', () => {
  it('clamps and averages independently of legal outcomes', () => {
    expect(clampConfidence(1.4)).toBe(1);
    expect(clampConfidence(Number.NaN)).toBe(0);
    expect(meanConfidence([0.2, 0.8])).toBeCloseTo(0.5);
    expect(isLowConfidence(0.4, 0.6)).toBe(true);
    expect(isLowConfidence(0.9, 0.6)).toBe(false);
  });
});

describe('AI legal-verdict rejection', () => {
  it('detects forbidden legal verdict keys', () => {
    expect(containsForbiddenLegalVerdict({ LEGAL_VIOLATION: true })).toBe(true);
    expect(containsForbiddenLegalVerdict({ fields: [{ rawValue: 'MRP 10' }] })).toBe(false);
    expect(() => assertNoLegalVerdict({ legalVerdict: 'illegal' })).toThrow(/legal verdict/i);
  });
});
