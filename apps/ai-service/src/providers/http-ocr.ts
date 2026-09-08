import {
  AiProviderError,
  assertNoLegalVerdict,
  ocrResultSchema,
  type ExtractTextInput,
  type OcrResult,
} from '@packcheck/shared';
import { withTimeout } from './timeout.js';
import type { OcrProvider } from './types.js';

export class HttpJsonOcrProvider implements OcrProvider {
  readonly name: string;
  readonly modelVersion: string | null;

  constructor(
    private readonly endpoint: string,
    private readonly apiKey: string,
    private readonly timeoutMs: number,
    name = 'http-ocr',
    modelVersion: string | null = null,
  ) {
    this.name = name;
    this.modelVersion = modelVersion;
  }

  async extractText(input: ExtractTextInput): Promise<OcrResult> {
    if (!this.apiKey) {
      throw new AiProviderError('MISSING_CREDENTIALS', 'OCR HTTP provider is missing USER_LLM_API_KEY');
    }
    const request = fetch(this.endpoint, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        imagePath: input.imagePath,
        mimeType: input.mimeType,
        imageId: input.imageId,
      }),
    }).then(async (response) => {
      if (!response.ok) {
        throw new AiProviderError('PROVIDER_ERROR', `OCR HTTP provider returned ${response.status}`, response.status >= 500);
      }
      return response.json() as Promise<unknown>;
    });

    let payload: unknown;
    try {
      payload = await withTimeout(request, this.timeoutMs, 'http-ocr');
    } catch (error) {
      if (error instanceof AiProviderError) {
        throw error;
      }
      throw new AiProviderError('PROVIDER_ERROR', error instanceof Error ? error.message : 'OCR HTTP provider failed');
    }

    assertNoLegalVerdict(payload);
    const parsed = ocrResultSchema.safeParse(payload);
    if (!parsed.success) {
      throw new AiProviderError('MALFORMED_RESPONSE', 'OCR HTTP provider returned a payload that is not evidence OCR');
    }
    return parsed.data;
  }
}
