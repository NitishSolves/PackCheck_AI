import { describe, expect, it } from 'vitest';
import { REPORT_DISCLAIMER } from '@packcheck/shared';
import { buildTextPdf } from './pdf.js';

describe('buildTextPdf', () => {
  it('embeds inspection wording and the legal-aid disclaimer', () => {
    const pdf = buildTextPdf('PackCheck AI inspection report', [
      REPORT_DISCLAIMER,
      'Potential non-compliance detected.',
      'Needs verification.',
    ]);
    expect(pdf.subarray(0, 5).toString('latin1')).toBe('%PDF-');
    const text = pdf.toString('latin1');
    expect(text).toContain('Potential non-compliance detected.');
    expect(text).toContain('Needs verification.');
    expect(text).toContain('not a legally binding determination');
    expect(text).not.toMatch(/LEGAL_VIOLATION=true/);
  });
});
