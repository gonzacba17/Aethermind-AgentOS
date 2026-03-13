import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { BatchTransport, createTransport } from '../transport/BatchTransport.js';
import type { TelemetryEvent } from '../transport/types.js';

// Mock the config module
vi.mock('../config/index.js', () => ({
  getConfig: () => ({
    apiKey: 'test-api-key',
    endpoint: 'https://api.test.com',
    batchSize: 10,
    flushInterval: 5000,
  }),
}));

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock EventQueue
vi.mock('../queue/EventQueue.js', () => ({
  EventQueue: vi.fn().mockImplementation(() => ({
    startProcessing: vi.fn(),
    stopProcessing: vi.fn().mockResolvedValue(undefined),
    enqueue: vi.fn(),
    getStats: vi.fn().mockReturnValue({
      queuedCount: 0,
      readyCount: 0,
      deadCount: 0,
      processedCount: 0,
      failedCount: 0,
      lastFlushAt: null,
      lastErrorAt: null,
    }),
    processQueue: vi.fn().mockResolvedValue(undefined),
  })),
}));

describe('BatchTransport', () => {
  let transport: BatchTransport;

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
    vi.useFakeTimers();

    // Default successful fetch response
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ accepted: 1, message: 'ok' }),
    });
  });

  afterEach(async () => {
    if (transport) {
      await transport.stop();
    }
    vi.useRealTimers();
  });

  describe('initialization', () => {
    it('should create transport with default config', () => {
      transport = new BatchTransport();
      expect(transport).toBeDefined();
    });

    it('should create transport with custom config', () => {
      transport = new BatchTransport({
        enableDLQ: false,
        onSuccess: vi.fn(),
        onFailure: vi.fn(),
      });
      expect(transport).toBeDefined();
    });

    it('should create transport using factory function', () => {
      transport = createTransport({ enableDLQ: true });
      expect(transport).toBeDefined();
    });
  });

  describe('start/stop', () => {
    it('should start transport', () => {
      const consoleSpy = vi.spyOn(console, 'log');
      transport = new BatchTransport();

      transport.start();

      expect(consoleSpy).toHaveBeenCalledWith(
        '[Aethermind] BatchTransport started',
        expect.any(Object)
      );
    });

    it('should warn when starting already running transport', () => {
      const consoleSpy = vi.spyOn(console, 'warn');
      transport = new BatchTransport();

      transport.start();
      transport.start();

      expect(consoleSpy).toHaveBeenCalledWith('[Aethermind] BatchTransport already running');
    });

    it('should stop transport and flush pending events', async () => {
      transport = new BatchTransport();
      transport.start();

      const event = createTestEvent();
      transport.send(event);

      await transport.stop();

      expect(mockFetch).toHaveBeenCalled();
    });
  });

  describe('send', () => {
    it('should buffer events', () => {
      transport = new BatchTransport();
      transport.start();

      const event = createTestEvent();
      transport.send(event);

      // Event should be buffered, not sent yet
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should warn when sending to stopped transport', () => {
      const consoleSpy = vi.spyOn(console, 'warn');
      transport = new BatchTransport();
      // Not started

      transport.send(createTestEvent());

      expect(consoleSpy).toHaveBeenCalledWith(
        '[Aethermind] Cannot send event, transport not running'
      );
    });

    it('should auto-flush when batch size is reached', async () => {
      transport = new BatchTransport();
      transport.start();

      // Send 10 events (batch size)
      for (let i = 0; i < 10; i++) {
        transport.send(createTestEvent());
      }

      // Allow async operations to complete
      await vi.advanceTimersByTimeAsync(0);

      expect(mockFetch).toHaveBeenCalled();
    });
  });

  describe('flush', () => {
    it('should send events to API', async () => {
      transport = new BatchTransport();
      transport.start();

      transport.send(createTestEvent());

      // Trigger flush by advancing timer
      await vi.advanceTimersByTimeAsync(5000);

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.test.com/v1/ingest',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            'X-API-Key': 'test-api-key',
          }),
        })
      );
    });

    it('should call onSuccess callback on successful flush', async () => {
      const onSuccess = vi.fn();
      transport = new BatchTransport({ onSuccess });
      transport.start();

      transport.send(createTestEvent());
      await vi.advanceTimersByTimeAsync(5000);

      expect(onSuccess).toHaveBeenCalledWith(1);
    });

    it('should enqueue events to DLQ on failure', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      const { EventQueue } = await import('../queue/EventQueue.js');
      transport = new BatchTransport({ enableDLQ: true });
      transport.start();

      transport.send(createTestEvent());

      // Disable retries for test by making all attempts fail
      mockFetch.mockRejectedValue(new Error('Network error'));

      await vi.advanceTimersByTimeAsync(15000); // Allow retries

      // EventQueue.enqueue should have been called
      const mockQueueInstance = vi.mocked(EventQueue).mock.results[0]?.value;
      expect(mockQueueInstance?.enqueue).toHaveBeenCalled();
    });
  });

  describe('queue stats', () => {
    it('should return queue stats when DLQ is enabled', () => {
      transport = new BatchTransport({ enableDLQ: true });
      transport.start();

      const stats = transport.getQueueStats();

      expect(stats).toEqual(expect.objectContaining({
        queuedCount: expect.any(Number),
        readyCount: expect.any(Number),
      }));
    });

    it('should return null when DLQ is disabled', () => {
      transport = new BatchTransport({ enableDLQ: false });
      transport.start();

      const stats = transport.getQueueStats();

      expect(stats).toBeNull();
    });
  });

  describe('manual queue processing', () => {
    it('should allow manual queue processing', async () => {
      const { EventQueue } = await import('../queue/EventQueue.js');
      transport = new BatchTransport({ enableDLQ: true });
      transport.start();

      await transport.processQueue();

      const mockQueueInstance = vi.mocked(EventQueue).mock.results[0]?.value;
      expect(mockQueueInstance?.processQueue).toHaveBeenCalled();
    });
  });
});
