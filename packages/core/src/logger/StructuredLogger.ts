import { v4 as uuid } from 'uuid';
import EventEmitter from 'eventemitter3';
import type { LogEntry, LogLevel, LoggerInterface } from '../types/index.js';

export interface StructuredLoggerConfig {
  agentId?: string;
  executionId?: string;
  minLevel?: LogLevel;
}

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

export class StructuredLogger implements LoggerInterface {
  private config: StructuredLoggerConfig;
  private emitter: EventEmitter.EventEmitter;
  private logs: LogEntry[] = [];

  constructor(config: StructuredLoggerConfig = {}, emitter?: EventEmitter.EventEmitter) {
    this.config = {
      minLevel: 'debug',
      ...config,
    };
    this.emitter = emitter || new EventEmitter.EventEmitter();
  }

  private shouldLog(level: LogLevel): boolean {
    const minLevel = this.config.minLevel || 'debug';
    return LOG_LEVELS[level] >= LOG_LEVELS[minLevel];
  }

  private log(level: LogLevel, message: string, metadata?: Record<string, unknown>): void {
    if (!this.shouldLog(level)) return;

    const entry: LogEntry = {
      id: uuid(),
      timestamp: new Date(),
      level,
      message,
      agentId: this.config.agentId,
      executionId: this.config.executionId,
      metadata,
    };

    this.logs.push(entry);
    this.emitter.emit('log', entry);
    this.emitter.emit(`log:${level}`, entry);

    const formatted = this.format(entry);
    if (level === 'error') {
      console.error(formatted);
    } else if (level === 'warn') {
      console.warn(formatted);
    } else {
      console.log(formatted);
    }
  }

  private format(entry: LogEntry): string {
    const timestamp = entry.timestamp.toISOString();
    const level = entry.level.toUpperCase().padEnd(5);
    const agent = entry.agentId ? `[${entry.agentId}]` : '';
    const execution = entry.executionId ? `(${entry.executionId.slice(0, 8)})` : '';
    const meta = entry.metadata ? ` ${JSON.stringify(entry.metadata)}` : '';
    return `${timestamp} ${level} ${agent}${execution} ${entry.message}${meta}`;
  }

  debug(message: string, metadata?: Record<string, unknown>): void {
    this.log('debug', message, metadata);
  }

  info(message: string, metadata?: Record<string, unknown>): void {
    this.log('info', message, metadata);
  }

  warn(message: string, metadata?: Record<string, unknown>): void {
    this.log('warn', message, metadata);
  }

  error(message: string, metadata?: Record<string, unknown>): void {
    this.log('error', message, metadata);
  }

  getLogs(): LogEntry[] {
    return [...this.logs];
  }

  getLogsByLevel(level: LogLevel): LogEntry[] {
    return this.logs.filter((log) => log.level === level);
  }

  clear(): void {
    this.logs = [];
  }

  child(config: Partial<StructuredLoggerConfig>): StructuredLogger {
    return new StructuredLogger(
      { ...this.config, ...config },
      this.emitter
    );
  }

  onLog(callback: (entry: LogEntry) => void): () => void {
    this.emitter.on('log', callback);
    return () => this.emitter.off('log', callback);
  }

  getEmitter(): EventEmitter.EventEmitter {
    return this.emitter;
  }
}

export function createLogger(config?: StructuredLoggerConfig): StructuredLogger {
  return new StructuredLogger(config);
}
