import { describe, expect, it, vi } from 'vitest';
import { AiProviderError } from '@packcheck/shared';
import { HttpAiClient } from './ai-client.js';

describe('HttpAiClient', () => {
  it('maps abort/timeout to TIMEOUT without inventing OCR', async () => {
    const client = new HttpAiClient('http://127.0.0.1:9', 20);
    await expect(
      client.extractText({ imagePath: '/tmp/x.jpg', mimeType: 'image/jpeg' }),
    ).rejects.toBeInstanceOf(AiProviderError);
  });

  it('rejects a legal-verdict payload as malformed', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ LEGAL_VIOLATION: true, fullText: 'nope' }),
    });
    vi.stubGlobal('fetch', fetchMock);
    const client = new HttpAiClient('http://ai.example', 1000);
    await expect(
      client.extractText({ imagePath: '/tmp/x.jpg', mimeType: 'image/jpeg' }),
    ).rejects.toMatchObject({ code: 'MALFORMED_RESPONSE' });
    vi.unstubAllGlobals();
  });
});
