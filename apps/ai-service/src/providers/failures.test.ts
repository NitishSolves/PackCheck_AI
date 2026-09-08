import { describe, expect, it } from 'vitest';
import { AiProviderError } from '@packcheck/shared';
import { HttpJsonOcrProvider } from './http-ocr.js';
import { createAiProvider } from './unconfigured.js';
import { withTimeout } from './timeout.js';

describe('provider failure handling', () => {
  it('refuses unknown providers instead of inventing OCR', () => {
    expect(() => createAiProvider('made-up-model')).toThrow(/Unknown AI provider/);
  });

  it('treats missing HTTP OCR credentials as a safe failure', async () => {
    const provider = new HttpJsonOcrProvider('https://example.invalid/ocr', '', 1000);
    await expect(
      provider.extractText({ imagePath: '/tmp/x.jpg', mimeType: 'image/jpeg' }),
    ).rejects.toMatchObject({ code: 'MISSING_CREDENTIALS' });
  });

  it('maps timeouts to AiProviderError.TIMEOUT', async () => {
    await expect(withTimeout(new Promise(() => undefined), 10, 'ocr')).rejects.toBeInstanceOf(AiProviderError);
    await expect(withTimeout(new Promise(() => undefined), 10, 'ocr')).rejects.toMatchObject({ code: 'TIMEOUT' });
  });
});
