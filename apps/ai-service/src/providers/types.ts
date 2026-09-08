import type { AiExtractionService, OcrResult, ExtractTextInput } from '@packcheck/shared';

export interface OcrProvider {
  readonly name: string;
  readonly modelVersion: string | null;
  extractText(input: ExtractTextInput): Promise<OcrResult>;
}

export type ProviderBundle = {
  extraction: AiExtractionService;
  ocr: OcrProvider;
};
