import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GeminiInterceptor } from '../interceptors/GeminiInterceptor.js';
import type { TelemetryEvent } from '../transport/types.js';

// Mock the config module
vi.mock('../config/index.js', () => ({
  getConfig: () => ({
    apiKey: 'test-api-key',
    endpoint: 'https://api.test.com',
    enabled: true,
    batchSize: 10,
    flushInterval: 5000,
  }),
  isInitialized: () => true,
}));

describe('GeminiInterceptor', () => {
  let interceptor: GeminiInterceptor;
  let eventCallback: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    eventCallback = vi.fn();
    interceptor = new GeminiInterceptor(eventCallback);
  });

  afterEach(() => {
    interceptor.uninstrument();
    vi.restoreAllMocks();
  });

  describe('initialization', () => {
    it('should create interceptor with event callback', () => {
      expect(interceptor).toBeDefined();
    });

    it('should not be instrumented initially', () => {
      expect(interceptor.isActive()).toBe(false);
    });
  });

  describe('instrument', () => {
    it('should warn when Gemini SDK is not available (fail-open)', () => {
      const consoleSpy = vi.spyOn(console, 'warn');

      interceptor.instrument();

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringMatching(/Gemini (SDK not found|generateContent not found)/)
      );
      // Should NOT throw — fail-open behavior
      expect(interceptor.isActive()).toBe(false);
    });

    it('should warn when already instrumented', () => {
      const consoleSpy = vi.spyOn(console, 'warn');

      // Mock successful instrumentation
      (interceptor as any).isInstrumented = true;

      interceptor.instrument();

      expect(consoleSpy).toHaveBeenCalledWith('[Aethermind] Gemini already instrumented');
    });
  });

  describe('uninstrument', () => {
    it('should do nothing when not instrumented', () => {
      const consoleSpy = vi.spyOn(console, 'log');

      interceptor.uninstrument();

      expect(consoleSpy).not.toHaveBeenCalled();
    });
  });

  describe('event capture', () => {
    it('should generate telemetry event with correct structure for Gemini', () => {
      const event = (interceptor as any).captureEvent(
        {
          model: 'gemini-1.5-flash',
          timestamp: '2026-01-27T10:00:00Z',
          provider: 'gemini',
        },
        {
          tokens: {
            promptTokens: 150,
            completionTokens: 80,
            totalTokens: 230,
          },
          latency: 700,
          status: 'success',
        }
      );

      expect(event).toEqual(expect.objectContaining({
        provider: 'gemini',
        model: 'gemini-1.5-flash',
        tokens: expect.objectContaining({
          promptTokens: 150,
          completionTokens: 80,
          totalTokens: 230,
        }),
        latency: 700,
        status: 'success',
        cost: expect.any(Number),
      }));
    });

    it('should calculate cost correctly for gemini-1.5-flash', () => {
      const event = (interceptor as any).captureEvent(
        {
          model: 'gemini-1.5-flash',
          timestamp: '2026-01-27T10:00:00Z',
          provider: 'gemini',
        },
        {
          tokens: {
            promptTokens: 1000,
            completionTokens: 1000,
            totalTokens: 2000,
          },
          latency: 500,
          status: 'success',
        }
      );

      // gemini-1.5-flash: input=0.000075/1K, output=0.0003/1K
      // 1000 prompt tokens = (1000/1000) * 0.000075 = 0.000075
      // 1000 completion tokens = (1000/1000) * 0.0003 = 0.0003
      // Total = 0.000375
      expect(event.cost).toBeCloseTo(0.000375, 6);
    });

    it('should calculate cost correctly for gemini-1.5-pro', () => {
      const event = (interceptor as any).captureEvent(
        {
          model: 'gemini-1.5-pro',
          timestamp: '2026-01-27T10:00:00Z',
          provider: 'gemini',
        },
        {
          tokens: {
            promptTokens: 1000,
            completionTokens: 1000,
            totalTokens: 2000,
          },
          latency: 500,
          status: 'success',
        }
      );

      // gemini-1.5-pro: input=0.00125/1K, output=0.005/1K
      // 1000 prompt tokens = (1000/1000) * 0.00125 = 0.00125
      // 1000 completion tokens = (1000/1000) * 0.005 = 0.005
      // Total = 0.00625
      expect(event.cost).toBeCloseTo(0.00625, 6);
    });

    it('should capture error events', () => {
      const event = (interceptor as any).captureEvent(
        {
          model: 'gemini-2.0-flash',
          timestamp: '2026-01-27T10:00:00Z',
          provider: 'gemini',
        },
        {
          tokens: {
            promptTokens: 0,
            completionTokens: 0,
            totalTokens: 0,
          },
          latency: 100,
          status: 'error',
          error: 'PERMISSION_DENIED',
        }
      );

      expect(event).toEqual(expect.objectContaining({
        status: 'error',
        error: 'PERMISSION_DENIED',
      }));
    });
  });

  describe('prompt extraction', () => {
    it('should extract text from string input', () => {
      const text = (interceptor as any).extractPromptText(['Hello, world!']);
      expect(text).toBe('Hello, world!');
    });

    it('should extract text from Parts array input', () => {
      const text = (interceptor as any).extractPromptText([[
        { text: 'Part 1' },
        { text: 'Part 2' },
      ]]);
      expect(text).toBe('Part 1 Part 2');
    });

    it('should extract text from GenerateContentRequest object', () => {
      const text = (interceptor as any).extractPromptText([{
        contents: [{
          parts: [{ text: 'Hello from request' }],
          role: 'user',
        }],
      }]);
      expect(text).toBe('Hello from request');
    });

    it('should return empty string for null/undefined input', () => {
      const text = (interceptor as any).extractPromptText([]);
      expect(text).toBe('');
    });
  });
});

describe('GeminiInterceptor Integration', () => {
  it('should coexist with other interceptors', () => {
    const geminiInterceptor = new GeminiInterceptor();

    expect(geminiInterceptor).toBeDefined();
    expect(geminiInterceptor.isActive()).toBe(false);

    geminiInterceptor.uninstrument();
  });

  it('should not break when SDK is not installed (fail-open)', () => {
    const callback = vi.fn();
    const interceptor = new GeminiInterceptor(callback);

    // This should not throw
    expect(() => interceptor.instrument()).not.toThrow();

    // Callback should not have been called
    expect(callback).not.toHaveBeenCalled();

    interceptor.uninstrument();
  });
});
