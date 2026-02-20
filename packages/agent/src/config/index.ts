import { z } from 'zod';

/**
 * Configuration schema for Aethermind SDK
 */
export const AethermindConfigSchema = z.object({
  apiKey: z.string().min(1, 'API key is required'),
  endpoint: z.string().url().default('https://api.aethermind.io'),
  flushInterval: z.number().positive().default(30000), // 30 seconds
  batchSize: z.number().positive().max(1000).default(50),
  enabled: z.boolean().default(true),
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
  
  // Import interceptors and transport dynamically to avoid circular deps
  import('../interceptors/index.js').then(({ OpenAIInterceptor, AnthropicInterceptor, FetchInterceptor }) => {
    import('../transport/BatchTransport.js').then(({ getTransport }) => {
      const transport = getTransport();

      const sendEvent = (event: any) => {
        transport.send(event);
      };

      // Create interceptors with callback to transport
      const openaiInterceptor = new OpenAIInterceptor(sendEvent);
      const anthropicInterceptor = new AnthropicInterceptor(sendEvent);
      const fetchInterceptor = new FetchInterceptor(sendEvent);

      // Instrument SDKs and global fetch
      openaiInterceptor.instrument();
      anthropicInterceptor.instrument();
      fetchInterceptor.instrument();

      console.log('[Aethermind] SDK initialized successfully');
    }).catch((error) => {
      console.error('[Aethermind] Failed to initialize transport:', error);
    });
  }).catch((error) => {
    console.error('[Aethermind] Failed to initialize interceptors:', error);
  });
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
