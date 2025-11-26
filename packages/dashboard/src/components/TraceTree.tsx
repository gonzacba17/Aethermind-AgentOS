'use client';

import { useState } from 'react';
import { ChevronRight, ChevronDown, Bot, Wrench, Brain, Workflow } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import type { TraceNode } from '@/lib/api';
import { formatDuration } from '@/lib/utils';

interface TraceTreeProps {
  node: TraceNode;
  depth?: number;
}

function getNodeIcon(type: TraceNode['type']) {
  switch (type) {
    case 'agent':
      return <Bot className="w-4 h-4" />;
    case 'tool':
      return <Wrench className="w-4 h-4" />;
    case 'llm':
      return <Brain className="w-4 h-4" />;
    case 'workflow':
      return <Workflow className="w-4 h-4" />;
    default:
      return null;
  }
}

function getTypeColor(type: TraceNode['type']) {
  switch (type) {
    case 'agent':
      return 'text-blue-500';
    case 'tool':
      return 'text-purple-500';
    case 'llm':
      return 'text-green-500';
    case 'workflow':
      return 'text-orange-500';
    default:
      return 'text-gray-500';
  }
}

export function TraceTree({ node, depth = 0 }: TraceTreeProps) {
  const [isExpanded, setIsExpanded] = useState(depth < 2);
  const hasChildren = node.children && node.children.length > 0;

  return (
    <div className="select-none">
      <div
        className={cn(
          'flex items-center gap-2 py-1 px-2 rounded cursor-pointer hover:bg-muted/50',
          node.error && 'bg-destructive/10'
        )}
        style={{ paddingLeft: `${depth * 20 + 8}px` }}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        {hasChildren ? (
          isExpanded ? (
            <ChevronDown className="w-4 h-4 text-muted-foreground" />
          ) : (
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          )
        ) : (
          <span className="w-4" />
        )}
        <span className={cn('flex items-center gap-1', getTypeColor(node.type))}>
          {getNodeIcon(node.type)}
        </span>
        <span className="font-medium">{node.name}</span>
        <Badge variant="outline" className="text-[10px]">
          {node.type}
        </Badge>
        {node.duration !== undefined && (
          <span className="text-xs text-muted-foreground">{formatDuration(node.duration)}</span>
        )}
        {node.error && (
          <Badge variant="destructive" className="text-[10px]">
            Error
          </Badge>
        )}
      </div>

      {isExpanded && (
        <div className="ml-4">
          {node.input !== undefined && (
            <div className="text-xs px-2 py-1" style={{ paddingLeft: `${depth * 20 + 28}px` }}>
              <span className="text-muted-foreground">Input: </span>
              <code className="bg-muted px-1 rounded">
                {typeof node.input === 'string'
                  ? node.input.slice(0, 100)
                  : JSON.stringify(node.input).slice(0, 100)}
              </code>
            </div>
          )}
          {node.output !== undefined && (
            <div className="text-xs px-2 py-1" style={{ paddingLeft: `${depth * 20 + 28}px` }}>
              <span className="text-muted-foreground">Output: </span>
              <code className="bg-muted px-1 rounded">
                {typeof node.output === 'string'
                  ? node.output.slice(0, 100)
                  : JSON.stringify(node.output).slice(0, 100)}
              </code>
            </div>
          )}
          {node.error && (
            <div
              className="text-xs px-2 py-1 text-destructive"
              style={{ paddingLeft: `${depth * 20 + 28}px` }}
            >
              <span className="font-medium">Error: </span>
              {node.error}
            </div>
          )}
          {hasChildren && node.children.map((child) => (
            <TraceTree key={child.id} node={child} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}
