'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { X, Plus } from 'lucide-react';
import type { AgentFormData } from './types';

interface Step1BasicInfoProps {
  formData: AgentFormData;
  updateFormData: (data: Partial<AgentFormData>) => void;
  existingAgentNames?: string[];
}

export function Step1BasicInfo({ formData, updateFormData, existingAgentNames = [] }: Step1BasicInfoProps) {
  const [tagInput, setTagInput] = useState('');
  
  const nameError = formData.name && formData.name.length < 3
    ? 'Name must be at least 3 characters'
    : formData.name && !/^[a-z0-9-]+$/i.test(formData.name)
    ? 'Only alphanumeric characters and hyphens allowed'
    : existingAgentNames.includes(formData.name.toLowerCase())
    ? 'An agent with this name already exists'
    : '';

  const addTag = () => {
    if (tagInput.trim() && !formData.tags.includes(tagInput.trim())) {
      updateFormData({ tags: [...formData.tags, tagInput.trim()] });
      setTagInput('');
    }
  };

  const removeTag = (tag: string) => {
    updateFormData({ tags: formData.tags.filter((t) => t !== tag) });
  };

  return (
    <div className="space-y-6">
      <div>
        <Label htmlFor="agent-name">
          Agent Name <span className="text-destructive">*</span>
        </Label>
        <Input
          id="agent-name"
          value={formData.name}
          onChange={(e) => updateFormData({ name: e.target.value })}
          placeholder="my-agent"
          className="mt-2"
        />
        {nameError && (
          <p className="text-sm text-destructive mt-1">{nameError}</p>
        )}
        <p className="text-xs text-muted-foreground mt-1">
          Choose a unique, descriptive name for your agent
        </p>
      </div>

      <div>
        <Label htmlFor="agent-description">Description</Label>
        <textarea
          id="agent-description"
          value={formData.description}
          onChange={(e) => updateFormData({ description: e.target.value })}
          placeholder="Describe what this agent does..."
          rows={3}
          className="mt-2 w-full border rounded-md px-3 py-2 bg-background text-sm"
        />
        <p className="text-xs text-muted-foreground mt-1">
          Optional: Explain the purpose and capabilities of this agent
        </p>
      </div>

      <div>
        <Label htmlFor="agent-tags">Tags</Label>
        <div className="flex gap-2 mt-2">
          <Input
            id="agent-tags"
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addTag())}
            placeholder="Add a tag..."
          />
          <Button onClick={addTag} variant="outline" size="sm" type="button">
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        {formData.tags.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-2">
            {formData.tags.map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center gap-1 px-2 py-1 bg-primary/10 text-primary rounded-md text-sm"
              >
                {tag}
                <button
                  onClick={() => removeTag(tag)}
                  className="hover:text-destructive"
                  type="button"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
        )}
        <p className="text-xs text-muted-foreground mt-1">
          Optional: Add tags for organization and filtering
        </p>
      </div>
    </div>
  );
}
