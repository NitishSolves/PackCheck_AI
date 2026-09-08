import { loadAiServiceEnv } from '@packcheck/shared';
import { buildAiApp } from './app.js';
import { createAiProviderFromEnv } from './providers/unconfigured.js';

const env = loadAiServiceEnv();
const provider = createAiProviderFromEnv(env);
const app = buildAiApp(provider);

await app.listen({ host: env.AI_SERVICE_HOST, port: env.AI_SERVICE_PORT });
