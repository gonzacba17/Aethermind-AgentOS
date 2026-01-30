import { z } from 'zod';
import type { TelemetryEvent } from '../transport/types.js';

/**
 * Failed Event Entry Schema
 * Represents an event that failed to be sent and is persisted for retry
 */
export const FailedEventEntrySchema = z.object({
  /** Unique identifier for this entry */
  id: z.string().uuid(),
  /** The original telemetry event */
  event: z.object({
    timestamp: z.string().datetime(),
    provider: z.enum(['openai', 'anthropic']),
    model: z.string(),
    tokens: z.object({
      promptTokens: z.number().int().nonnegative(),
      completionTokens: z.number().int().nonnegative(),
      totalTokens: z.number().int().nonnegative(),
    }),
    cost: z.number().nonnegative(),
    latency: z.number().int().nonnegative(),
    status: z.enum(['success', 'error']),
    error: z.string().optional(),
  }),
  /** When the event was added to the queue */
  queuedAt: z.string().datetime(),
  /** Number of retry attempts */
  retryCount: z.number().int().nonnegative(),
  /** Last error message */
  lastError: z.string().optional(),
  /** When the event should next be retried */
  nextRetryAt: z.string().datetime().optional(),
});

export type FailedEventEntry = z.infer<typeof FailedEventEntrySchema>;

/**
 * Event Queue Statistics
 */
export interface QueueStats {
  /** Total events in queue */
  queuedCount: number;
  /** Events ready for retry */
  readyCount: number;
  /** Events that exceeded max retries */
  deadCount: number;
  /** Total events processed (sent successfully) */
  processedCount: number;
  /** Total events failed permanently */
  failedCount: number;
  /** Last successful flush timestamp */
  lastFlushAt: string | null;
  /** Last error timestamp */
  lastErrorAt: string | null;
}

/**
 * Event Queue Configuration
 */
export interface EventQueueConfig {
  /** Directory to store failed events (default: .aethermind) */
  storageDir: string;
  /** Maximum number of events to store (default: 10000) */
  maxQueueSize: number;
  /** Maximum retry attempts per event (default: 5) */
  maxRetries: number;
  /** Base delay between retries in ms (default: 60000 - 1 minute) */
  retryBaseDelayMs: number;
  /** Maximum retry delay in ms (default: 3600000 - 1 hour) */
  maxRetryDelayMs: number;
  /** Interval to attempt processing queued events (default: 300000 - 5 minutes) */
  processIntervalMs: number;
  /** Maximum events to process per batch (default: 100) */
  processBatchSize: number;
  /** Enable debug logging (default: false) */
  debug: boolean;
}

/**
 * Default queue configuration
 */
export const DEFAULT_QUEUE_CONFIG: EventQueueConfig = {
  storageDir: '.aethermind',
  maxQueueSize: 10000,
  maxRetries: 5,
  retryBaseDelayMs: 60 * 1000,        // 1 minute
  maxRetryDelayMs: 60 * 60 * 1000,    // 1 hour
  processIntervalMs: 5 * 60 * 1000,   // 5 minutes
  processBatchSize: 100,
  debug: false,
};

/**
 * Callback types for queue events
 */
export type OnEventProcessed = (event: TelemetryEvent) => void;
export type OnEventFailed = (entry: FailedEventEntry, error: Error) => void;
export type OnQueueFull = (queueSize: number) => void;
