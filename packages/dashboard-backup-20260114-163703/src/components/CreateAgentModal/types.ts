export interface AgentFormData {
  // Step 1: Basic Info
  name: string;
  description: string;
  tags: string[];
  
  // Step 2: Model Config
  provider: 'openai' | 'anthropic' | 'google' | 'ollama';
  model: string;
  temperature: number;
  maxTokens?: number;
  
  // Step 3: System Prompt
  systemPrompt: string;
}

export interface WizardStep {
  id: number;
  title: string;
  description: string;
}

export const WIZARD_STEPS: WizardStep[] = [
  { id: 1, title: 'Basic Info', description: 'Name and description' },
  { id: 2, title: 'Model Config', description: 'Select AI model' },
  { id: 3, title: 'System Prompt', description: 'Define behavior' },
  { id: 4, title: 'Review', description: 'Confirm details' },
];

export const MODEL_OPTIONS = {
  openai: ['gpt-4', 'gpt-4-turbo', 'gpt-4o', 'gpt-4o-mini', 'gpt-3.5-turbo'],
  anthropic: ['claude-3-5-sonnet-20241022', 'claude-3-opus-20240229', 'claude-3-haiku-20240307'],
  google: ['gemini-pro', 'gemini-1.5-pro'],
  ollama: ['llama2', 'mistral', 'codellama'],
};

export const SYSTEM_PROMPT_TEMPLATES = {
  blank: '',
  research: 'You are a research assistant specializing in gathering and analyzing information. Provide comprehensive, well-sourced answers with citations when possible.',
  code: 'You are an expert software engineer. Write clean, efficient, and well-documented code. Explain your reasoning and suggest best practices.',
  data: 'You are a data analyst expert. Analyze data patterns, create insights, and provide actionable recommendations based on the information provided.',
  support: 'You are a helpful customer support agent. Be empathetic, professional, and solution-oriented. Always prioritize customer satisfaction.',
  writer: 'You are a professional content writer. Create engaging, clear, and well-structured content tailored to the target audience.',
};
