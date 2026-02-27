import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock config module
vi.mock('../config/index.js', () => ({
  getConfig: () => ({
    apiKey: 'test-api-key',
    endpoint: 'https://api.test.io',
    flushInterval: 5000,
    batchSize: 50,
    enabled: true,
  }),
  isInitialized: () => true,
}));

// Import after mocks
const { cacheService } = await import('../cache/CacheService.js');

describe('CacheService', () => {
  let fetchSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  // ============================================
  // lookup
  // ============================================
  describe('lookup', () => {
    it('should return cached response on hit', async () => {
      fetchSpy.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          hit: true,
          response: 'cached answer',
          cachedAt: '2024-01-01T00:00:00Z',
          model: 'gpt-4o-mini',
          tokensUsed: 100,
          costUsd: 0.01,
          similarity: 0.95,
        }),
      });

      const result = await cacheService.lookup('What is the capital of France?', 'gpt-4o-mini');

      expect(result).not.toBeNull();
      expect(result!.response).toBe('cached answer');
      expect(result!.similarity).toBe(0.95);
      expect(result!.costUsd).toBe(0.01);
    });

    it('should return null on cache miss', async () => {
      fetchSpy.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ hit: false }),
      });

      const result = await cacheService.lookup('a new question', 'gpt-4o');
      expect(result).toBeNull();
    });

    it('should return null on API error (fail-open)', async () => {
      fetchSpy.mockResolvedValueOnce({
        ok: false,
        status: 500,
      });

      const result = await cacheService.lookup('test', 'gpt-4o');
      expect(result).toBeNull();
    });

    it('should return null on network error (fail-open)', async () => {
      fetchSpy.mockRejectedValueOnce(new Error('Network error'));

      const result = await cacheService.lookup('test', 'gpt-4o');
      expect(result).toBeNull();
    });

    it('should return null on timeout (fail-open)', async () => {
      const abortError = new Error('The operation was aborted');
      abortError.name = 'AbortError';
      fetchSpy.mockRejectedValueOnce(abortError);

      const result = await cacheService.lookup('test', 'gpt-4o');
      expect(result).toBeNull();
    });

    it('should send correct request to API', async () => {
      fetchSpy.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ hit: false }),
      });

      await cacheService.lookup('hello world', 'gpt-4o');

      expect(fetchSpy).toHaveBeenCalledOnce();
      const [url, options] = fetchSpy.mock.calls[0];
      expect(url).toBe('https://api.test.io/v1/cache/lookup');
      expect(options.method).toBe('POST');
      expect(options.headers['X-API-Key']).toBe('test-api-key');
      expect(JSON.parse(options.body)).toEqual({
        prompt: 'hello world',
        model: 'gpt-4o',
      });
    });
  });

  // ============================================
  // store
  // ============================================
  describe('store', () => {
    it('should fire and forget without blocking', () => {
      fetchSpy.mockResolvedValueOnce({ ok: true });

      // store() returns void immediately
      const result = cacheService.store('prompt', 'response', 'gpt-4o', 100, 0.01);
      expect(result).toBeUndefined();
    });

    it('should not throw on fetch failure', () => {
      fetchSpy.mockRejectedValueOnce(new Error('Network error'));

      // Should not throw
      expect(() => {
        cacheService.store('prompt', 'response', 'gpt-4o', 100, 0.01);
      }).not.toThrow();
    });

    it('should send correct request to API', async () => {
      fetchSpy.mockResolvedValueOnce({ ok: true });

      cacheService.store('test prompt', 'test response', 'gpt-4o-mini', 50, 0.005);

      // Wait for the fire-and-forget fetch to be called
      await new Promise((r) => setTimeout(r, 10));

      expect(fetchSpy).toHaveBeenCalledOnce();
      const [url, options] = fetchSpy.mock.calls[0];
      expect(url).toBe('https://api.test.io/v1/cache/store');
      expect(options.method).toBe('POST');
      expect(JSON.parse(options.body)).toEqual({
        prompt: 'test prompt',
        response: 'test response',
        model: 'gpt-4o-mini',
        tokensUsed: 50,
        costUsd: 0.005,
      });
    });
  });
});
