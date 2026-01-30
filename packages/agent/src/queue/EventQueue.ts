import * as fs from 'fs';
import * as path from 'path';
import { randomUUID } from 'crypto';
import type { TelemetryEvent } from '../transport/types.js';
import type {
  FailedEventEntry,
  EventQueueConfig,
  QueueStats,
  OnEventProcessed,
  OnEventFailed,
  OnQueueFull,
} from './types.js';
import { DEFAULT_QUEUE_CONFIG, FailedEventEntrySchema } from './types.js';

/**
 * Event Queue with File System Persistence (Dead Letter Queue)
 *
 * Provides reliable event delivery by persisting failed events to disk
 * and retrying them with exponential backoff.
 *
 * Features:
 * - File-based persistence (.aethermind/failed-events.jsonl)
 * - Automatic log rotation when file exceeds size limit
 * - Exponential backoff for retries
 * - Configurable max retries before events are marked as dead
 * - Background processing of queued events
 * - Graceful shutdown with state preservation
 *
 * @example
 * ```typescript
 * const queue = new EventQueue({
 *   sendBatch: async (events) => {
 *     await api.ingest(events);
 *   }
 * });
 *
 * // Queue failed events
 * queue.enqueue(event, new Error('Network error'));
 *
 * // Start background processing
 * queue.startProcessing();
 *
 * // On shutdown
 * await queue.stopProcessing();
 * ```
 */
export class EventQueue {
  private config: EventQueueConfig;
  private queueFilePath: string;
  private deadFilePath: string;
  private statsFilePath: string;
  private sendBatch: (events: TelemetryEvent[]) => Promise<void>;
  private processTimer: NodeJS.Timeout | null = null;
  private isProcessing = false;
  private stats: QueueStats;

  // Event callbacks
  private onEventProcessed?: OnEventProcessed;
  private onEventFailed?: OnEventFailed;
  private onQueueFull?: OnQueueFull;

  constructor(
    sendBatch: (events: TelemetryEvent[]) => Promise<void>,
    config: Partial<EventQueueConfig> = {},
    callbacks?: {
      onEventProcessed?: OnEventProcessed;
      onEventFailed?: OnEventFailed;
      onQueueFull?: OnQueueFull;
    }
  ) {
    this.config = { ...DEFAULT_QUEUE_CONFIG, ...config };
    this.sendBatch = sendBatch;

    // Set up callbacks
    this.onEventProcessed = callbacks?.onEventProcessed;
    this.onEventFailed = callbacks?.onEventFailed;
    this.onQueueFull = callbacks?.onQueueFull;

    // Initialize file paths
    const storageDir = this.config.storageDir;
    this.queueFilePath = path.join(storageDir, 'failed-events.jsonl');
    this.deadFilePath = path.join(storageDir, 'dead-events.jsonl');
    this.statsFilePath = path.join(storageDir, 'queue-stats.json');

    // Ensure storage directory exists
    this.ensureStorageDir();

    // Load or initialize stats
    this.stats = this.loadStats();

    this.log('EventQueue initialized', { storageDir, queueFilePath: this.queueFilePath });
  }

  /**
   * Enqueue a failed event for later retry
   */
  enqueue(event: TelemetryEvent, error: Error): void {
    const queueSize = this.getQueueSize();

    // Check queue size limit
    if (queueSize >= this.config.maxQueueSize) {
      this.log('Queue full, dropping event', { queueSize, maxSize: this.config.maxQueueSize });
      this.onQueueFull?.(queueSize);
      return;
    }

    const entry: FailedEventEntry = {
      id: randomUUID(),
      event,
      queuedAt: new Date().toISOString(),
      retryCount: 0,
      lastError: error.message,
      nextRetryAt: this.calculateNextRetry(0),
    };

    this.appendToFile(this.queueFilePath, entry);
    this.stats.queuedCount++;
    this.stats.lastErrorAt = new Date().toISOString();
    this.saveStats();

    this.log('Event enqueued', { id: entry.id, error: error.message });
  }

