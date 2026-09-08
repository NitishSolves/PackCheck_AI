import {
  UNCONFIGURED_AI_PROVIDER,
  type AiExtractionService,
  type ClassifyPackageInput,
  type DetectDeclarationsInput,
  type ExtractTextInput,
  type ScoreImageQualityInput,
} from '@packcheck/shared';

export class UnconfiguredAiProvider implements AiExtractionService {
  readonly provider = UNCONFIGURED_AI_PROVIDER;

  async scoreImageQuality(input: ScoreImageQualityInput) {
    void input;
    return {
      status: 'retake_required' as const,
      score: 0,
      issues: ['AI provider is unconfigured; no image quality model is available.'],
      provider: this.provider,
      modelVersion: null,
    };
  }

  async extractText(input: ExtractTextInput) {
    void input;
    return {
      fullText: '',
      tokens: [],
      meanConfidence: 0,
      provider: this.provider,
      modelVersion: null,
    };
  }

  async detectDeclarations(input: DetectDeclarationsInput) {
    void input;
    return [];
  }

  async classifyPackage(input: ClassifyPackageInput) {
    void input;
    return {
      suggestedContext: {},
      confidence: 0,
      unknownApplicability: true,
      provider: this.provider,
      modelVersion: null,
    };
  }
}

export function createAiProvider(name: string): AiExtractionService {
  if (name === UNCONFIGURED_AI_PROVIDER) {
    return new UnconfiguredAiProvider();
  }
  throw new Error(
    `Unknown AI provider "${name}". Wire a real provider behind AiExtractionService; do not invent detections.`,
  );
}
