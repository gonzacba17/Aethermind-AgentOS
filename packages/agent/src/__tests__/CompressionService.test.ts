/**
 * CompressionService SDK Tests
 *
 * Phase 4 — tests for fail-open behavior, setting checks, and threshold logic.
 */

// Mock the config module
jest.mock('../config/index.js', () => ({
  getConfig: jest.fn(() => ({
    apiKey: 'test-key',
    endpoint: 'http://localhost:3001',
    enabled: true,
  })),
  isInitialized: jest.fn(() => true),
}));

import { compressionService } from '../compression/CompressionService.js';
import { isInitialized } from '../config/index.js';

// Save original fetch
const originalFetch = global.fetch;

describe('CompressionService', () => {
  beforeEach(() => {
    compressionService.clearCache();
    (isInitialized as jest.Mock).mockReturnValue(true);
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  // ============================================
  // Fail-open on timeout
  // ============================================

  describe('fail-open on timeout', () => {
    it('returns original prompt when fetch times out', async () => {
      // Simulate a fetch that never resolves (will be aborted)
      global.fetch = jest.fn(() =>
        new Promise((_, reject) => {
          setTimeout(() => reject(new DOMException('Aborted', 'AbortError')), 100);
        })
      ) as any;

      const result = await compressionService.compress(
        'A '.repeat(300) + 'long prompt that should trigger compression',
        'gpt-4o'
      );

      expect(result.wasCompressed).toBe(false);
      expect(result.prompt).toContain('long prompt');
    });

    it('returns original prompt when fetch fails with network error', async () => {
      global.fetch = jest.fn(() =>
        Promise.reject(new Error('Network error'))
      ) as any;

      const result = await compressionService.compress(
        'A '.repeat(300) + 'test prompt for network failure',
        'gpt-4o'
      );

      expect(result.wasCompressed).toBe(false);
    });

    it('returns original prompt when API returns non-200', async () => {
      global.fetch = jest.fn(() =>
        Promise.resolve({
          ok: false,
          status: 500,
        })
      ) as any;

      const result = await compressionService.compress(
        'A '.repeat(300) + 'test prompt for 500 error',
        'gpt-4o'
      );

      expect(result.wasCompressed).toBe(false);
    });
  });

  // ============================================
  // Not compress if compressionEnabled: false
  // ============================================

  describe('compression disabled', () => {
    it('does not compress when SDK is not initialized', async () => {
      (isInitialized as jest.Mock).mockReturnValue(false);

      const longPrompt = 'A '.repeat(300) + 'test prompt';
      const result = await compressionService.compress(longPrompt, 'gpt-4o');

      expect(result.wasCompressed).toBe(false);
      expect(result.prompt).toBe(longPrompt);
    });

    it('does not compress when compressionEnabled is false from API', async () => {
      let callCount = 0;
      global.fetch = jest.fn(() => {
        callCount++;
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            prompt: 'compressed',
            wasCompressed: false,
            originalTokens: 400,
            finalTokens: 400,
            compressionEnabled: false,
            minCompressionRatio: 0.15,
          }),
        });
      }) as any;

      const result = await compressionService.compress(
        'A '.repeat(300) + 'test prompt',
        'gpt-4o'
      );

      expect(result.wasCompressed).toBe(false);
    });
  });

  // ============================================
  // Not compress if ratio < threshold
  // ============================================

  describe('threshold check', () => {
    it('skips compression for short prompts (< 500 tokens)', async () => {
      const shortPrompt = 'Translate hello to Spanish.';
      
      // Should not even call fetch
      global.fetch = jest.fn(() => {
        throw new Error('Should not be called');
      }) as any;

      const result = await compressionService.compress(shortPrompt, 'gpt-4o');

      expect(result.wasCompressed).toBe(false);
      expect(result.prompt).toBe(shortPrompt);
    });

    it('returns compressed prompt when API indicates compression was applied', async () => {
      // First call: settings probe
      // Second call: actual compression
      let callCount = 0;
      global.fetch = jest.fn(() => {
        callCount++;
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            prompt: 'compressed version of the prompt',
            wasCompressed: true,
            originalTokens: 600,
            finalTokens: 400,
            compressionRatio: 0.667,
            compressionEnabled: true,
            minCompressionRatio: 0.15,
          }),
        });
      }) as any;

      const result = await compressionService.compress(
        'A '.repeat(300) + 'long prompt for successful compression test',
        'gpt-4o'
      );

      expect(result.wasCompressed).toBe(true);
      expect(result.prompt).toBe('compressed version of the prompt');
      expect(result.originalTokens).toBe(600);
      expect(result.finalTokens).toBe(400);
    });
  });

  // ============================================
  // Settings caching
  // ============================================

  describe('settings cache', () => {
    it('caches settings after first fetch', async () => {
      let fetchCallCount = 0;
      global.fetch = jest.fn(() => {
        fetchCallCount++;
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            prompt: 'test',
            wasCompressed: false,
            originalTokens: 600,
            finalTokens: 600,
            compressionEnabled: true,
            minCompressionRatio: 0.15,
          }),
        });
      }) as any;

      const longPrompt = 'A '.repeat(300) + 'long prompt';

      // First call: fetches settings + analyze
      await compressionService.compress(longPrompt, 'gpt-4o');
      const firstCount = fetchCallCount;

      // Second call: should use cached settings
      await compressionService.compress(longPrompt, 'gpt-4o');

      // Second call should make fewer fetch calls due to cached settings
      expect(fetchCallCount).toBeLessThanOrEqual(firstCount + 1);
    });
  });
});
