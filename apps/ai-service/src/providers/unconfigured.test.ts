import { describe, expect, it } from 'vitest';
import { UnconfiguredAiProvider } from './unconfigured.js';

describe('UnconfiguredAiProvider', () => {
  const provider = new UnconfiguredAiProvider();

  it('does not invent OCR text', async () => {
    const result = await provider.extractText({ imagePath: '/tmp/x.jpg', mimeType: 'image/jpeg' });
    expect(result.fullText).toBe('');
    expect(result.tokens).toEqual([]);
    expect(result.provider).toBe('unconfigured');
  });

  it('marks package applicability unknown instead of guessing', async () => {
    const result = await provider.classifyPackage({ imagePaths: [], metadata: {} });
    expect(result.unknownApplicability).toBe(true);
    expect(result.suggestedContext).toEqual({});
  });
});
