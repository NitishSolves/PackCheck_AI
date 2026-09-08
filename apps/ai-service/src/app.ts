import Fastify from 'fastify';
import cors from '@fastify/cors';
import { z } from 'zod';
import {
  AiProviderError,
  ocrResultSchema,
  type AiExtractionService,
  type InspectionExtractionResult,
} from '@packcheck/shared';
import { EvidenceExtractionPipeline } from './extraction/pipeline.js';

const pathBody = z.object({
  imagePath: z.string().min(1),
  mimeType: z.string().min(1),
  imageId: z.string().uuid().optional(),
  panel: z.string().optional(),
});

function statusFor(error: AiProviderError): number {
  switch (error.code) {
    case 'MISSING_CREDENTIALS':
    case 'UNCONFIGURED':
      return 503;
    case 'TIMEOUT':
      return 504;
    case 'MALFORMED_RESPONSE':
    case 'PROVIDER_ERROR':
      return 502;
    case 'IMAGE_UNREADABLE':
    case 'DECODE_FAILED':
      return 422;
    case 'LOW_CONFIDENCE':
      return 200;
    default:
      return 500;
  }
}

export function buildAiApp(provider: AiExtractionService) {
  const app = Fastify({ logger: true });

  void app.register(cors, { origin: true });

  app.setErrorHandler((error, request, reply) => {
    if (error instanceof AiProviderError) {
      return reply.code(statusFor(error)).send({
        error: {
          code: error.code,
          message: error.message,
          retryable: error.retryable,
        },
      });
    }
    request.log.error({ err: error, msg: 'ai_unhandled_error' });
    return reply.code(500).send({
      error: { code: 'PROVIDER_ERROR', message: 'Internal AI service error' },
    });
  });

  app.get('/health', async () => ({ status: 'ok', service: 'ai' }));

  app.post('/v1/quality', async (request) => {
    const body = pathBody.parse(request.body);
    return provider.scoreImageQuality(body);
  });

  app.post('/v1/ocr', async (request) => {
    const body = pathBody.parse(request.body);
    return provider.extractText(body);
  });

  app.post('/v1/declarations', async (request) => {
    const body = pathBody.extend({ ocr: ocrResultSchema }).parse(request.body);
    return provider.detectDeclarations({
      imagePath: body.imagePath,
      mimeType: body.mimeType,
      ocr: body.ocr,
      imageId: body.imageId,
    });
  });

  app.post('/v1/classify', async (request) => {
    const body = z
      .object({
        imagePaths: z.array(z.string()),
        metadata: z.record(z.unknown()).default({}),
        ocrTexts: z.array(z.string()).optional(),
      })
      .parse(request.body);
    return provider.classifyPackage(body);
  });

  app.post('/v1/normalize', async (request) => {
    const body = z
      .object({
        fields: z.array(
          z.object({
            fieldKey: z.string(),
            rawValue: z.string().nullable(),
            confidence: z.number().min(0).max(1).optional(),
            panel: z.string().nullable().optional(),
            imageId: z.string().uuid().nullable().optional(),
            box: z
              .object({
                x: z.number(),
                y: z.number(),
                width: z.number(),
                height: z.number(),
                imageId: z.string().uuid().optional(),
              })
              .nullable()
              .optional(),
          }),
        ),
      })
      .parse(request.body);
    if (!provider.normalizeDeclarationFields) {
      throw new AiProviderError('UNCONFIGURED', 'normalizeDeclarationFields is not available on this provider');
    }
    return provider.normalizeDeclarationFields(body);
  });

  app.post('/v1/extract', async (request) => {
    const body = pathBody.parse(request.body);
    if (provider instanceof EvidenceExtractionPipeline) {
      return provider.extractImage(body);
    }
    const quality = await provider.scoreImageQuality(body);
    const ocr = await provider.extractText(body);
    const regions = await provider.detectDeclarations({ ...body, ocr });
    return { imageId: body.imageId ?? null, quality, ocr, regions, fields: [] };
  });

  app.post('/v1/extract-inspection', async (request): Promise<InspectionExtractionResult> => {
    const body = z
      .object({
        images: z.array(pathBody),
        metadata: z.record(z.unknown()).default({}),
      })
      .parse(request.body);
    if (provider instanceof EvidenceExtractionPipeline) {
      return provider.extractInspection(body);
    }
    throw new AiProviderError(
      'UNCONFIGURED',
      'Inspection extraction requires a configured evidence pipeline; refusing to invent OCR.',
    );
  });

  return app;
}
