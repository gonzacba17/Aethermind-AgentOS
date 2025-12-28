'use client';

import { useState } from 'react';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Eye, EyeOff } from 'lucide-react';
import { SYSTEM_PROMPT_TEMPLATES, type AgentFormData } from './types';

interface Step3SystemPromptProps {
  formData: AgentFormData;
  updateFormData: (data: Partial<AgentFormData>) => void;
}

export function Step3SystemPrompt({ formData, updateFormData }: Step3SystemPromptProps) {
  const [showPreview, setShowPreview] = useState(false);

  const handleTemplateSelect = (template: keyof typeof SYSTEM_PROMPT_TEMPLATES) => {
    updateFormData({ systemPrompt: SYSTEM_PROMPT_TEMPLATES[template] });
  };

  const charCount = formData.systemPrompt.length;

  return (
    <div className="space-y-6">
      <div>
        <Label htmlFor="template">Quick Templates</Label>
        <select
          id="template"
          onChange={(e) => handleTemplateSelect(e.target.value as keyof typeof SYSTEM_PROMPT_TEMPLATES)}
          className="mt-2 w-full border rounded-md px-3 py-2 bg-background"
          defaultValue=""
        >
          <option value="" disabled>Select a template...</option>
          <option value="blank">Blank (Custom)</option>
          <option value="research">Research Assistant</option>
          <option value="code">Code Generator</option>
          <option value="data">Data Analyzer</option>
          <option value="support">Customer Support</option>
          <option value="writer">Content Writer</option>
        </select>
        <p className="text-xs text-muted-foreground mt-1">
          Start with a template or write your own
        </p>
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <Label htmlFor="systemPrompt">
            System Prompt <span className="text-destructive">*</span>
          </Label>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowPreview(!showPreview)}
            type="button"
          >
            {showPreview ? (
              <>
                <EyeOff className="h-4 w-4 mr-2" />
                Edit
              </>
            ) : (
              <>
                <Eye className="h-4 w-4 mr-2" />
                Preview
              </>
            )}
          </Button>
        </div>

        {showPreview ? (
          <div className="border rounded-md p-4 bg-muted/50 min-h-[200px] whitespace-pre-wrap">
            {formData.systemPrompt || (
              <span className="text-muted-foreground italic">No prompt entered yet</span>
            )}
          </div>
        ) : (
          <textarea
            id="systemPrompt"
            value={formData.systemPrompt}
            onChange={(e) => updateFormData({ systemPrompt: e.target.value })}
            placeholder="You are a helpful AI assistant..."
            rows={10}
            className="w-full border rounded-md px-3 py-2 bg-background text-sm font-mono"
          />
        )}

        <div className="flex justify-between items-center mt-1">
          <p className="text-xs text-muted-foreground">
            Define how your agent should behave and respond
          </p>
          <span className="text-xs text-muted-foreground">
            {charCount} characters
          </span>
        </div>
      </div>
    </div>
  );
}
