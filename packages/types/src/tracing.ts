export interface TraceNode {
  id: string;
  parentId?: string;
  name: string;
  type: 'agent' | 'tool' | 'llm' | 'workflow';
  startedAt: string;
  completedAt?: string;
  duration?: number;
  input?: unknown;
  output?: unknown;
  error?: string;
  children: TraceNode[];
}

export interface Trace {
  id: string;
  executionId: string;
  rootNode: TraceNode;
  createdAt: string;
}
