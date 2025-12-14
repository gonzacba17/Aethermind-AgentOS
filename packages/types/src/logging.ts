export interface LogEntry {
  id: string;
  timestamp: Date;
  level: 'debug' | 'info' | 'warn' | 'error';
  message: string;
  agentId?: string;
  executionId?: string;
  metadata?: Record<string, unknown>;
}
