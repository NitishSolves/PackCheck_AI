import {
  UNCONFIGURED_AI_PROVIDER,
  emptyPackageContextFlags,
  type AiExtractionService,
  type AiServiceEnv,
  type ClassifyPackageInput,
  type DetectDeclarationsInput,
  type ExtractTextInput,
  type ScoreImageQualityInput,
} from '@packcheck/shared';
import { EvidenceExtractionPipeline } from '../extraction/pipeline.js';
import { FixtureOcrProvider } from './fixture.js';
import { HttpJsonOcrProvider } from './http-ocr.js';
import { TesseractOcrProvider } from './tesseract.js';
import { GeminiVisionOcrProvider } from './gemini.js';
import { DemoSpecimenOcrProvider } from './demo-specimen.js';

export class UnconfiguredAiProvider implements AiExtractionService {
  readonly provider = UNCONFIGURED_AI_PROVIDER;

  async scoreImageQuality(input: ScoreImageQualityInput) {
    void input;
    return {
      status: 'retake_required' as const,
      score: 0,
      issues: ['AI provider is unconfigured; no image quality model is available.'],
      structuredIssues: [
        { code: 'unreadable' as const, score: 0, detail: 'unconfigured provider' },
      ],
      metrics: null,
      provider: this.provider,
      modelVersion: null,
    };
  }

  async extractText(input: ExtractTextInput) {
    void input;
    return {
      fullText: '',
      tokens: [],
      blocks: [],
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
    const flags = emptyPackageContextFlags();
    return {
      suggestedContext: {},
      flags,
      confidence: 0,
      unknownApplicability: true,
      evidenceNotes: ['AI provider is unconfigured; package context remains unknown.'],
      provider: this.provider,
      modelVersion: null,
    };
  }
}

function pipelineConfig(env: Pick<AiServiceEnv, 'AI_MIN_OCR_CONFIDENCE' | 'AI_MIN_FIELD_CONFIDENCE' | 'AI_MIN_QUALITY_SCORE'>, name: string, modelVersion: string | null) {
  return {
    providerName: name,
    modelVersion,
    minOcrConfidence: env.AI_MIN_OCR_CONFIDENCE,
    minFieldConfidence: env.AI_MIN_FIELD_CONFIDENCE,
    minQualityScore: env.AI_MIN_QUALITY_SCORE,
  };
}

export function createAiProvider(name: string, env?: AiServiceEnv): AiExtractionService {
  const geminiKey = process.env.GEMINI_API_KEY || env?.USER_LLM_API_KEY;
  const geminiKey2 = process.env.GEMINI_API_KEY_SECONDARY || process.env.GEMINI_API_KEY_2;

  const defaults: Pick<AiServiceEnv, 'AI_MIN_OCR_CONFIDENCE' | 'AI_MIN_FIELD_CONFIDENCE' | 'AI_MIN_QUALITY_SCORE' | 'AI_REQUEST_TIMEOUT_MS' | 'TESSERACT_LANG' | 'USER_LLM_API_KEY' | 'USER_LLM_BASE_URL'> = env ?? {
    AI_MIN_OCR_CONFIDENCE: 0.6,
    AI_MIN_FIELD_CONFIDENCE: 0.5,
    AI_MIN_QUALITY_SCORE: 0.5,
    AI_REQUEST_TIMEOUT_MS: 20_000,
    TESSERACT_LANG: 'eng',
    USER_LLM_API_KEY: undefined,
    USER_LLM_BASE_URL: undefined,
  };

  if (name === 'demo' || name === 'demo-specimen') {
    return new EvidenceExtractionPipeline(
      new DemoSpecimenOcrProvider(),
      pipelineConfig(defaults, 'demo-specimen', 'demo-specimen-v1'),
    );
  }

  if (name === 'gemini' || name === 'gemini-vision') {
    if (geminiKey) {
      return new EvidenceExtractionPipeline(
        new GeminiVisionOcrProvider([geminiKey, geminiKey2 ?? ''].filter(Boolean), defaults.AI_REQUEST_TIMEOUT_MS),
        pipelineConfig(defaults, 'gemini-vision', 'gemini-1.5-flash'),
      );
    }
    return new EvidenceExtractionPipeline(
      new DemoSpecimenOcrProvider(),
      pipelineConfig(defaults, 'demo-specimen', 'demo-specimen-v1'),
    );
  }

  if (name === UNCONFIGURED_AI_PROVIDER) {
    if (geminiKey) {
      return new EvidenceExtractionPipeline(
        new GeminiVisionOcrProvider([geminiKey, geminiKey2 ?? ''].filter(Boolean), defaults.AI_REQUEST_TIMEOUT_MS),
        pipelineConfig(defaults, 'gemini-vision', 'gemini-1.5-flash'),
      );
    }
    // In dev / demo fallback mode, provide DemoSpecimen provider
    return new EvidenceExtractionPipeline(
      new DemoSpecimenOcrProvider(),
      pipelineConfig(defaults, 'demo-specimen', 'demo-specimen-v1'),
    );
  }

  if (name === 'test-fixture') {
    return new EvidenceExtractionPipeline(
      new FixtureOcrProvider(),
      pipelineConfig(defaults, 'test-fixture', 'fixture-v1'),
    );
  }

  const ocrName = env?.AI_OCR_PROVIDER ?? name;
  if (ocrName === 'tesseract' || name === 'tesseract' || name === 'local-cv') {
    return new EvidenceExtractionPipeline(
      new TesseractOcrProvider(defaults.TESSERACT_LANG, defaults.AI_REQUEST_TIMEOUT_MS),
      pipelineConfig(defaults, name, 'tesseract-cli'),
    );
  }
  if (ocrName === 'http-ocr' || name === 'http-ocr') {
    return new EvidenceExtractionPipeline(
      new HttpJsonOcrProvider(
        defaults.USER_LLM_BASE_URL ?? '',
        defaults.USER_LLM_API_KEY ?? '',
        defaults.AI_REQUEST_TIMEOUT_MS,
      ),
      pipelineConfig(defaults, 'http-ocr', null),
    );
  }

  return new EvidenceExtractionPipeline(
    new DemoSpecimenOcrProvider(),
    pipelineConfig(defaults, 'demo-specimen', 'demo-specimen-v1'),
  );
}

export function createAiProviderFromEnv(env: AiServiceEnv): AiExtractionService {
  return createAiProvider(env.AI_PROVIDER, env);
}
