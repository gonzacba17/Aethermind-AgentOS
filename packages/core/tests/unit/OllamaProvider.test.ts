import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import nock from 'nock';
import { createOllamaProvider } from '../../src/providers/OllamaProvider';

describe('OllamaProvider', () => {
  let provider: ReturnType<typeof createOllamaProvider>;
  const BASE_URL = 'http://localhost:11434';

  beforeEach(() => {
    provider = createOllamaProvider(BASE_URL);
    nock.cleanAll();
  });

  afterEach(() => {
    nock.cleanAll();
  });

  describe('chat', () => {
    it('should make successful API call', async () => {
      const mockResponse = {
        model: 'llama2',
        created_at: '2024-01-01T00:00:00Z',
        message: {
          role: 'assistant',
          content: 'Hello! How can I help you today?',
        },
        done: true,
        total_duration: 1000000000,
        prompt_eval_count: 10,
        eval_count: 8,
      };

      nock(BASE_URL)
        .post('/api/chat')
        .reply(200, mockResponse);

      const result = await provider.chat(
        [{ role: 'user', content: 'Hello' }],
        { model: 'llama2', maxTokens: 1024 }
      );

      expect(result.content).toBe('Hello! How can I help you today?');
      expect(result.tokenUsage).toEqual({
        promptTokens: 10,
        completionTokens: 8,
        totalTokens: 18,
      });
    });

    it('should handle system messages', async () => {
      const mockResponse = {
        message: { role: 'assistant', content: 'Response' },
        done: true,
        prompt_eval_count: 20,
        eval_count: 5,
      };

      const scope = nock(BASE_URL)
        .post('/api/chat', (body: any) => {
          expect(body.messages).toHaveLength(2);
          expect(body.messages[0].role).toBe('system');
          expect(body.messages[1].role).toBe('user');
          return true;
        })
        .reply(200, mockResponse);

      await provider.chat(
        [
          { role: 'system', content: 'You are helpful' },
          { role: 'user', content: 'Test' },
        ],
        { model: 'llama2', maxTokens: 1024 }
      );

      expect(scope.isDone()).toBe(true);
    });

    it('should handle temperature parameter', async () => {
      const mockResponse = {
        message: { role: 'assistant', content: 'Response' },
        done: true,
        prompt_eval_count: 10,
        eval_count: 5,
      };

      const scope = nock(BASE_URL)
        .post('/api/chat', (body: any) => {
          expect(body.options?.temperature).toBe(0.7);
          return true;
        })
        .reply(200, mockResponse);

      await provider.chat(
        [{ role: 'user', content: 'Test' }],
        { model: 'llama2', temperature: 0.7, maxTokens: 1024 }
      );

      expect(scope.isDone()).toBe(true);
    });

    it('should handle connection errors', async () => {
      nock(BASE_URL)
        .post('/api/chat')
        .replyWithError('Connection refused');

      await expect(
        provider.chat(
          [{ role: 'user', content: 'Test' }],
          { model: 'llama2', maxTokens: 1024 }
        )
      ).rejects.toThrow();
    });

    it('should handle server errors', async () => {
      nock(BASE_URL)
        .post('/api/chat')
        .reply(500, { error: 'Internal server error' });

      await expect(
        provider.chat(
          [{ role: 'user', content: 'Test' }],
          { model: 'llama2', maxTokens: 1024 }
        )
      ).rejects.toThrow();
    });

    it('should handle model not found errors', async () => {
      nock(BASE_URL)
        .post('/api/chat')
        .reply(404, { error: 'Model not found' });

      await expect(
        provider.chat(
          [{ role: 'user', content: 'Test' }],
          { model: 'non-existent-model', maxTokens: 1024 }
        )
      ).rejects.toThrow();
    });

    it('should handle conversation with multiple messages', async () => {
      const mockResponse = {
        message: { role: 'assistant', content: 'Continued response' },
        done: true,
        prompt_eval_count: 50,
        eval_count: 10,
      };

      const scope = nock(BASE_URL)
        .post('/api/chat', (body: any) => {
          expect(body.messages).toHaveLength(3);
          return true;
        })
        .reply(200, mockResponse);

      await provider.chat(
        [
          { role: 'user', content: 'First' },
          { role: 'assistant', content: 'Response' },
          { role: 'user', content: 'Second' },
        ],
        { model: 'llama2', maxTokens: 1024 }
      );

      expect(scope.isDone()).toBe(true);
    });

    it('should use stream: false in request', async () => {
      const mockResponse = {
        message: { role: 'assistant', content: 'Response' },
        done: true,
        prompt_eval_count: 10,
        eval_count: 5,
      };

      const scope = nock(BASE_URL)
        .post('/api/chat', (body: any) => {
          expect(body.stream).toBe(false);
          return true;
        })
        .reply(200, mockResponse);

      await provider.chat(
        [{ role: 'user', content: 'Test' }],
        { model: 'llama2', maxTokens: 1024 }
      );

      expect(scope.isDone()).toBe(true);
    });
  });

  describe('estimateCost', () => {
    it('should return 0 for local models', () => {
      const cost = provider.estimateCost({
        promptTokens: 1000,
        completionTokens: 500,
        totalTokens: 1500,
      });

      expect(cost).toBe(0);
    });

    it('should return 0 regardless of token count', () => {
      const cost = provider.estimateCost({
        promptTokens: 1000000,
        completionTokens: 500000,
        totalTokens: 1500000,
      });

      expect(cost).toBe(0);
    });
  });

  describe('getName', () => {
    it('should return provider name', () => {
      expect(provider.name).toBe('ollama');
    });
  });

  describe('custom base URL', () => {
    it('should use custom base URL', async () => {
      const customProvider = createOllamaProvider('http://custom-host:8080');
      
      const mockResponse = {
        message: { role: 'assistant', content: 'Response' },
        done: true,
        prompt_eval_count: 10,
        eval_count: 5,
      };

      nock('http://custom-host:8080')
        .post('/api/chat')
        .reply(200, mockResponse);

      await customProvider.chat(
        [{ role: 'user', content: 'Test' }],
        { model: 'llama2', maxTokens: 1024 }
      );
    });
  });
});
