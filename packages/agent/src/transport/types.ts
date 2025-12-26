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
  provider: z.enum(['openai', 'anthropic']),
  model: z.string(),
  tokens: TokenUsageSchema,
  cost: z.number().nonnegative(),
  latency: z.number().int().nonnegative(),
  status: z.enum(['success', 'error']),
  error: z.string().optional(),
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
