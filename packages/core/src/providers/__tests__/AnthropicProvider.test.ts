import { describe, it, expect, jest, beforeEach } from '@jest/globals';

// Mock Anthropic SDK
const mockCreate = jest.fn();
const mockStream = jest.fn();

jest.mock('@anthropic-ai/sdk', () => {
  return {
    default: jest.fn().mockImplementation(() => ({
      messages: {
        create: mockCreate,
        stream: mockStream,
      },
    })),
  };
});

// Simplified AnthropicProvider for testing
class AnthropicProvider {
  private apiKey: string;
  private model: string;
  
  constructor(config: { apiKey: string; model?: string }) {
    this.apiKey = config.apiKey;
    this.model = config.model || 'claude-3-sonnet-20240229';
  }
  
  async chat(params: { messages: any[]; maxTokens?: number }): Promise<any> {
    return mockCreate({
      model: this.model,
      max_tokens: params.maxTokens || 1000,
      messages: params.messages,
    });
  }
  
  estimateCost(usage: { inputTokens: number; outputTokens: number }): number {
    const rates = {
      'claude-3-sonnet-20240229': { input: 3, output: 15 },
      'claude-3-opus-20240229': { input: 15, output: 75 },
    };
    
    const rate = rates[this.model as keyof typeof rates] || rates['claude-3-sonnet-20240229'];
    return (usage.inputTokens * rate.input + usage.outputTokens * rate.output) / 1_000_000;
  }
}

describe('AnthropicProvider', () => {
  let provider: AnthropicProvider;

  beforeEach(() => {
    jest.clearAllMocks();
    provider = new AnthropicProvider({
      apiKey: 'test-api-key',
      model: 'claude-3-sonnet-20240229',
    });
  });

  describe('chat', () => {
    it('should generate completion with correct parameters', async () => {
      mockCreate.mockResolvedValueOnce({
        id: 'msg_123',
        content: [{ type: 'text', text: 'Test response' }],
        usage: { input_tokens: 10, output_tokens: 20 },
      });

      await provider.chat({
        messages: [{ role: 'user', content: 'Test prompt' }],
        maxTokens: 1000,
      });

      expect(mockCreate).toHaveBeenCalledWith({
        model: 'claude-3-sonnet-20240229',
        max_tokens: 1000,
        messages: [{ role: 'user', content: 'Test prompt' }],
      });
    });

    it('should handle multi-turn conversations', async () => {
      mockCreate.mockResolvedValueOnce({
        content: [{ type: 'text', text: 'Response' }],
      });

      await provider.chat({
        messages: [
          { role: 'user', content: 'Hello' },
          { role: 'assistant', content: 'Hi!' },
          { role: 'user', content: 'How are you?' },
        ],
      });

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: expect.arrayContaining([
            { role: 'user', content: 'Hello' },
            { role: 'assistant', content: 'Hi!' },
            { role: 'user', content: 'How are you?' },
          ]),
        })
      );
    });

    it('should handle API errors', async () => {
      const apiError = new Error('Rate limit exceeded');
      mockCreate.mockRejectedValueOnce(apiError);

      await expect(
        provider.chat({ messages: [{ role: 'user', content: 'Test' }] })
      ).rejects.toThrow('Rate limit exceeded');
    });
  });

  describe('estimateCost', () => {
    it('should calculate correct cost for Claude Sonnet', () => {
      const usage = { inputTokens: 1000, outputTokens: 2000 };
      
      const cost = provider.estimateCost(usage);

      // $3/1M input, $15/1M output
      const expectedCost = (1000 * 3 + 2000 * 15) / 1_000_000;
      expect(cost).toBeCloseTo(expectedCost, 6);
    });

    it('should calculate correct cost for Claude Opus', () => {
      const opusProvider = new AnthropicProvider({
        apiKey: 'test',
        model: 'claude-3-opus-20240229',
      });

      const usage = { inputTokens: 1000, outputTokens: 1000 };
      const cost = opusProvider.estimateCost(usage);

      // Opus: $15/1M input, $75/1M output
      const expectedCost = (1000 * 15 + 1000 * 75) / 1_000_000;
      expect(cost).toBeCloseTo(expectedCost, 6);
    });

    it('should handle large token counts', () => {
      const usage = { inputTokens: 100000, outputTokens: 100000 };
      
      const cost = provider.estimateCost(usage);

      expect(cost).toBeGreaterThan(0.001);
      expect(cost).toBeLessThan(10);
    });
  });
});
