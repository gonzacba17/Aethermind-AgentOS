import { z } from 'zod';

/**
 * Configuration schema for Aethermind SDK
 */
export const AethermindConfigSchema = z.object({
  apiKey: z.string().min(1, 'API key is required'),
  endpoint: z.string().url().default('https://api.aethermind.io'),
  flushInterval: z.number().positive().default(5000), // 5 seconds
  batchSize: z.number().positive().max(1000).default(50),
  enabled: z.boolean().default(true),
  agentId: z.string().optional(),
  agentName: z.string().optional(),
  workflowId: z.string().optional(),
  traceId: z.string().optional(),
});

export type AethermindConfig = z.infer<typeof AethermindConfigSchema>;

/**
 * Global configuration instance
 */
let globalConfig: AethermindConfig | null = null;

/**
 * Initialize Aethermind SDK with configuration
 *
 * @example
 * ```typescript
 * initAethermind({
 *   apiKey: process.env.AETHERMIND_API_KEY!,
 * });
 * ```
 */
export function initAethermind(config: Partial<AethermindConfig> & { apiKey: string }): void {
  // Validate and merge with defaults
  const validated = AethermindConfigSchema.parse(config);

  globalConfig = validated;

  if (!validated.enabled) {
    console.log('[Aethermind] SDK initialized but disabled');
    return;
  }

  // Deferred setup: discover SDKs via dynamic import, then instrument
  setupInterceptors().catch((error) => {
    console.error('[Aethermind] Failed to initialize:', error);
  });
}

/**
 * Try to dynamically load a module. Returns null if not installed.
 * Works in both CJS (compiled to require) and ESM (native import).
 */
async function tryLoadModule(name: string): Promise<any> {
  try {
    return await import(name);
  } catch {
    return null;
  }
}

async function setupInterceptors(): Promise<void> {
  const [
    { OpenAIInterceptor, AnthropicInterceptor, GeminiInterceptor, FetchInterceptor },
    { getTransport },
  ] = await Promise.all([
    import('../interceptors/index.js'),
    import('../transport/BatchTransport.js'),
  ]);

  const transport = getTransport();
  const sendEvent = (event: any) => {
    transport.send(event);
  };

  // Discover user's SDK installations (fail silently if not installed)
  const [openaiMod, anthropicMod] = await Promise.all([
    tryLoadModule('openai'),
    tryLoadModule('@anthropic-ai/sdk'),
  ]);
  const geminiMod = await tryLoadModule('@google/generative-ai')
    || await tryLoadModule('@google/genai');

  // Create and instrument interceptors, passing discovered SDK modules
  new OpenAIInterceptor(sendEvent).instrument(openaiMod);
  new AnthropicInterceptor(sendEvent).instrument(anthropicMod);
  new GeminiInterceptor(sendEvent).instrument(geminiMod);
  new FetchInterceptor(sendEvent).instrument();

  console.log('[Aethermind] SDK initialized successfully');
}

/**
 * Get current configuration
 * @throws Error if SDK not initialized
 */
export function getConfig(): AethermindConfig {
  if (!globalConfig) {
    throw new Error('Aethermind SDK not initialized. Call initAethermind() first.');
  }
  return globalConfig;
}

/**
 * Check if SDK is initialized
 */
export function isInitialized(): boolean {
  return globalConfig !== null;
}
