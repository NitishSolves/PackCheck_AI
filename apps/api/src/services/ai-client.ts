import type {
  AiExtractionService,
  ClassifyPackageInput,
  DeclarationRegion,
  DetectDeclarationsInput,
  ExtractTextInput,
  ImageQualityResult,
  OcrResult,
  PackageClassification,
  ScoreImageQualityInput,
} from '@packcheck/shared';

export class HttpAiClient implements AiExtractionService {
  constructor(private readonly baseUrl: string) {}

  async scoreImageQuality(input: ScoreImageQualityInput): Promise<ImageQualityResult> {
    return this.post<ImageQualityResult>('/v1/quality', input);
  }

  async extractText(input: ExtractTextInput): Promise<OcrResult> {
    return this.post<OcrResult>('/v1/ocr', input);
  }

  async detectDeclarations(input: DetectDeclarationsInput): Promise<DeclarationRegion[]> {
    return this.post<DeclarationRegion[]>('/v1/declarations', input);
  }

  async classifyPackage(input: ClassifyPackageInput): Promise<PackageClassification> {
    return this.post<PackageClassification>('/v1/classify', input);
  }

  private async post<T>(path: string, body: unknown): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      throw new Error(`AI service error ${response.status} for ${path}`);
    }
    return (await response.json()) as T;
  }
}
