import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import nock from 'nock';
import { createAnthropicProvider } from '../../src/providers/AnthropicProvider';

describe('AnthropicProvider', () => {
  let provider: ReturnType<typeof createAnthropicProvider>;
  const API_KEY = 'test-api-key';
  const API_BASE = 'https://api.anthropic.com';

  beforeEach(() => {
    provider = createAnthropicProvider(API_KEY);
    nock.cleanAll();
  });

  afterEach(() => {
    nock.cleanAll();
  });

  describe('chat', () => {
    it('should make successful API call', async () => {
      const mockResponse = {
        id: 'msg_123',
        type: 'message',
        role: 'assistant',
        content: [{ type: 'text', text: 'Hello! How can I help you?' }],
        model: 'claude-3-opus-20240229',
        stop_reason: 'end_turn',
        usage: {
          input_tokens: 10,
          output_tokens: 8,
        },
      };

      nock(API_BASE)
        .post('/v1/messages')
        .reply(200, mockResponse);

      const result = await provider.chat(
        [{ role: 'user', content: 'Hello' }],
        {
          model: 'claude-3-opus-20240229',
          maxTokens: 1024,
        }
      );

      expect(result.content).toBe('Hello! How can I help you?');
      expect(result.tokenUsage).toEqual({
        promptTokens: 10,
        completionTokens: 8,
        totalTokens: 18,
      });
    });

    it('should handle system prompts', async () => {
      const mockResponse = {
        id: 'msg_124',
        content: [{ type: 'text', text: 'Response' }],
        usage: { input_tokens: 20, output_tokens: 5 },
        stop_reason: 'end_turn',
      };

      const scope = nock(API_BASE)
        .post('/v1/messages', (body: any) => {
          expect(body.system).toBe('You are a helpful assistant');
          return true;
        })
        .reply(200, mockResponse);

      await provider.chat(
        [
          { role: 'system', content: 'You are a helpful assistant' },
          { role: 'user', content: 'Test' }
        ],
        {
          model: 'claude-3-opus-20240229',
          maxTokens: 1024,
        }
      );

      expect(scope.isDone()).toBe(true);
    });

    it('should handle temperature parameter', async () => {
      const mockResponse = {
        id: 'msg_125',
        content: [{ type: 'text', text: 'Response' }],
        usage: { input_tokens: 10, output_tokens: 5 },
        stop_reason: 'end_turn',
      };

      const scope = nock(API_BASE)
        .post('/v1/messages', (body: any) => {
          expect(body.temperature).toBe(0.7);
          return true;
        })
        .reply(200, mockResponse);

      await provider.chat(
        [{ role: 'user', content: 'Test' }],
        {
          model: 'claude-3-opus-20240229',
          temperature: 0.7,
          maxTokens: 1024,
        }
      );

      expect(scope.isDone()).toBe(true);
    });

    it('should handle rate limit errors', async () => {
      nock(API_BASE)
        .post('/v1/messages')
        .reply(429, {
          type: 'error',
          error: {
            type: 'rate_limit_error',
            message: 'Rate limit exceeded',
          },
        });

      await expect(
        provider.chat(
          [{ role: 'user', content: 'Test' }],
          {
            model: 'claude-3-opus-20240229',
            maxTokens: 1024,
          }
        )
      ).rejects.toThrow();
    });

    it('should handle authentication errors', async () => {
      nock(API_BASE)
        .post('/v1/messages')
        .reply(401, {
          type: 'error',
          error: {
            type: 'authentication_error',
            message: 'Invalid API key',
          },
        });

      await expect(
        provider.chat(
          [{ role: 'user', content: 'Test' }],
          {
            model: 'claude-3-opus-20240229',
            maxTokens: 1024,
          }
        )
      ).rejects.toThrow();
    });

    it('should handle invalid request errors', async () => {
      nock(API_BASE)
        .post('/v1/messages')
        .reply(400, {
          type: 'error',
          error: {
            type: 'invalid_request_error',
            message: 'Invalid model specified',
          },
        });

      await expect(
        provider.chat(
          [{ role: 'user', content: 'Test' }],
          {
            model: 'invalid-model',
            maxTokens: 1024,
          }
        )
      ).rejects.toThrow();
    });

    it('should handle network errors', async () => {
      nock(API_BASE)
        .post('/v1/messages')
        .replyWithError('Network error');

      await expect(
        provider.chat(
          [{ role: 'user', content: 'Test' }],
          {
            model: 'claude-3-opus-20240229',
            maxTokens: 1024,
          }
        )
      ).rejects.toThrow();
    });

    it('should handle multiple content blocks', async () => {
      const mockResponse = {
        id: 'msg_126',
        content: [
          { type: 'text', text: 'First part. ' },
          { type: 'text', text: 'Second part.' },
        ],
        usage: { input_tokens: 10, output_tokens: 10 },
        stop_reason: 'end_turn',
      };

      nock(API_BASE)
        .post('/v1/messages')
        .reply(200, mockResponse);

      const result = await provider.chat(
        [{ role: 'user', content: 'Test' }],
        {
          model: 'claude-3-opus-20240229',
          maxTokens: 1024,
        }
      );

      expect(result.content).toBe('First part. Second part.');
    });

    it('should include API key in headers', async () => {
      const mockResponse = {
        id: 'msg_127',
        content: [{ type: 'text', text: 'Response' }],
        usage: { input_tokens: 10, output_tokens: 5 },
        stop_reason: 'end_turn',
      };

      const scope = nock(API_BASE, {
        reqheaders: {
          'x-api-key': API_KEY,
          'anthropic-version': '2023-06-01',
        },
      })
        .post('/v1/messages')
        .reply(200, mockResponse);

      await provider.chat(
        [{ role: 'user', content: 'Test' }],
        {
          model: 'claude-3-opus-20240229',
          maxTokens: 1024,
        }
      );

      expect(scope.isDone()).toBe(true);
    });

    it('should handle conversation with multiple messages', async () => {
      const mockResponse = {
        id: 'msg_128',
        content: [{ type: 'text', text: 'Continued response' }],
        usage: { input_tokens: 50, output_tokens: 10 },
        stop_reason: 'end_turn',
      };

      const scope = nock(API_BASE)
        .post('/v1/messages', (body: any) => {
          expect(body.messages).toHaveLength(3);
          expect(body.messages[0].role).toBe('user');
          expect(body.messages[1].role).toBe('assistant');
          expect(body.messages[2].role).toBe('user');
          return true;
        })
        .reply(200, mockResponse);

      await provider.chat(
        [
          { role: 'user', content: 'First message' },
          { role: 'assistant', content: 'First response' },
          { role: 'user', content: 'Second message' },
        ],
        {
          model: 'claude-3-opus-20240229',
          maxTokens: 1024,
        }
      );

      expect(scope.isDone()).toBe(true);
    });
  });

  describe('estimateCost', () => {
    it('should estimate cost for claude-3-opus', () => {
      const cost = provider.estimateCost({
        promptTokens: 1000,
        completionTokens: 500,
        totalTokens: 1500,
      }, 'claude-3-opus-20240229');

      // Claude 3 Opus: $15/1M input, $75/1M output
      const expectedCost = (1000 * 15 + 500 * 75) / 1_000_000;
      expect(cost).toBeCloseTo(expectedCost, 6);
    });

    it('should estimate cost for claude-3-sonnet', () => {
      const cost = provider.estimateCost({
        promptTokens: 1000,
        completionTokens: 500,
        totalTokens: 1500,
      }, 'claude-3-sonnet-20240229');

      // Claude 3 Sonnet: $3/1M input, $15/1M output
      const expectedCost = (1000 * 3 + 500 * 15) / 1_000_000;
      expect(cost).toBeCloseTo(expectedCost, 6);
    });

    it('should estimate cost for claude-3-haiku', () => {
      const cost = provider.estimateCost({
        promptTokens: 1000,
        completionTokens: 500,
        totalTokens: 1500,
      }, 'claude-3-haiku-20240307');

      // Claude 3 Haiku: $0.25/1M input, $1.25/1M output
      const expectedCost = (1000 * 0.25 + 500 * 1.25) / 1_000_000;
      expect(cost).toBeCloseTo(expectedCost, 6);
    });

    it('should use default pricing for unknown models', () => {
      const cost = provider.estimateCost({
        promptTokens: 1000,
        completionTokens: 500,
        totalTokens: 1500,
      }, 'unknown-model');

      expect(cost).toBeGreaterThan(0);
    });
  });

  // NOTE: getName and getSupportedModels methods do not exist in AnthropicProvider
  // These tests are removed as the provider only has: chat, estimateCost
});
