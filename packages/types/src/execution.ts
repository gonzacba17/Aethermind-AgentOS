export interface ExecutionResult {
  executionId: string;
  agentId: string;
  status: 'idle' | 'running' | 'completed' | 'failed' | 'timeout';
  output: unknown;
  error?: Error;
  startedAt: Date;
  completedAt: Date;
  duration: number;
}
