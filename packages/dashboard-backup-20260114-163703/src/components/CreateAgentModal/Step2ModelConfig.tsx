'use client';

import { Label } from '@/components/ui/label';
import { MODEL_OPTIONS, type AgentFormData } from './types';

interface Step2ModelConfigProps {
  formData: AgentFormData;
  updateFormData: (data: Partial<AgentFormData>) => void;
}

export function Step2ModelConfig({ formData, updateFormData }: Step2ModelConfigProps) {
  const handleProviderChange = (provider: AgentFormData['provider']) => {
    updateFormData({
      provider,
      model: MODEL_OPTIONS[provider][0], // Reset to first model of new provider
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <Label htmlFor="provider">
          AI Provider <span className="text-destructive">*</span>
        </Label>
        <select
          id="provider"
          value={formData.provider}
          onChange={(e) => handleProviderChange(e.target.value as AgentFormData['provider'])}
          className="mt-2 w-full border rounded-md px-3 py-2 bg-background"
        >
          <option value="openai">OpenAI</option>
          <option value="anthropic">Anthropic</option>
          <option value="google">Google</option>
          <option value="ollama">Ollama (Local)</option>
        </select>
        <p className="text-xs text-muted-foreground mt-1">
          Select your AI model provider
        </p>
      </div>

      <div>
        <Label htmlFor="model">
          Model <span className="text-destructive">*</span>
        </Label>
        <select
          id="model"
          value={formData.model}
          onChange={(e) => updateFormData({ model: e.target.value })}
          className="mt-2 w-full border rounded-md px-3 py-2 bg-background"
        >
          {MODEL_OPTIONS[formData.provider].map((model) => (
            <option key={model} value={model}>
              {model}
            </option>
          ))}
        </select>
        <p className="text-xs text-muted-foreground mt-1">
          Choose the specific model to use
        </p>
      </div>

      <div>
        <Label htmlFor="temperature">
          Temperature: {formData.temperature.toFixed(1)}
        </Label>
        <div className="mt-2">
          <input
            id="temperature"
            type="range"
            min="0"
            max="1"
            step="0.1"
            value={formData.temperature}
            onChange={(e) => updateFormData({ temperature: parseFloat(e.target.value) })}
            className="w-full"
          />
          <div className="flex justify-between text-xs text-muted-foreground mt-1">
            <span>Precise (0.0)</span>
            <span>Balanced (0.5)</span>
            <span>Creative (1.0)</span>
          </div>
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          Controls randomness: lower is more focused, higher is more creative
        </p>
      </div>

      <div>
        <Label htmlFor="maxTokens">Max Tokens (Optional)</Label>
        <input
          id="maxTokens"
          type="number"
          min="1"
          max="100000"
          value={formData.maxTokens || ''}
          onChange={(e) => updateFormData({ 
            maxTokens: e.target.value ? parseInt(e.target.value) : undefined 
          })}
          placeholder="Leave empty for model default"
          className="mt-2 w-full border rounded-md px-3 py-2 bg-background"
        />
        <p className="text-xs text-muted-foreground mt-1">
          Maximum number of tokens in the response
        </p>
      </div>
    </div>
  );
}
