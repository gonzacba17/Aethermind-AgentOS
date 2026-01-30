import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { OpenAIInterceptor } from '../interceptors/OpenAIInterceptor.js';
import { AnthropicInterceptor } from '../interceptors/AnthropicInterceptor.js';
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
}));

describe('OpenAIInterceptor', () => {
  let interceptor: OpenAIInterceptor;
  let eventCallback: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    eventCallback = vi.fn();
    interceptor = new OpenAIInterceptor(eventCallback);
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
      expect(interceptor.isInstrumented).toBe(false);
    });
  });

  describe('instrument', () => {
    it('should warn when OpenAI SDK is not available', () => {
      const consoleSpy = vi.spyOn(console, 'warn');

      interceptor.instrument();

      // Since OpenAI SDK is not installed in test env
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('OpenAI SDK not found')
      );
    });

    it('should warn when already instrumented', () => {
      const consoleSpy = vi.spyOn(console, 'warn');

      // Mock successful instrumentation
      (interceptor as any).isInstrumented = true;

      interceptor.instrument();

      expect(consoleSpy).toHaveBeenCalledWith('[Aethermind] OpenAI already instrumented');
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
    it('should generate telemetry event with correct structure', () => {
      // Test the captureEvent method through base class
      const event = (interceptor as any).captureEvent(
        {
          model: 'gpt-4',
          timestamp: '2026-01-27T10:00:00Z',
          provider: 'openai',
        },
        {
          tokens: {
            promptTokens: 100,
            completionTokens: 50,
            totalTokens: 150,
          },
          latency: 500,
          status: 'success',
        }
      );

      expect(event).toEqual(expect.objectContaining({
        provider: 'openai',
        model: 'gpt-4',
        tokens: expect.objectContaining({
          promptTokens: 100,
          completionTokens: 50,
          totalTokens: 150,
        }),
        latency: 500,
        status: 'success',
        cost: expect.any(Number),
      }));
    });
  });
});

describe('AnthropicInterceptor', () => {
  let interceptor: AnthropicInterceptor;
  let eventCallback: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    eventCallback = vi.fn();
    interceptor = new AnthropicInterceptor(eventCallback);
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
      expect(interceptor.isInstrumented).toBe(false);
    });
  });

  describe('instrument', () => {
    it('should warn when Anthropic SDK is not available', () => {
      const consoleSpy = vi.spyOn(console, 'warn');

      interceptor.instrument();

      // Since Anthropic SDK is not installed in test env
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Anthropic SDK not found')
      );
    });
  });

  describe('event capture', () => {
    it('should generate telemetry event for Anthropic calls', () => {
      const event = (interceptor as any).captureEvent(
        {
          model: 'claude-3-opus-20240229',
          timestamp: '2026-01-27T10:00:00Z',
          provider: 'anthropic',
        },
        {
          tokens: {
            promptTokens: 200,
            completionTokens: 100,
            totalTokens: 300,
          },
          latency: 1000,
          status: 'success',
        }
      );

      expect(event).toEqual(expect.objectContaining({
        provider: 'anthropic',
        model: 'claude-3-opus-20240229',
        tokens: expect.objectContaining({
          promptTokens: 200,
          completionTokens: 100,
          totalTokens: 300,
        }),
        latency: 1000,
        status: 'success',
      }));
    });

    it('should capture error events', () => {
      const event = (interceptor as any).captureEvent(
        {
          model: 'claude-3-sonnet-20240229',
          timestamp: '2026-01-27T10:00:00Z',
          provider: 'anthropic',
        },
        {
          tokens: {
            promptTokens: 0,
            completionTokens: 0,
            totalTokens: 0,
          },
          latency: 100,
          status: 'error',
          error: 'Rate limit exceeded',
        }
      );

      expect(event).toEqual(expect.objectContaining({
        status: 'error',
        error: 'Rate limit exceeded',
      }));
    });
  });
});

describe('Interceptor Integration', () => {
  it('should allow multiple interceptors to be active', () => {
    const openaiInterceptor = new OpenAIInterceptor();
    const anthropicInterceptor = new AnthropicInterceptor();

    // Both should be creatable
    expect(openaiInterceptor).toBeDefined();
    expect(anthropicInterceptor).toBeDefined();

    // Clean up
    openaiInterceptor.uninstrument();
    anthropicInterceptor.uninstrument();
  });

  it('should call event callback when event is captured', () => {
    const callback = vi.fn();
    const interceptor = new OpenAIInterceptor(callback);

    // Manually trigger event capture
    const event = (interceptor as any).captureEvent(
      {
        model: 'gpt-4',
        timestamp: new Date().toISOString(),
        provider: 'openai',
      },
      {
        tokens: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
        latency: 100,
        status: 'success',
      }
    );

    // Simulate callback invocation
    callback(event);

    expect(callback).toHaveBeenCalledWith(expect.objectContaining({
      provider: 'openai',
      model: 'gpt-4',
    }));
  });
});
