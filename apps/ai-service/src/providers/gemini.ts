import { readFile } from 'node:fs/promises';
import {
  AiProviderError,
  assertNoLegalVerdict,
  type ExtractTextInput,
  type OcrResult,
  type OcrToken,
} from '@packcheck/shared';
import { withTimeout } from './timeout.js';
import type { OcrProvider } from './types.js';

export const GEMINI_OCR_PROVIDER = 'gemini-vision';

type GeminiResponse = {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string;
      }>;
    };
  }>;
};

export class GeminiVisionOcrProvider implements OcrProvider {
  readonly name = GEMINI_OCR_PROVIDER;
  readonly modelVersion: string;

  constructor(
    private readonly apiKeys: string[],
    private readonly timeoutMs = 25_000,
    modelVersion = 'gemini-1.5-flash',
  ) {
    this.modelVersion = modelVersion;
  }

  async extractText(input: ExtractTextInput): Promise<OcrResult> {
    const validKeys = this.apiKeys.filter(Boolean);
    if (validKeys.length === 0) {
      throw new AiProviderError('MISSING_CREDENTIALS', 'No GEMINI_API_KEY provided');
    }

    let imageBase64: string;
    try {
      const buffer = await readFile(input.imagePath);
      imageBase64 = buffer.toString('base64');
    } catch {
      throw new AiProviderError('IMAGE_UNREADABLE', `Could not read image file: ${input.imagePath}`);
    }

    let lastError: Error | null = null;
    for (const apiKey of validKeys) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.modelVersion}:generateContent?key=${apiKey}`;
        const prompt = `You are an OCR extraction engine for packaged consumer commodities.
Transcribe all text on this packaging label accurately line-by-line.
Include all mandatory declarations (Manufacturer, Packer, Importer, Generic Name, Net Quantity, Mfg Date, Expiry/Best Before, MRP, Unit Sale Price, Consumer Care, Country of Origin).
Output plain text lines. Do not add commentary or make legal decisions.`;

        const request = fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  { text: prompt },
                  {
                    inlineData: {
                      mimeType: input.mimeType || 'image/jpeg',
                      data: imageBase64,
                    },
                  },
                ],
              },
            ],
            generationConfig: {
              temperature: 0.1,
              maxOutputTokens: 2048,
            },
          }),
        }).then(async (res) => {
          if (!res.ok) {
            const errText = await res.text().catch(() => '');
            throw new AiProviderError(
              'PROVIDER_ERROR',
              `Gemini API returned ${res.status}: ${errText}`,
              res.status >= 500 || res.status === 429,
            );
          }
          return res.json() as Promise<GeminiResponse>;
        });

        const data = await withTimeout(request, this.timeoutMs, 'gemini-vision');
        const candidateText = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
        if (!candidateText.trim()) {
          throw new AiProviderError('MALFORMED_RESPONSE', 'Gemini returned empty text response');
        }

        const lines = candidateText.split('\n').map((l) => l.trim()).filter(Boolean);
        const tokens: OcrToken[] = [];
        let yPos = 40;

        for (const line of lines) {
          const words = line.split(/\s+/).filter(Boolean);
          let xPos = 40;
          for (const word of words) {
            const width = Math.max(word.length * 8, 20);
            tokens.push({
              text: word,
              confidence: 0.92,
              box: { x: xPos, y: yPos, width, height: 16 },
            });
            xPos += width + 6;
          }
          yPos += 24;
        }

        const result: OcrResult = {
          fullText: candidateText,
          tokens,
          blocks: [
            {
              text: candidateText,
              confidence: 0.92,
              box: { x: 20, y: 20, width: 800, height: Math.max(yPos, 400) },
              tokens,
            },
          ],
          meanConfidence: 0.92,
          provider: this.name,
          modelVersion: this.modelVersion,
        };

        assertNoLegalVerdict(result);
        return result;
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
        continue;
      }
    }

    throw (
      lastError ??
      new AiProviderError('PROVIDER_ERROR', 'All configured Gemini API keys failed')
    );
  }
}
