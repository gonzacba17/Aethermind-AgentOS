import type {
  LLMProvider,
  ChatMessage,
  LLMRequestConfig,
  LLMResponse,
  TokenUsage,
  ToolCall,
} from '../types/index.js';
import { retryWithBackoff, withTimeout } from '../utils/retry.js';

interface OpenAIMessage {
  role: string;
  content: string | null;
  name?: string;
  tool_call_id?: string;
  tool_calls?: Array<{
    id: string;
    type: 'function';
    function: {
      name: string;
      arguments: string;
    };
  }>;
}

interface OpenAIResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: OpenAIMessage;
    finish_reason: string;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

const OPENAI_MODEL_COSTS: Record<string, { input: number; output: number }> = {
  'gpt-4': { input: 0.03, output: 0.06 },
  'gpt-4-turbo': { input: 0.01, output: 0.03 },
  'gpt-4-turbo-2024-04-09': { input: 0.01, output: 0.03 },
  'gpt-4o': { input: 0.0025, output: 0.01 },
  'gpt-4o-2024-11-20': { input: 0.0025, output: 0.01 },
  'gpt-4o-2024-08-06': { input: 0.0025, output: 0.01 },
  'gpt-4o-2024-05-13': { input: 0.005, output: 0.015 },
  'gpt-4o-mini': { input: 0.00015, output: 0.0006 },
  'gpt-4o-mini-2024-07-18': { input: 0.00015, output: 0.0006 },
  'gpt-3.5-turbo': { input: 0.0005, output: 0.0015 },
  'gpt-3.5-turbo-0125': { input: 0.0005, output: 0.0015 },
  'o1-preview': { input: 0.015, output: 0.06 },
  'o1-preview-2024-09-12': { input: 0.015, output: 0.06 },
  'o1-mini': { input: 0.003, output: 0.012 },
  'o1-mini-2024-09-12': { input: 0.003, output: 0.012 },
};

// Export for use in CostEstimationService
export { OPENAI_MODEL_COSTS as MODEL_COSTS };

export class OpenAIProvider implements LLMProvider {
  name = 'openai';
  private apiKey: string;
  private baseUrl: string;

  constructor(apiKey: string, baseUrl = 'https://api.openai.com/v1') {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl;
  }

  async chat(messages: ChatMessage[], config: LLMRequestConfig): Promise<LLMResponse> {
    return retryWithBackoff(
      async () => {
        return withTimeout(
          async () => {
            const openaiMessages: OpenAIMessage[] = messages.map((msg) => ({
              role: msg.role,
              content: msg.content,
              ...(msg.name && { name: msg.name }),
              ...(msg.toolCallId && { tool_call_id: msg.toolCallId }),
            }));

            const body: Record<string, unknown> = {
              model: config.model,
              messages: openaiMessages,
              temperature: config.temperature ?? 0.7,
            };

            if (config.maxTokens) {
              body['max_tokens'] = config.maxTokens;
            }

            if (config.tools && config.tools.length > 0) {
              body['tools'] = config.tools.map((tool) => ({
                type: 'function',
                function: {
                  name: tool.name,
                  description: tool.description,
                  parameters: tool.parameters,
                },
              }));
            }

            const response = await fetch(`${this.baseUrl}/chat/completions`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${this.apiKey}`,
              },
              body: JSON.stringify(body),
            });

            if (!response.ok) {
              const error = await response.text();
              const statusError: any = new Error(`OpenAI API error: ${response.status} - ${error}`);
              statusError.status = response.status;
              throw statusError;
            }

            const data = (await response.json()) as OpenAIResponse;
            const choice = data.choices[0];

            if (!choice) {
              throw new Error('No response from OpenAI');
            }

            const toolCalls: ToolCall[] | undefined = choice.message.tool_calls?.map((tc) => ({
              id: tc.id,
              name: tc.function.name,
              arguments: JSON.parse(tc.function.arguments) as Record<string, unknown>,
            }));

            const finishReason = this.mapFinishReason(choice.finish_reason);

            return {
              content: choice.message.content || '',
              toolCalls,
              tokenUsage: {
                promptTokens: data.usage.prompt_tokens,
                completionTokens: data.usage.completion_tokens,
                totalTokens: data.usage.total_tokens,
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

  private mapFinishReason(
    reason: string
  ): 'stop' | 'tool_calls' | 'length' | 'error' {
    switch (reason) {
      case 'stop':
        return 'stop';
      case 'tool_calls':
        return 'tool_calls';
      case 'length':
        return 'length';
      default:
        return 'error';
    }
  }

  estimateCost(tokenUsage: TokenUsage, model = 'gpt-4'): number {
    const costs = OPENAI_MODEL_COSTS[model] || OPENAI_MODEL_COSTS['gpt-4']!;
    const inputCost = (tokenUsage.promptTokens / 1000) * costs.input;
    const outputCost = (tokenUsage.completionTokens / 1000) * costs.output;
    return inputCost + outputCost;
  }
}

export function createOpenAIProvider(apiKey: string, baseUrl?: string): OpenAIProvider {
  return new OpenAIProvider(apiKey, baseUrl);
}
