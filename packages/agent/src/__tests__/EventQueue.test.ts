import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { EventQueue } from '../queue/EventQueue.js';
import type { TelemetryEvent } from '../transport/types.js';

// Mock fs module
vi.mock('fs');

describe('EventQueue', () => {
  const mockSendBatch = vi.fn();
  const testStorageDir = '.aethermind-test';

  const createTestEvent = (overrides: Partial<TelemetryEvent> = {}): TelemetryEvent => ({
    timestamp: new Date().toISOString(),
    provider: 'openai',
    model: 'gpt-4',
    tokens: {
      promptTokens: 100,
      completionTokens: 50,
      totalTokens: 150,
    },
    cost: 0.0045,
    latency: 500,
    status: 'success',
    ...overrides,
  });

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock fs functions
    vi.mocked(fs.existsSync).mockReturnValue(false);
    vi.mocked(fs.mkdirSync).mockReturnValue(undefined);
    vi.mocked(fs.readFileSync).mockReturnValue('');
    vi.mocked(fs.writeFileSync).mockReturnValue(undefined);
    vi.mocked(fs.appendFileSync).mockReturnValue(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('initialization', () => {
    it('should create storage directory if it does not exist', () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);

      new EventQueue(mockSendBatch, { storageDir: testStorageDir });

      expect(fs.mkdirSync).toHaveBeenCalledWith(testStorageDir, { recursive: true });
    });

    it('should not create directory if it already exists', () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);

      new EventQueue(mockSendBatch, { storageDir: testStorageDir });

      expect(fs.mkdirSync).not.toHaveBeenCalled();
    });

    it('should load existing stats from file', () => {
      const existingStats = {
        queuedCount: 5,
        readyCount: 3,
        deadCount: 1,
        processedCount: 100,
        failedCount: 2,
        lastFlushAt: '2026-01-27T10:00:00Z',
        lastErrorAt: '2026-01-27T09:00:00Z',
      };

      vi.mocked(fs.existsSync).mockImplementation((p) => {
        return String(p).includes('queue-stats.json');
      });
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(existingStats));

      const queue = new EventQueue(mockSendBatch, { storageDir: testStorageDir });
      const stats = queue.getStats();

      expect(stats.processedCount).toBe(100);
      expect(stats.failedCount).toBe(2);
    });
  });

  describe('enqueue', () => {
    it('should add event to queue file', () => {
      const queue = new EventQueue(mockSendBatch, { storageDir: testStorageDir });
      const event = createTestEvent();
      const error = new Error('Network error');

      queue.enqueue(event, error);

      expect(fs.appendFileSync).toHaveBeenCalled();
      const appendCall = vi.mocked(fs.appendFileSync).mock.calls[0];
      const writtenData = JSON.parse(appendCall[1] as string);

      expect(writtenData.event).toEqual(event);
      expect(writtenData.lastError).toBe('Network error');
      expect(writtenData.retryCount).toBe(0);
    });

    it('should drop events when queue is full', () => {
      const onQueueFull = vi.fn();
      const queue = new EventQueue(
        mockSendBatch,
        { storageDir: testStorageDir, maxQueueSize: 2 },
        { onQueueFull }
      );

      // Mock queue size
      vi.mocked(fs.readFileSync).mockReturnValue('{"id":"1"}\n{"id":"2"}\n');
      vi.mocked(fs.existsSync).mockReturnValue(true);

      const event = createTestEvent();
      queue.enqueue(event, new Error('test'));

      expect(onQueueFull).toHaveBeenCalledWith(2);
      // Should not append when full
      expect(fs.appendFileSync).not.toHaveBeenCalled();
    });
  });

  describe('processQueue', () => {
    it('should process ready events and call sendBatch', async () => {
      const queue = new EventQueue(mockSendBatch, {
        storageDir: testStorageDir,
        processBatchSize: 10,
      });

      const event = createTestEvent();
      const queueEntry = {
        id: 'test-id-123',
        event,
        queuedAt: new Date().toISOString(),
        retryCount: 0,
        lastError: 'Network error',
        nextRetryAt: new Date(Date.now() - 1000).toISOString(), // Past time = ready
      };

      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(queueEntry) + '\n');
      mockSendBatch.mockResolvedValue(undefined);

      await queue.processQueue();

      expect(mockSendBatch).toHaveBeenCalledWith([event]);
    });

    it('should skip events not ready for retry', async () => {
      const queue = new EventQueue(mockSendBatch, { storageDir: testStorageDir });

      const futureTime = new Date(Date.now() + 60000).toISOString();
      const queueEntry = {
        id: 'test-id-123',
        event: createTestEvent(),
        queuedAt: new Date().toISOString(),
        retryCount: 1,
        lastError: 'Network error',
        nextRetryAt: futureTime, // Future time = not ready
      };

      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(queueEntry) + '\n');

      await queue.processQueue();

      expect(mockSendBatch).not.toHaveBeenCalled();
    });

    it('should move events to dead letter queue after max retries', async () => {
      const onEventFailed = vi.fn();
      const queue = new EventQueue(
        mockSendBatch,
        { storageDir: testStorageDir, maxRetries: 3 },
        { onEventFailed }
      );

      const event = createTestEvent();
      const queueEntry = {
        id: 'test-id-123',
        event,
        queuedAt: new Date().toISOString(),
        retryCount: 2, // Will become 3 after this failure
        lastError: 'Previous error',
        nextRetryAt: new Date(Date.now() - 1000).toISOString(),
      };

      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(queueEntry) + '\n');
      mockSendBatch.mockRejectedValue(new Error('Still failing'));

      await queue.processQueue();

      // Should write to dead events file
      const deadFileWriteCalls = vi.mocked(fs.appendFileSync).mock.calls.filter(
        call => String(call[0]).includes('dead-events')
      );
      expect(deadFileWriteCalls.length).toBe(1);

      expect(onEventFailed).toHaveBeenCalled();
    });

    it('should call onEventProcessed callback on success', async () => {
      const onEventProcessed = vi.fn();
      const queue = new EventQueue(
        mockSendBatch,
        { storageDir: testStorageDir },
        { onEventProcessed }
      );

      const event = createTestEvent();
      const queueEntry = {
        id: 'test-id-123',
        event,
        queuedAt: new Date().toISOString(),
        retryCount: 0,
        nextRetryAt: new Date(Date.now() - 1000).toISOString(),
      };

      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(queueEntry) + '\n');
      mockSendBatch.mockResolvedValue(undefined);

      await queue.processQueue();

      expect(onEventProcessed).toHaveBeenCalledWith(event);
    });
  });

  describe('getStats', () => {
    it('should return current queue statistics', () => {
      const queue = new EventQueue(mockSendBatch, { storageDir: testStorageDir });

      const stats = queue.getStats();

      expect(stats).toHaveProperty('queuedCount');
      expect(stats).toHaveProperty('readyCount');
      expect(stats).toHaveProperty('deadCount');
      expect(stats).toHaveProperty('processedCount');
      expect(stats).toHaveProperty('failedCount');
    });
  });

  describe('clearQueue', () => {
    it('should clear all queued events', () => {
      const queue = new EventQueue(mockSendBatch, { storageDir: testStorageDir });

      queue.clearQueue();

      // Should write empty content to queue file
      const writeCall = vi.mocked(fs.writeFileSync).mock.calls.find(
        call => String(call[0]).includes('failed-events')
      );
      expect(writeCall).toBeDefined();
      expect(writeCall![1]).toBe('');
    });
  });

  describe('background processing', () => {
    it('should start and stop processing', async () => {
      vi.useFakeTimers();
      const queue = new EventQueue(mockSendBatch, {
        storageDir: testStorageDir,
        processIntervalMs: 1000,
      });

      queue.startProcessing();

      // Fast-forward time
      await vi.advanceTimersByTimeAsync(1000);

      await queue.stopProcessing();
      vi.useRealTimers();
    });
  });
});
