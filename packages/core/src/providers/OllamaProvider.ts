import type {
  LLMProvider,
  ChatMessage,
  LLMRequestConfig,
  LLMResponse,
  TokenUsage,
} from '../types/index.js';

interface OllamaMessage {
  role: string;
  content: string;
}

interface OllamaResponse {
  model: string;
  created_at: string;
  message: {
    role: string;
    content: string;
  };
  done: boolean;
  total_duration?: number;
  load_duration?: number;
  prompt_eval_count?: number;
  prompt_eval_duration?: number;
  eval_count?: number;
  eval_duration?: number;
}

// Ollama models are local and free
const OLLAMA_MODEL_COSTS: Record<string, { input: number; output: number }> = {
  'llama3.2': { input: 0, output: 0 },
  'llama3.1': { input: 0, output: 0 },
  'llama3': { input: 0, output: 0 },
  'llama2': { input: 0, output: 0 },
  'mistral': { input: 0, output: 0 },
  'mixtral': { input: 0, output: 0 },
  'codellama': { input: 0, output: 0 },
  'phi': { input: 0, output: 0 },
  'gemma': { input: 0, output: 0 },
  'qwen': { input: 0, output: 0 },
};

// Export for use in CostEstimationService
export { OLLAMA_MODEL_COSTS as MODEL_COSTS };

export class OllamaProvider implements LLMProvider {
  name = 'ollama';
  private baseUrl: string;

  constructor(baseUrl = 'http://localhost:11434') {
    this.baseUrl = baseUrl;
  }

  async chat(messages: ChatMessage[], config: LLMRequestConfig): Promise<LLMResponse> {
    const ollamaMessages: OllamaMessage[] = messages.map((msg) => ({
      role: msg.role,
      content: msg.content,
    }));

    const body: Record<string, unknown> = {
      model: config.model,
      messages: ollamaMessages,
      stream: false,
      options: {},
    };

    if (config.temperature !== undefined) {
      (body['options'] as Record<string, unknown>)['temperature'] = config.temperature;
    }

    if (config.maxTokens) {
      (body['options'] as Record<string, unknown>)['num_predict'] = config.maxTokens;
    }

    const response = await fetch(`${this.baseUrl}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Ollama API error: ${response.status} - ${error}`);
    }

    const data = (await response.json()) as OllamaResponse;

    const promptTokens = data.prompt_eval_count || 0;
    const completionTokens = data.eval_count || 0;

    return {
      content: data.message.content,
      tokenUsage: {
        promptTokens,
        completionTokens,
        totalTokens: promptTokens + completionTokens,
      },
      finishReason: 'stop',
    };
  }

  estimateCost(_tokenUsage: TokenUsage): number {
    return 0;
  }

  async listModels(): Promise<string[]> {
    const response = await fetch(`${this.baseUrl}/api/tags`);
    if (!response.ok) {
      throw new Error('Failed to list Ollama models');
    }
    const data = (await response.json()) as { models: Array<{ name: string }> };
    return data.models.map((m) => m.name);
  }

  async pullModel(model: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/api/pull`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ name: model }),
    });

    if (!response.ok) {
      throw new Error(`Failed to pull model: ${model}`);
    }
  }
}

export function createOllamaProvider(baseUrl?: string): OllamaProvider {
  return new OllamaProvider(baseUrl);
}