  /**
   * Start background processing of queued events
   */
  startProcessing(): void {
    if (this.processTimer) {
      this.log('Processing already started');
      return;
    }

    this.log('Starting background processing', { intervalMs: this.config.processIntervalMs });

    // Process immediately on start
    void this.processQueue();

    // Schedule periodic processing
    this.processTimer = setInterval(() => {
      void this.processQueue();
    }, this.config.processIntervalMs);
  }

  /**
   * Stop background processing
   */
  async stopProcessing(): Promise<void> {
    if (this.processTimer) {
      clearInterval(this.processTimer);
      this.processTimer = null;
    }

    // Wait for current processing to complete
    while (this.isProcessing) {
      await this.sleep(100);
    }

    this.saveStats();
    this.log('Background processing stopped');
  }

  /**
   * Process queued events
   */
  async processQueue(): Promise<void> {
    if (this.isProcessing) {
      this.log('Processing already in progress, skipping');
      return;
    }

    this.isProcessing = true;

    try {
      const entries = this.readQueue();
      const now = new Date();

      // Filter entries ready for retry
      const readyEntries = entries.filter(entry => {
        if (!entry.nextRetryAt) return true;
        return new Date(entry.nextRetryAt) <= now;
      });

      if (readyEntries.length === 0) {
        this.log('No events ready for processing');
        return;
      }

      this.log('Processing queued events', { total: entries.length, ready: readyEntries.length });

      // Process in batches
      const batches = this.chunkArray(readyEntries, this.config.processBatchSize);

      for (const batch of batches) {
        await this.processBatch(batch, entries);
      }

      this.stats.lastFlushAt = new Date().toISOString();
      this.saveStats();
    } catch (error) {
      this.log('Error processing queue', { error: (error as Error).message });
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Process a batch of entries
   */
  private async processBatch(batch: FailedEventEntry[], allEntries: FailedEventEntry[]): Promise<void> {
    const events = batch.map(e => e.event);

    try {
      await this.sendBatch(events);

      // Success - remove from queue
      for (const entry of batch) {
        this.stats.processedCount++;
        this.onEventProcessed?.(entry.event);
      }

      // Remove processed entries
      const processedIds = new Set(batch.map(e => e.id));
      const remaining = allEntries.filter(e => !processedIds.has(e.id));
      this.writeQueue(remaining);

      this.log('Batch processed successfully', { count: batch.length });
    } catch (error) {
      // Failure - update retry counts
      const err = error as Error;

      for (const entry of batch) {
        entry.retryCount++;
        entry.lastError = err.message;

        if (entry.retryCount >= this.config.maxRetries) {
          // Move to dead letter queue
          this.appendToFile(this.deadFilePath, entry);
          this.stats.deadCount++;
          this.stats.failedCount++;
          this.onEventFailed?.(entry, err);
          this.log('Event moved to dead letter queue', { id: entry.id, retries: entry.retryCount });
        } else {
          // Schedule next retry
          entry.nextRetryAt = this.calculateNextRetry(entry.retryCount);
          this.log('Event scheduled for retry', {
            id: entry.id,
            retryCount: entry.retryCount,
            nextRetryAt: entry.nextRetryAt,
          });
        }
      }

      // Update queue with new retry info
      const deadIds = new Set(batch.filter(e => e.retryCount >= this.config.maxRetries).map(e => e.id));
      const remaining = allEntries.filter(e => !deadIds.has(e.id));
      this.writeQueue(remaining);
    }
  }

  /**
   * Get current queue statistics
   */
  getStats(): QueueStats {
    const entries = this.readQueue();
    const now = new Date();

    this.stats.queuedCount = entries.length;
    this.stats.readyCount = entries.filter(e => {
      if (!e.nextRetryAt) return true;
      return new Date(e.nextRetryAt) <= now;
    }).length;

    return { ...this.stats };
  }

  /**
   * Clear all queued events (use with caution)
   */
  clearQueue(): void {
    this.writeQueue([]);
    this.stats.queuedCount = 0;
    this.stats.readyCount = 0;
    this.saveStats();
    this.log('Queue cleared');
  }

  /**
   * Get queue size without reading full file
   */
  private getQueueSize(): number {
    try {
      if (!fs.existsSync(this.queueFilePath)) {
        return 0;
      }
      const content = fs.readFileSync(this.queueFilePath, 'utf-8');
      return content.split('\n').filter(line => line.trim()).length;
    } catch {
      return 0;
    }
  }

  /**
   * Read all entries from queue file
   */
  private readQueue(): FailedEventEntry[] {
    try {
      if (!fs.existsSync(this.queueFilePath)) {
        return [];
      }

      const content = fs.readFileSync(this.queueFilePath, 'utf-8');
      const lines = content.split('\n').filter(line => line.trim());

      return lines.map(line => {
        try {
          const parsed = JSON.parse(line);
          return FailedEventEntrySchema.parse(parsed);
        } catch {
          return null;
        }
      }).filter((entry): entry is FailedEventEntry => entry !== null);
    } catch (error) {
      this.log('Error reading queue', { error: (error as Error).message });
      return [];
    }
  }

  /**
   * Write all entries to queue file (overwrites)
   */
  private writeQueue(entries: FailedEventEntry[]): void {
    try {
      const content = entries.map(e => JSON.stringify(e)).join('\n');
      fs.writeFileSync(this.queueFilePath, content ? content + '\n' : '', 'utf-8');
    } catch (error) {
      this.log('Error writing queue', { error: (error as Error).message });
    }
  }

  /**
   * Append single entry to file
   */
  private appendToFile(filePath: string, entry: FailedEventEntry): void {
    try {
      fs.appendFileSync(filePath, JSON.stringify(entry) + '\n', 'utf-8');
    } catch (error) {
      this.log('Error appending to file', { filePath, error: (error as Error).message });
    }
  }

  /**
   * Calculate next retry time with exponential backoff
   */
  private calculateNextRetry(retryCount: number): string {
    const delay = Math.min(
      this.config.retryBaseDelayMs * Math.pow(2, retryCount),
      this.config.maxRetryDelayMs
    );
    return new Date(Date.now() + delay).toISOString();
  }

  /**
   * Ensure storage directory exists
   */
  private ensureStorageDir(): void {
    try {
      if (!fs.existsSync(this.config.storageDir)) {
        fs.mkdirSync(this.config.storageDir, { recursive: true });
        this.log('Created storage directory', { dir: this.config.storageDir });
      }
    } catch (error) {
      console.error('[Aethermind] Failed to create storage directory:', error);
    }
  }

  /**
   * Load stats from file
   */
  private loadStats(): QueueStats {
    try {
      if (fs.existsSync(this.statsFilePath)) {
        const content = fs.readFileSync(this.statsFilePath, 'utf-8');
        return JSON.parse(content);
      }
    } catch (error) {
      this.log('Error loading stats, using defaults', { error: (error as Error).message });
    }

    return {
      queuedCount: 0,
      readyCount: 0,
      deadCount: 0,
      processedCount: 0,
      failedCount: 0,
      lastFlushAt: null,
      lastErrorAt: null,
    };
  }

  /**
   * Save stats to file
   */
  private saveStats(): void {
    try {
      fs.writeFileSync(this.statsFilePath, JSON.stringify(this.stats, null, 2), 'utf-8');
    } catch (error) {
      this.log('Error saving stats', { error: (error as Error).message });
    }
  }

  /**
   * Split array into chunks
   */
  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }

  /**
   * Sleep helper
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Debug logging
   */
  private log(message: string, data?: Record<string, unknown>): void {
    if (this.config.debug) {
      console.log(`[Aethermind:Queue] ${message}`, data ? JSON.stringify(data) : '');
    }
  }
}

export default EventQueue;
