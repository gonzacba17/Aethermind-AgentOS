import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { FetchInterceptor } from '../interceptors/FetchInterceptor.js';
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

/**
 * Helper: create a mock Response with JSON body
 */
function mockResponse(body: any, status = 200): Response {
  const json = JSON.stringify(body);
  return new Response(json, {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('FetchInterceptor', () => {
  let interceptor: FetchInterceptor;
  let eventCallback: ReturnType<typeof vi.fn>;
  let savedFetch: typeof globalThis.fetch;

  beforeEach(() => {
    savedFetch = globalThis.fetch;
    eventCallback = vi.fn();
    interceptor = new FetchInterceptor(eventCallback);
  });

  afterEach(() => {
    interceptor.uninstrument();
    globalThis.fetch = savedFetch;
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
    it('should replace globalThis.fetch', () => {
      const original = globalThis.fetch;
      interceptor.instrument();

      expect(interceptor.isActive()).toBe(true);
      expect(globalThis.fetch).not.toBe(original);
    });

    it('should warn when already instrumented', () => {
      const consoleSpy = vi.spyOn(console, 'warn');
      interceptor.instrument();
      interceptor.instrument();

      expect(consoleSpy).toHaveBeenCalledWith('[Aethermind] Fetch already instrumented');
    });

    it('should warn when globalThis.fetch is not available', () => {
      const consoleSpy = vi.spyOn(console, 'warn');
      const original = globalThis.fetch;

      // Temporarily remove fetch
      (globalThis as any).fetch = undefined;
      interceptor.instrument();

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('globalThis.fetch not available')
      );

      globalThis.fetch = original;
    });
  });

  describe('non-LLM passthrough', () => {
    it('should pass through calls to non-LLM URLs unmodified', async () => {
      const mockBody = { data: 'hello' };
      const mockFetch = vi.fn().mockResolvedValue(mockResponse(mockBody));
      globalThis.fetch = mockFetch;

      interceptor.instrument();

      const response = await globalThis.fetch('https://example.com/api/data');
      const body = await response.json();

      expect(body).toEqual(mockBody);
      expect(mockFetch).toHaveBeenCalledWith('https://example.com/api/data', undefined);
      expect(eventCallback).not.toHaveBeenCalled();
    });

    it('should pass through calls with invalid URLs', async () => {
      const mockFetch = vi.fn().mockResolvedValue(mockResponse({ ok: true }));
      globalThis.fetch = mockFetch;

      interceptor.instrument();

      await globalThis.fetch('not-a-valid-url');

      expect(mockFetch).toHaveBeenCalled();
      expect(eventCallback).not.toHaveBeenCalled();
    });
  });

  describe('OpenAI interception', () => {
    it('should capture telemetry for OpenAI chat completions', async () => {
      const openaiResponse = {
        id: 'chatcmpl-abc123',
        choices: [{ message: { content: 'Hello!' } }],
        usage: {
          prompt_tokens: 10,
          completion_tokens: 20,
          total_tokens: 30,
        },
      };

      const mockFetch = vi.fn().mockResolvedValue(mockResponse(openaiResponse));
      globalThis.fetch = mockFetch;

      interceptor.instrument();

      const response = await globalThis.fetch(
        'https://api.openai.com/v1/chat/completions',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ model: 'gpt-4o', messages: [] }),
        }
      );

      // Response should still be readable by the caller
      const body = await response.json();
      expect(body.choices[0].message.content).toBe('Hello!');

      // Callback should have been invoked with telemetry
      expect(eventCallback).toHaveBeenCalledTimes(1);
      const event: TelemetryEvent = eventCallback.mock.calls[0][0];
      expect(event.provider).toBe('openai');
      expect(event.model).toBe('gpt-4o');
      expect(event.tokens.promptTokens).toBe(10);
      expect(event.tokens.completionTokens).toBe(20);
      expect(event.tokens.totalTokens).toBe(30);
      expect(event.cost).toBeGreaterThan(0);
      expect(event.latency).toBeGreaterThanOrEqual(0);
      expect(event.status).toBe('success');
    });

    it('should use default model when body is not JSON', async () => {
      const openaiResponse = {
        usage: { prompt_tokens: 5, completion_tokens: 5, total_tokens: 10 },
      };

      const mockFetch = vi.fn().mockResolvedValue(mockResponse(openaiResponse));
      globalThis.fetch = mockFetch;

      interceptor.instrument();

      await globalThis.fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
      });

      expect(eventCallback).toHaveBeenCalledTimes(1);
      const event: TelemetryEvent = eventCallback.mock.calls[0][0];
      expect(event.model).toBe('gpt-3.5-turbo');
    });
  });

  describe('Anthropic interception', () => {
    it('should capture telemetry for Anthropic messages', async () => {
      const anthropicResponse = {
        id: 'msg_abc123',
        content: [{ type: 'text', text: 'Hello!' }],
        usage: {
          input_tokens: 15,
          output_tokens: 25,
        },
      };

      const mockFetch = vi.fn().mockResolvedValue(mockResponse(anthropicResponse));
      globalThis.fetch = mockFetch;

      interceptor.instrument();

      const response = await globalThis.fetch(
        'https://api.anthropic.com/v1/messages',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ model: 'claude-3-5-sonnet-20241022', messages: [] }),
        }
      );

      const body = await response.json();
      expect(body.content[0].text).toBe('Hello!');

      expect(eventCallback).toHaveBeenCalledTimes(1);
      const event: TelemetryEvent = eventCallback.mock.calls[0][0];
      expect(event.provider).toBe('anthropic');
      expect(event.model).toBe('claude-3-5-sonnet-20241022');
      expect(event.tokens.promptTokens).toBe(15);
      expect(event.tokens.completionTokens).toBe(25);
      expect(event.tokens.totalTokens).toBe(40);
      expect(event.cost).toBeGreaterThan(0);
      expect(event.status).toBe('success');
    });
  });

  describe('error resilience', () => {
    it('should capture error event and re-throw when fetch fails', async () => {
      const fetchError = new Error('Network error');
      const mockFetch = vi.fn().mockRejectedValue(fetchError);
      globalThis.fetch = mockFetch;

      interceptor.instrument();

      await expect(
        globalThis.fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          body: JSON.stringify({ model: 'gpt-4' }),
        })
      ).rejects.toThrow('Network error');

      expect(eventCallback).toHaveBeenCalledTimes(1);
      const event: TelemetryEvent = eventCallback.mock.calls[0][0];
      expect(event.status).toBe('error');
      expect(event.error).toBe('Network error');
    });

    it('should still return response when response has no usage field', async () => {
      const noUsageResponse = { choices: [{ message: { content: 'Hi' } }] };
      const mockFetch = vi.fn().mockResolvedValue(mockResponse(noUsageResponse));
      globalThis.fetch = mockFetch;

      interceptor.instrument();

      const response = await globalThis.fetch(
        'https://api.openai.com/v1/chat/completions',
        { method: 'POST', body: JSON.stringify({ model: 'gpt-4' }) }
      );

      const body = await response.json();
      expect(body.choices[0].message.content).toBe('Hi');

      // No usage -> no telemetry event
      expect(eventCallback).not.toHaveBeenCalled();
    });
  });

  describe('uninstrument', () => {
    it('should restore original fetch after uninstrument', () => {
      const original = globalThis.fetch;
      interceptor.instrument();

      expect(globalThis.fetch).not.toBe(original);

      interceptor.uninstrument();

      expect(globalThis.fetch).toBe(original);
      expect(interceptor.isActive()).toBe(false);
    });

    it('should do nothing when not instrumented', () => {
      const original = globalThis.fetch;
      interceptor.uninstrument();

      expect(globalThis.fetch).toBe(original);
    });
  });

  describe('event structure', () => {
    it('should generate telemetry event with correct structure via captureEvent', () => {
      const event = (interceptor as any).captureEvent(
        {
          model: 'gpt-4o',
          timestamp: '2026-02-19T10:00:00Z',
          provider: 'openai',
        },
        {
          tokens: {
            promptTokens: 100,
            completionTokens: 50,
            totalTokens: 150,
          },
          latency: 300,
          status: 'success',
        }
      );

      expect(event).toEqual(
        expect.objectContaining({
          provider: 'openai',
          model: 'gpt-4o',
          tokens: expect.objectContaining({
            promptTokens: 100,
            completionTokens: 50,
            totalTokens: 150,
          }),
          latency: 300,
          status: 'success',
          cost: expect.any(Number),
        })
      );
    });
  });
});
