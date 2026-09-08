import {
  AiProviderError,
  assertNoLegalVerdict,
  imageQualityResultSchema,
  inspectionExtractionResultSchema,
  ocrResultSchema,
  packageClassificationSchema,
  type AiExtractionService,
  type ClassifyPackageInput,
  type DeclarationRegion,
  type DetectDeclarationsInput,
  type ExtractTextInput,
  type ImageQualityResult,
  type InspectionExtractionResult,
  type OcrResult,
  type PackageClassification,
  type ScoreImageQualityInput,
} from '@packcheck/shared';

export class HttpAiClient implements AiExtractionService {
  constructor(
    private readonly baseUrl: string,
    private readonly timeoutMs = 20_000,
  ) {}

  async scoreImageQuality(input: ScoreImageQualityInput): Promise<ImageQualityResult> {
    const payload = await this.post('/v1/quality', input);
    const parsed = imageQualityResultSchema.safeParse(payload);
    if (!parsed.success) {
      throw new AiProviderError('MALFORMED_RESPONSE', 'AI quality payload failed schema validation');
    }
    return parsed.data;
  }

  async extractText(input: ExtractTextInput): Promise<OcrResult> {
    const payload = await this.post('/v1/ocr', input);
    const parsed = ocrResultSchema.safeParse(payload);
    if (!parsed.success) {
      throw new AiProviderError('MALFORMED_RESPONSE', 'AI OCR payload failed schema validation');
    }
    return parsed.data;
  }

  async detectDeclarations(input: DetectDeclarationsInput): Promise<DeclarationRegion[]> {
    const payload = await this.post('/v1/declarations', input);
    if (!Array.isArray(payload)) {
      throw new AiProviderError('MALFORMED_RESPONSE', 'AI declaration payload was not an array');
    }
    return payload as DeclarationRegion[];
  }

  async classifyPackage(input: ClassifyPackageInput): Promise<PackageClassification> {
    const payload = await this.post('/v1/classify', input);
    const parsed = packageClassificationSchema.safeParse(payload);
    if (!parsed.success) {
      throw new AiProviderError('MALFORMED_RESPONSE', 'AI package classification payload failed schema validation');
    }
    return parsed.data;
  }

  async extractInspection(input: {
    images: Array<{ imagePath: string; mimeType: string; imageId?: string; panel?: string }>;
    metadata?: Record<string, unknown>;
  }): Promise<InspectionExtractionResult> {
    const payload = await this.post('/v1/extract-inspection', input);
    const parsed = inspectionExtractionResultSchema.safeParse(payload);
    if (!parsed.success) {
      throw new AiProviderError('MALFORMED_RESPONSE', 'AI inspection extraction payload failed schema validation');
    }
    return parsed.data;
  }

  private async post(path: string, body: unknown): Promise<unknown> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await fetch(`${this.baseUrl}${path}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      const payload: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        const code =
          payload && typeof payload === 'object' && 'error' in payload
            ? ((payload as { error?: { code?: string } }).error?.code ?? 'PROVIDER_ERROR')
            : 'PROVIDER_ERROR';
        const message =
          payload && typeof payload === 'object' && 'error' in payload
            ? ((payload as { error?: { message?: string } }).error?.message ?? `AI service error ${response.status}`)
            : `AI service error ${response.status} for ${path}`;
        if (code === 'MISSING_CREDENTIALS' || code === 'UNCONFIGURED') {
          throw new AiProviderError('MISSING_CREDENTIALS', message);
        }
        if (code === 'TIMEOUT') {
          throw new AiProviderError('TIMEOUT', message, true);
        }
        if (code === 'MALFORMED_RESPONSE') {
          throw new AiProviderError('MALFORMED_RESPONSE', message);
        }
        throw new AiProviderError('PROVIDER_ERROR', message, response.status >= 500);
      }
      assertNoLegalVerdict(payload);
      return payload;
    } catch (error) {
      if (error instanceof AiProviderError) {
        throw error;
      }
      if (error instanceof Error && error.name === 'AbortError') {
        throw new AiProviderError('TIMEOUT', `AI service timed out for ${path}`, true);
      }
      throw new AiProviderError(
        'PROVIDER_ERROR',
        error instanceof Error ? error.message : `AI service error for ${path}`,
        true,
      );
    } finally {
      clearTimeout(timer);
    }
  }
}
