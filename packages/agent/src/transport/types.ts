import { z } from 'zod';

/**
 * Token usage information
 */
export const TokenUsageSchema = z.object({
  promptTokens: z.number().int().nonnegative(),
  completionTokens: z.number().int().nonnegative(),
  totalTokens: z.number().int().nonnegative(),
});

export type TokenUsage = z.infer<typeof TokenUsageSchema>;

/**
 * Telemetry event schema
 */
export const TelemetryEventSchema = z.object({
  timestamp: z.string().datetime(),
  provider: z.enum(['openai', 'anthropic', 'ollama']),
  model: z.string(),
  tokens: TokenUsageSchema,
  cost: z.number().nonnegative(),
  latency: z.number().int().nonnegative(),
  status: z.enum(['success', 'error']),
  error: z.string().optional(),
  agentId: z.string().optional(),
  sessionId: z.string().optional(),
  // Phase 2 — routing metadata
  originalModel: z.string().optional(),
  routedModel: z.string().optional(),
  fallbackUsed: z.boolean().optional(),
  providerFallback: z.boolean().optional(),
  fallbackProvider: z.string().optional(),
  // Phase 3 — cache metadata
  cacheHit: z.boolean().optional(),
  cacheSavedUsd: z.number().optional(),
  // Phase 4 — compression metadata
  compressionApplied: z.boolean().optional(),
  originalTokens: z.number().int().nonnegative().optional(),
  compressedTokens: z.number().int().nonnegative().optional(),
  tokensSaved: z.number().int().nonnegative().optional(),
});

export type TelemetryEvent = z.infer<typeof TelemetryEventSchema>;

/**
 * Batch request payload
 */
export const BatchRequestSchema = z.object({
  events: z.array(TelemetryEventSchema).max(1000),
});

export type BatchRequest = z.infer<typeof BatchRequestSchema>;

/**
 * API response for ingestion
 */
export interface IngestionResponse {
  accepted: number;
  message: string;
}
