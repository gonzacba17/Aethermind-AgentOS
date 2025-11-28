import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';

const { OpenAIProvider } = await import('../../packages/core/src/providers/OpenAIProvider.js');

describe('OpenAIProvider', () => {
  let provider: any;
  let fetchMock: any;

  beforeEach(() => {
    provider = new OpenAIProvider('test-api-key');
    global.fetch = jest.fn() as any;
    fetchMock = global.fetch as any;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Cost Calculation', () => {
    it('should calculate cost for gpt-4 correctly', () => {
      const tokenUsage = {
        promptTokens: 1000,
        completionTokens: 500,
        totalTokens: 1500,
      };

      const cost = provider.estimateCost(tokenUsage, 'gpt-4');
      
      expect(cost).toBeCloseTo(0.06, 2);
    });

    it('should calculate cost for gpt-4o correctly', () => {
      const tokenUsage = {
        promptTokens: 1000,
        completionTokens: 1000,
        totalTokens: 2000,
      };

      const cost = provider.estimateCost(tokenUsage, 'gpt-4o');
      
      expect(cost).toBeCloseTo(0.0125, 4);
    });

    it('should calculate cost for gpt-4o-mini correctly', () => {
      const tokenUsage = {
        promptTokens: 10000,
        completionTokens: 5000,
        totalTokens: 15000,
      };

      const cost = provider.estimateCost(tokenUsage, 'gpt-4o-mini');
      
      expect(cost).toBeCloseTo(0.0045, 4);
    });

    it('should calculate cost for gpt-3.5-turbo correctly', () => {
      const tokenUsage = {
        promptTokens: 2000,
        completionTokens: 1000,
        totalTokens: 3000,
      };

      const cost = provider.estimateCost(tokenUsage, 'gpt-3.5-turbo');
      
      expect(cost).toBeCloseTo(0.0025, 4);
    });

    it('should default to gpt-4 pricing for unknown models', () => {
      const tokenUsage = {
        promptTokens: 1000,
        completionTokens: 500,
        totalTokens: 1500,
      };

      const cost = provider.estimateCost(tokenUsage, 'unknown-model');
      const gpt4Cost = provider.estimateCost(tokenUsage, 'gpt-4');
      
      expect(cost).toBe(gpt4Cost);
    });

    it('should handle zero tokens', () => {
      const tokenUsage = {
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
      };

      const cost = provider.estimateCost(tokenUsage, 'gpt-4');
      
      expect(cost).toBe(0);
    });

    it('should calculate cost for o1-preview correctly', () => {
      const tokenUsage = {
        promptTokens: 1000,
        completionTokens: 1000,
        totalTokens: 2000,
      };

      const cost = provider.estimateCost(tokenUsage, 'o1-preview');
      
      expect(cost).toBeCloseTo(0.075, 3);
    });

    it('should calculate cost for o1-mini correctly', () => {
      const tokenUsage = {
        promptTokens: 1000,
        completionTokens: 1000,
        totalTokens: 2000,
      };

      const cost = provider.estimateCost(tokenUsage, 'o1-mini');
      
      expect(cost).toBeCloseTo(0.015, 3);
    });
  });

  describe('Retry Logic', () => {
    it('should retry on 429 (rate limit) error', async () => {
      let attempts = 0;
      
      fetchMock.mockImplementation(() => {
        attempts++;
        if (attempts < 2) {
          return Promise.resolve({
            ok: false,
            status: 429,
            text: () => Promise.resolve('Rate limit exceeded'),
          });
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            id: 'test-id',
            choices: [{
              index: 0,
              message: { role: 'assistant', content: 'Success after retry' },
              finish_reason: 'stop',
            }],
            usage: {
              prompt_tokens: 10,
              completion_tokens: 5,
              total_tokens: 15,
            },
          }),
        });
      });

      const result = await provider.chat(
        [{ role: 'user', content: 'test' }],
        { model: 'gpt-4', temperature: 0.7 }
      );

      expect(attempts).toBe(2);
      expect(result.content).toBe('Success after retry');
    }, 30000);

    it('should retry on 500 (server error)', async () => {
      let attempts = 0;
      
      fetchMock.mockImplementation(() => {
        attempts++;
        if (attempts < 3) {
          return Promise.resolve({
            ok: false,
            status: 500,
            text: () => Promise.resolve('Internal server error'),
          });
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            id: 'test-id',
            choices: [{
              index: 0,
              message: { role: 'assistant', content: 'Success' },
              finish_reason: 'stop',
            }],
            usage: {
              prompt_tokens: 10,
              completion_tokens: 5,
              total_tokens: 15,
            },
          }),
        });
      });

      const result = await provider.chat(
        [{ role: 'user', content: 'test' }],
        { model: 'gpt-4', temperature: 0.7 }
      );

      expect(attempts).toBe(3);
      expect(result.content).toBe('Success');
    }, 30000);

    it('should not retry on 400 (bad request) error', async () => {
      fetchMock.mockResolvedValue({
        ok: false,
        status: 400,
        text: () => Promise.resolve('Bad request'),
      });

      await expect(
        provider.chat(
          [{ role: 'user', content: 'test' }],
          { model: 'gpt-4', temperature: 0.7 }
        )
      ).rejects.toThrow('OpenAI API error: 400');
    }, 15000);

    it('should not retry on 401 (unauthorized) error', async () => {
      fetchMock.mockResolvedValue({
        ok: false,
        status: 401,
        text: () => Promise.resolve('Unauthorized'),
      });

      await expect(
        provider.chat(
          [{ role: 'user', content: 'test' }],
          { model: 'gpt-4', temperature: 0.7 }
        )
      ).rejects.toThrow('OpenAI API error: 401');
    }, 15000);

    it('should fail after max retry attempts', async () => {
      fetchMock.mockResolvedValue({
        ok: false,
        status: 429,
        text: () => Promise.resolve('Rate limit exceeded'),
      });

      await expect(
        provider.chat(
          [{ role: 'user', content: 'test' }],
          { model: 'gpt-4', temperature: 0.7 }
        )
      ).rejects.toThrow('Failed after 3 attempts');
    }, 30000);

    it('should use exponential backoff between retries', async () => {
      const retryTimes: number[] = [];
      let attempts = 0;
      
      fetchMock.mockImplementation(() => {
        attempts++;
        retryTimes.push(Date.now());
        
        if (attempts < 3) {
          return Promise.resolve({
            ok: false,
            status: 503,
            text: () => Promise.resolve('Service unavailable'),
          });
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            id: 'test-id',
            choices: [{
              index: 0,
              message: { role: 'assistant', content: 'Success' },
              finish_reason: 'stop',
            }],
            usage: {
              prompt_tokens: 10,
              completion_tokens: 5,
              total_tokens: 15,
            },
          }),
        });
      });

      await provider.chat(
        [{ role: 'user', content: 'test' }],
        { model: 'gpt-4', temperature: 0.7 }
      );

      expect(retryTimes.length).toBe(3);
      
      const delay1 = retryTimes[1]! - retryTimes[0]!;
      const delay2 = retryTimes[2]! - retryTimes[1]!;
      
      expect(delay1).toBeGreaterThanOrEqual(800);
      expect(delay2).toBeGreaterThanOrEqual(delay1);
    }, 30000);
  });

  describe('Timeout Handling', () => {
    it('should timeout after 30 seconds', async () => {
      fetchMock.mockImplementation(() => {
        return new Promise((resolve) => {
          setTimeout(() => {
            resolve({
              ok: true,
              json: () => Promise.resolve({
                id: 'test-id',
                choices: [{
                  index: 0,
                  message: { role: 'assistant', content: 'Too late' },
                  finish_reason: 'stop',
                }],
                usage: {
                  prompt_tokens: 10,
                  completion_tokens: 5,
                  total_tokens: 15,
                },
              }),
            });
          }, 35000);
        });
      });

      await expect(
        provider.chat(
          [{ role: 'user', content: 'test' }],
          { model: 'gpt-4', temperature: 0.7 }
        )
      ).rejects.toThrow();
    }, 35000);

    it('should complete before timeout', async () => {
      fetchMock.mockImplementation(() => {
        return new Promise((resolve) => {
          setTimeout(() => {
            resolve({
              ok: true,
              json: () => Promise.resolve({
                id: 'test-id',
                choices: [{
                  index: 0,
                  message: { role: 'assistant', content: 'Fast response' },
                  finish_reason: 'stop',
                }],
                usage: {
                  prompt_tokens: 10,
                  completion_tokens: 5,
                  total_tokens: 15,
                },
              }),
            });
          }, 100);
        });
      });

      const result = await provider.chat(
        [{ role: 'user', content: 'test' }],
        { model: 'gpt-4', temperature: 0.7 }
      );

      expect(result.content).toBe('Fast response');
    }, 10000);
  });

  describe('Error Handling', () => {
    it('should handle network errors', async () => {
      fetchMock.mockRejectedValue(new Error('Network error'));

      await expect(
        provider.chat(
          [{ role: 'user', content: 'test' }],
          { model: 'gpt-4', temperature: 0.7 }
        )
      ).rejects.toThrow();
    }, 15000);

    it('should handle missing response choices', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          id: 'test-id',
          choices: [],
          usage: {
            prompt_tokens: 10,
            completion_tokens: 5,
            total_tokens: 15,
          },
        }),
      });

      await expect(
        provider.chat(
          [{ role: 'user', content: 'test' }],
          { model: 'gpt-4', temperature: 0.7 }
        )
      ).rejects.toThrow('No response from OpenAI');
    }, 15000);

    it('should handle malformed JSON response', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        json: () => Promise.reject(new Error('Invalid JSON')),
      });

      await expect(
        provider.chat(
          [{ role: 'user', content: 'test' }],
          { model: 'gpt-4', temperature: 0.7 }
        )
      ).rejects.toThrow();
    }, 15000);
  });

  describe('Successful Requests', () => {
    it('should make successful chat request', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          id: 'chatcmpl-123',
          object: 'chat.completion',
          created: 1677652288,
          model: 'gpt-4',
          choices: [{
            index: 0,
            message: {
              role: 'assistant',
              content: 'Hello! How can I help you today?',
            },
            finish_reason: 'stop',
          }],
          usage: {
            prompt_tokens: 10,
            completion_tokens: 9,
            total_tokens: 19,
          },
        }),
      });

      const result = await provider.chat(
        [{ role: 'user', content: 'Hello' }],
        { model: 'gpt-4', temperature: 0.7 }
      );

      expect(result.content).toBe('Hello! How can I help you today?');
      expect(result.tokenUsage.promptTokens).toBe(10);
      expect(result.tokenUsage.completionTokens).toBe(9);
      expect(result.tokenUsage.totalTokens).toBe(19);
      expect(result.finishReason).toBe('stop');
    }, 10000);

    it('should handle tool calls in response', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          id: 'chatcmpl-123',
          choices: [{
            index: 0,
            message: {
              role: 'assistant',
              content: null,
              tool_calls: [{
                id: 'call_123',
                type: 'function',
                function: {
                  name: 'get_weather',
                  arguments: '{"location": "San Francisco"}',
                },
              }],
            },
            finish_reason: 'tool_calls',
          }],
          usage: {
            prompt_tokens: 50,
            completion_tokens: 20,
            total_tokens: 70,
          },
        }),
      });

      const result = await provider.chat(
        [{ role: 'user', content: 'What is the weather in SF?' }],
        { 
          model: 'gpt-4',
          temperature: 0.7,
          tools: [{
            name: 'get_weather',
            description: 'Get weather for a location',
            parameters: {},
          }],
        }
      );

      expect(result.toolCalls).toHaveLength(1);
      expect(result.toolCalls![0].name).toBe('get_weather');
      expect(result.toolCalls![0].arguments).toEqual({ location: 'San Francisco' });
      expect(result.finishReason).toBe('tool_calls');
    }, 10000);

    it('should include custom base URL in request', async () => {
      const customProvider = new OpenAIProvider('test-key', 'https://custom.api.com/v1');
      
      fetchMock.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          id: 'test-id',
          choices: [{
            index: 0,
            message: { role: 'assistant', content: 'Response' },
            finish_reason: 'stop',
          }],
          usage: {
            prompt_tokens: 10,
            completion_tokens: 5,
            total_tokens: 15,
          },
        }),
      });

      await customProvider.chat(
        [{ role: 'user', content: 'test' }],
        { model: 'gpt-4', temperature: 0.7 }
      );

      expect(fetchMock).toHaveBeenCalledWith(
        'https://custom.api.com/v1/chat/completions',
        expect.any(Object)
      );
    }, 10000);
  });

  describe('Request Configuration', () => {
    it('should send temperature in request', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          id: 'test-id',
          choices: [{
            index: 0,
            message: { role: 'assistant', content: 'Response' },
            finish_reason: 'stop',
          }],
          usage: {
            prompt_tokens: 10,
            completion_tokens: 5,
            total_tokens: 15,
          },
        }),
      });

      await provider.chat(
        [{ role: 'user', content: 'test' }],
        { model: 'gpt-4', temperature: 0.5 }
      );

      const requestBody = JSON.parse(fetchMock.mock.calls[0][1].body);
      expect(requestBody.temperature).toBe(0.5);
    }, 10000);

    it('should send maxTokens if provided', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          id: 'test-id',
          choices: [{
            index: 0,
            message: { role: 'assistant', content: 'Response' },
            finish_reason: 'stop',
          }],
          usage: {
            prompt_tokens: 10,
            completion_tokens: 5,
            total_tokens: 15,
          },
        }),
      });

      await provider.chat(
        [{ role: 'user', content: 'test' }],
        { model: 'gpt-4', temperature: 0.7, maxTokens: 100 }
      );

      const requestBody = JSON.parse(fetchMock.mock.calls[0][1].body);
      expect(requestBody.max_tokens).toBe(100);
    }, 10000);

    it('should include authorization header', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          id: 'test-id',
          choices: [{
            index: 0,
            message: { role: 'assistant', content: 'Response' },
            finish_reason: 'stop',
          }],
          usage: {
            prompt_tokens: 10,
            completion_tokens: 5,
            total_tokens: 15,
          },
        }),
      });

      await provider.chat(
        [{ role: 'user', content: 'test' }],
        { model: 'gpt-4', temperature: 0.7 }
      );

      expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe('Bearer test-api-key');
    }, 10000);
  });
});
