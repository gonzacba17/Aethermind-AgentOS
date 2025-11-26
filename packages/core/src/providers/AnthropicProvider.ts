import type {
  LLMProvider,
  ChatMessage,
  LLMRequestConfig,
  LLMResponse,
  TokenUsage,
  ToolCall,
} from '../types/index.js';
import { retryWithBackoff, withTimeout } from '../utils/retry.js';

interface AnthropicMessage {
  role: 'user' | 'assistant';
  content: string | Array<{ type: string; text?: string; tool_use_id?: string; content?: string }>;
}

interface AnthropicResponse {
  id: string;
  type: string;
  role: string;
  content: Array<{
    type: 'text' | 'tool_use';
    text?: string;
    id?: string;
    name?: string;
    input?: Record<string, unknown>;
  }>;
  model: string;
  stop_reason: string;
  usage: {
    input_tokens: number;
    output_tokens: number;
  };
}

const ANTHROPIC_MODEL_COSTS: Record<string, { input: number; output: number }> = {
  'claude-3-opus-20240229': { input: 0.015, output: 0.075 },
  'claude-3-5-sonnet-20241022': { input: 0.003, output: 0.015 },
  'claude-3-5-sonnet-20240620': { input: 0.003, output: 0.015 },
  'claude-3-5-haiku-20241022': { input: 0.0008, output: 0.004 },
  'claude-3-sonnet-20240229': { input: 0.003, output: 0.015 },
  'claude-3-haiku-20240307': { input: 0.00025, output: 0.00125 },
};

// Export for use in CostEstimationService
export { ANTHROPIC_MODEL_COSTS as MODEL_COSTS };

export class AnthropicProvider implements LLMProvider {
  name = 'anthropic';
  private apiKey: string;
  private baseUrl: string;

  constructor(apiKey: string, baseUrl = 'https://api.anthropic.com/v1') {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl;
  }

  async chat(messages: ChatMessage[], config: LLMRequestConfig): Promise<LLMResponse> {
    return retryWithBackoff(
      async () => {
        return withTimeout(
          async () => {
            const systemMessage = messages.find((m) => m.role === 'system');
            const nonSystemMessages = messages.filter((m) => m.role !== 'system');

            const anthropicMessages: AnthropicMessage[] = nonSystemMessages.map((msg) => ({
              role: msg.role === 'assistant' ? 'assistant' : 'user',
              content: msg.content,
            }));

            const body: Record<string, unknown> = {
              model: config.model,
              messages: anthropicMessages,
              max_tokens: config.maxTokens || 4096,
            };

            if (systemMessage) {
              body['system'] = systemMessage.content;
            }

            if (config.temperature !== undefined) {
              body['temperature'] = config.temperature;
            }

            if (config.tools && config.tools.length > 0) {
              body['tools'] = config.tools.map((tool) => ({
                name: tool.name,
                description: tool.description,
                input_schema: tool.parameters,
              }));
            }

            const response = await fetch(`${this.baseUrl}/messages`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'x-api-key': this.apiKey,
                'anthropic-version': '2023-06-01',
              },
              body: JSON.stringify(body),
            });

            if (!response.ok) {
              const error = await response.text();
              const statusError: any = new Error(`Anthropic API error: ${response.status} - ${error}`);
              statusError.status = response.status;
              throw statusError;
            }

            const data = (await response.json()) as AnthropicResponse;

            let content = '';
            const toolCalls: ToolCall[] = [];

            for (const block of data.content) {
              if (block.type === 'text' && block.text) {
                content += block.text;
              } else if (block.type === 'tool_use' && block.id && block.name && block.input) {
                toolCalls.push({
                  id: block.id,
                  name: block.name,
                  arguments: block.input,
                });
              }
            }

            const finishReason = this.mapStopReason(data.stop_reason);

            return {
              content,
              toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
              tokenUsage: {
                promptTokens: data.usage.input_tokens,
                completionTokens: data.usage.output_tokens,
                totalTokens: data.usage.input_tokens + data.usage.output_tokens,
              },
              finishReason,
            };
          },
          30000
        );
      },
      {
        maxAttempts: 3,
        initialDelay: 1000,
        maxDelay: 10000,
        backoffFactor: 2,
        retryableStatuses: [408, 429, 500, 502, 503, 504],
      }
    );
  }

  private mapStopReason(
    reason: string
  ): 'stop' | 'tool_calls' | 'length' | 'error' {
    switch (reason) {
      case 'end_turn':
        return 'stop';
      case 'tool_use':
        return 'tool_calls';
      case 'max_tokens':
        return 'length';
      default:
        return 'error';
    }
  }

  estimateCost(tokenUsage: TokenUsage, model = 'claude-3-5-sonnet-20241022'): number {
    const costs = ANTHROPIC_MODEL_COSTS[model] || ANTHROPIC_MODEL_COSTS['claude-3-5-sonnet-20241022']!;
    const inputCost = (tokenUsage.promptTokens / 1000) * costs.input;
    const outputCost = (tokenUsage.completionTokens / 1000) * costs.output;
    return inputCost + outputCost;
  }
}

export function createAnthropicProvider(apiKey: string, baseUrl?: string): AnthropicProvider {
  return new AnthropicProvider(apiKey, baseUrl);
}
