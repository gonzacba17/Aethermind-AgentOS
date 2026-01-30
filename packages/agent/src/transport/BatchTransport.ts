import type { TelemetryEvent, IngestionResponse } from './types.js';
import { getConfig } from '../config/index.js';
import { retryWithBackoff } from '../utils/retry.js';
import { EventQueue } from '../queue/EventQueue.js';
import type { EventQueueConfig, QueueStats } from '../queue/types.js';

/**
 * Batch transport configuration
 */
export interface BatchTransportConfig {
  /** Enable Dead Letter Queue for failed events (default: true) */
  enableDLQ: boolean;
  /** DLQ configuration overrides */
  dlqConfig?: Partial<EventQueueConfig>;
  /** Callback when events are successfully sent */
  onSuccess?: (count: number) => void;
  /** Callback when events fail permanently */
  onFailure?: (events: TelemetryEvent[], error: Error) => void;
}

const DEFAULT_TRANSPORT_CONFIG: BatchTransportConfig = {
  enableDLQ: true,
};

/**
 * Batch transport for sending telemetry events to the ingestion API
 *
 * Features:
 * - Buffers events up to configured batch size
 * - Auto-flushes on interval or when buffer is full
 * - Retry with exponential backoff
 * - Dead Letter Queue for failed events (file persistence)
 * - Graceful shutdown (flushes pending events)
 *
 * @example
 * ```typescript
 * const transport = new BatchTransport({
 *   enableDLQ: true,
 *   onSuccess: (count) => console.log(`Sent ${count} events`),
 *   onFailure: (events, error) => console.error('Failed:', error)
 * });
 * transport.start();
 *
 * // Events are automatically batched and sent
 * transport.send(event1);
 * transport.send(event2);
 *
 * // On app shutdown
 * await transport.stop();
 * ```
 */
export class BatchTransport {
  private buffer: TelemetryEvent[] = [];
  private flushTimer: NodeJS.Timeout | null = null;
  private isRunning = false;
  private transportConfig: BatchTransportConfig;
  private eventQueue: EventQueue | null = null;

  constructor(config: Partial<BatchTransportConfig> = {}) {
    this.transportConfig = { ...DEFAULT_TRANSPORT_CONFIG, ...config };
  }

  /**
   * Start the transport
   * Begins auto-flush timer and DLQ processing
   */
  start(): void {
    if (this.isRunning) {
      console.warn('[Aethermind] BatchTransport already running');
      return;
    }

    this.isRunning = true;

    // Initialize Dead Letter Queue if enabled
    if (this.transportConfig.enableDLQ) {
      this.initializeDLQ();
    }

    this.scheduleFlush();
    this.registerShutdownHandlers();

    console.log('[Aethermind] BatchTransport started', {
      dlqEnabled: this.transportConfig.enableDLQ,
    });
  }

  /**
   * Stop the transport
   * Flushes any pending events and stops DLQ processing
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    this.isRunning = false;

    // Clear timer
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }

    // Flush remaining events
    await this.flush();

    // Stop DLQ processing
    if (this.eventQueue) {
      await this.eventQueue.stopProcessing();
    }

    console.log('[Aethermind] BatchTransport stopped');
  }

  /**
   * Add event to buffer
   * Triggers immediate flush if buffer is full
   */
  send(event: TelemetryEvent): void {
    if (!this.isRunning) {
      console.warn('[Aethermind] Cannot send event, transport not running');
      return;
    }

    const config = getConfig();

    this.buffer.push(event);

    // Flush if buffer is full
    if (this.buffer.length >= config.batchSize) {
      void this.flush();
    }
  }

  /**
   * Get DLQ statistics
   */
  getQueueStats(): QueueStats | null {
    return this.eventQueue?.getStats() ?? null;
  }

  /**
   * Manually trigger DLQ processing
   */
  async processQueue(): Promise<void> {
    if (this.eventQueue) {
      await this.eventQueue.processQueue();
    }
  }

  /**
   * Flush all buffered events to the API
   */
  private async flush(): Promise<void> {
    if (this.buffer.length === 0) {
      return;
    }

    // Swap buffer to avoid race conditions
    const eventsToSend = this.buffer;
    this.buffer = [];

    try {
      await this.sendBatch(eventsToSend);
      console.log(`[Aethermind] Flushed ${eventsToSend.length} events`);
      this.transportConfig.onSuccess?.(eventsToSend.length);
    } catch (error) {
      const err = error as Error;
      console.error('[Aethermind] Failed to flush events:', err.message);

      // Enqueue to DLQ for later retry
      if (this.eventQueue) {
        for (const event of eventsToSend) {
          this.eventQueue.enqueue(event, err);
        }
        console.log(`[Aethermind] ${eventsToSend.length} events queued for retry`);
      } else {
        // No DLQ - events are lost
        console.error(`[Aethermind] ${eventsToSend.length} events lost (DLQ disabled)`);
        this.transportConfig.onFailure?.(eventsToSend, err);
      }
    }
  }

  /**
   * Send batch of events to ingestion API
   */
  private async sendBatch(events: TelemetryEvent[]): Promise<void> {
    const config = getConfig();

    const sendRequest = async (): Promise<IngestionResponse> => {
      const response = await fetch(`${config.endpoint}/v1/ingest`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': config.apiKey,
        },
        body: JSON.stringify({ events }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `Ingestion API error: ${response.status} - ${errorText}`
        );
      }

      return await response.json() as IngestionResponse;
    };

    // Retry with exponential backoff
    await retryWithBackoff(sendRequest, {
      maxRetries: 3,
      initialDelayMs: 1000,
      maxDelayMs: 10000,
      backoffMultiplier: 2,
    });
  }

  /**
   * Initialize Dead Letter Queue
   */
  private initializeDLQ(): void {
    this.eventQueue = new EventQueue(
      async (events) => {
        await this.sendBatch(events);
      },
      {
        debug: process.env['AETHERMIND_DEBUG'] === 'true',
        ...this.transportConfig.dlqConfig,
      },
      {
        onEventProcessed: (event) => {
          console.log('[Aethermind] Queued event sent successfully');
          this.transportConfig.onSuccess?.(1);
        },
        onEventFailed: (entry, error) => {
          console.error('[Aethermind] Event failed permanently after retries:', error.message);
          this.transportConfig.onFailure?.([entry.event], error);
        },
        onQueueFull: (size) => {
          console.warn(`[Aethermind] DLQ full (${size} events), dropping new events`);
        },
      }
    );

    // Start background processing of queued events
    this.eventQueue.startProcessing();
  }

  /**
   * Schedule next auto-flush
   */
  private scheduleFlush(): void {
    if (!this.isRunning) {
      return;
    }

    const config = getConfig();

    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
    }

    this.flushTimer = setTimeout(() => {
      void this.flush();
      this.scheduleFlush();
    }, config.flushInterval);
  }

  /**
   * Register shutdown handlers to flush pending events
   */
  private registerShutdownHandlers(): void {
    const shutdown = () => {
      console.log('[Aethermind] Shutting down, flushing pending events...');
      void this.stop();
    };

    // Handle various shutdown signals
    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
    process.on('exit', shutdown);
  }
}

/**
 * Global transport instance
 */
let globalTransport: BatchTransport | null = null;

/**
 * Get or create the global transport instance
 */
export function getTransport(): BatchTransport {
  if (!globalTransport) {
    globalTransport = new BatchTransport();
    globalTransport.start();
  }
  return globalTransport;
}

/**
 * Create a custom transport with specific configuration
 */
export function createTransport(config?: Partial<BatchTransportConfig>): BatchTransport {
  return new BatchTransport(config);
}
