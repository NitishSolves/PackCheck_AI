import Fastify from 'fastify';
import cors from '@fastify/cors';
import { z } from 'zod';
import type { AiExtractionService } from '@packcheck/shared';

const pathBody = z.object({
  imagePath: z.string().min(1),
  mimeType: z.string().min(1),
});

export function buildAiApp(provider: AiExtractionService) {
  const app = Fastify({ logger: true });

  void app.register(cors, { origin: true });

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
    const body = pathBody.extend({ ocr: z.unknown() }).parse(request.body);
    return provider.detectDeclarations({
      imagePath: body.imagePath,
      mimeType: body.mimeType,
      ocr: body.ocr as never,
    });
  });

  app.post('/v1/classify', async (request) => {
    const body = z
      .object({
        imagePaths: z.array(z.string()),
        metadata: z.record(z.unknown()).default({}),
      })
      .parse(request.body);
    return provider.classifyPackage(body);
  });

  return app;
}
