'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Edit2 } from 'lucide-react';
import type { AgentFormData } from './types';

interface Step4ReviewProps {
  formData: AgentFormData;
  onEdit: (step: number) => void;
}

export function Step4Review({ formData, onEdit }: Step4ReviewProps) {
  return (
    <div className="space-y-4">
      {/* Basic Information */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-start justify-between mb-4">
            <h3 className="font-semibold text-lg">Basic Information</h3>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onEdit(1)}
              type="button"
            >
              <Edit2 className="h-4 w-4 mr-1" />
              Edit
            </Button>
          </div>
          <dl className="space-y-2">
            <div>
              <dt className="text-sm text-muted-foreground">Name</dt>
              <dd className="text-sm font-medium">{formData.name}</dd>
            </div>
            {formData.description && (
              <div>
                <dt className="text-sm text-muted-foreground">Description</dt>
                <dd className="text-sm">{formData.description}</dd>
              </div>
            )}
            {formData.tags.length > 0 && (
              <div>
                <dt className="text-sm text-muted-foreground">Tags</dt>
                <dd className="flex flex-wrap gap-1 mt-1">
                  {formData.tags.map((tag) => (
                    <span
                      key={tag}
                      className="inline-block px-2 py-0.5 bg-primary/10 text-primary rounded text-xs"
                    >
                      {tag}
                    </span>
                  ))}
                </dd>
              </div>
            )}
          </dl>
        </CardContent>
      </Card>

      {/* Model Configuration */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-start justify-between mb-4">
            <h3 className="font-semibold text-lg">Model Configuration</h3>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onEdit(2)}
              type="button"
            >
              <Edit2 className="h-4 w-4 mr-1" />
              Edit
            </Button>
          </div>
          <dl className="space-y-2">
            <div>
              <dt className="text-sm text-muted-foreground">Provider</dt>
              <dd className="text-sm font-medium capitalize">{formData.provider}</dd>
            </div>
            <div>
              <dt className="text-sm text-muted-foreground">Model</dt>
              <dd className="text-sm font-medium">{formData.model}</dd>
            </div>
            <div>
              <dt className="text-sm text-muted-foreground">Temperature</dt>
              <dd className="text-sm">{formData.temperature.toFixed(1)}</dd>
            </div>
            {formData.maxTokens && (
              <div>
                <dt className="text-sm text-muted-foreground">Max Tokens</dt>
                <dd className="text-sm">{formData.maxTokens.toLocaleString()}</dd>
              </div>
            )}
          </dl>
        </CardContent>
      </Card>

      {/* System Prompt */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-start justify-between mb-4">
            <h3 className="font-semibold text-lg">System Prompt</h3>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onEdit(3)}
              type="button"
            >
              <Edit2 className="h-4 w-4 mr-1" />
              Edit
            </Button>
          </div>
          <div className="bg-muted/50 rounded-md p-3 max-h-[200px] overflow-y-auto">
            <pre className="text-sm whitespace-pre-wrap font-mono">
              {formData.systemPrompt || (
                <span className="text-muted-foreground italic">No system prompt provided</span>
              )}
            </pre>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
