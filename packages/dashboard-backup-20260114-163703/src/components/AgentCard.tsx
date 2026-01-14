'use client';

import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Play, Settings, Trash2 } from 'lucide-react';
import type { Agent } from '@/lib/api';

interface AgentCardProps {
  agent: Agent;
  onExecute?: (agent: Agent) => void;
  onDelete?: (agent: Agent) => void;
  onConfigure?: (agent: Agent) => void;
}

function getStatusVariant(status: Agent['status']) {
  switch (status) {
    case 'idle':
      return 'secondary';
    case 'running':
      return 'warning';
    case 'completed':
      return 'success';
    case 'failed':
    case 'timeout':
      return 'destructive';
    default:
      return 'default';
  }
}

export function AgentCard({ agent, onExecute, onDelete, onConfigure }: AgentCardProps) {
  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">{agent.name}</CardTitle>
          <Badge variant={getStatusVariant(agent.status)}>{agent.status}</Badge>
        </div>
        <CardDescription>{agent.model}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Temperature:</span>
            <span>{agent.config.temperature}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Timeout:</span>
            <span>{agent.config.timeout}ms</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Max Retries:</span>
            <span>{agent.config.maxRetries}</span>
          </div>
          {agent.config.systemPrompt && (
            <div className="mt-2">
              <span className="text-muted-foreground">System Prompt:</span>
              <p className="text-xs mt-1 line-clamp-2">{agent.config.systemPrompt}</p>
            </div>
          )}
        </div>
      </CardContent>
      <CardFooter className="flex gap-2">
        <Button size="sm" onClick={() => onExecute?.(agent)} disabled={agent.status === 'running'}>
          <Play className="w-4 h-4 mr-1" />
          Execute
        </Button>
        <Button size="sm" variant="outline" onClick={() => onConfigure?.(agent)}>
          <Settings className="w-4 h-4" />
        </Button>
        <Button size="sm" variant="ghost" onClick={() => onDelete?.(agent)}>
          <Trash2 className="w-4 h-4 text-destructive" />
        </Button>
      </CardFooter>
    </Card>
  );
}
