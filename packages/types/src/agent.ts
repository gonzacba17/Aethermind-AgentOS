export interface Agent {
  id: string;
  name: string;
  model: string;
  status: 'idle' | 'running' | 'completed' | 'failed' | 'timeout';
  config: {
    name: string;
    model: string;
    systemPrompt?: string;
    maxRetries: number;
    timeout: number;
    temperature: number;
    maxTokens?: number;
  };
}
