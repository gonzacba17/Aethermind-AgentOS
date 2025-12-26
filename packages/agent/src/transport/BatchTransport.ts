import type { TelemetryEvent, IngestionResponse } from './types.js';
import { getConfig } from '../config/index.js';
import { retryWithBackoff } from '../utils/retry.js';

/**
 * Batch transport for sending telemetry events to the ingestion API
 * 
 * Features:
 * - Buffers events up to configured batch size
 * - Auto-flushes on interval or when buffer is full
 * - Retry with exponential backoff
 * - Graceful shutdown (flushes pending events)
 * 
 * @example
 * ```typescript
 * const transport = new BatchTransport();
 * transport.start();
 * 
 * // Events are automatically batched and sent
 * transport.send(event1);
 * transport.send(event2);
 * // ...
 * 
 * // On app shutdown
 * await transport.stop();
 * ```
 */
export class BatchTransport {
  private buffer: TelemetryEvent[] = [];
  private flushTimer: NodeJS.Timeout | null = null;
  private isRunning = false;

  /**
   * Start the transport
   * Begins auto-flush timer
   */
  start(): void {
    if (this.isRunning) {
      console.warn('[Aethermind] BatchTransport already running');
      return;
    }

    this.isRunning = true;
    this.scheduleFlush();

    // Register shutdown handlers
    this.registerShutdownHandlers();

    console.log('[Aethermind] BatchTransport started');
  }

  /**
   * Stop the transport
   * Flushes any pending events
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
    } catch (error) {
      console.error('[Aethermind] Failed to flush events:', error);
      // Events are lost on failure - could implement persistent queue in future
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
