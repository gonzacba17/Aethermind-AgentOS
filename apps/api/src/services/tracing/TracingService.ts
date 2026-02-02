/**
 * OpenTelemetry Distributed Tracing Service
 *
 * Provides comprehensive tracing for LLM operations including:
 * - Automatic span creation and context propagation
 * - Integration with Jaeger/Zipkin exporters
 * - Custom attributes for AI/LLM workloads
 * - Performance metrics collection
 */

import { randomUUID } from 'crypto';

// ============================================
// TYPES
// ============================================

export interface SpanContext {
  traceId: string;
  spanId: string;
  traceFlags: number;
  traceState?: string;
}

export interface SpanAttributes {
  [key: string]: string | number | boolean | string[] | number[] | boolean[];
}

export interface SpanEvent {
  name: string;
  timestamp: Date;
  attributes?: SpanAttributes;
}

export interface SpanLink {
  context: SpanContext;
  attributes?: SpanAttributes;
}

export type SpanKind = 'internal' | 'server' | 'client' | 'producer' | 'consumer' | 'llm' | 'tool' | 'chain' | 'agent';
export type SpanStatus = 'ok' | 'error' | 'unset';

export interface Span {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  name: string;
  kind: SpanKind;
  startTime: Date;
  endTime?: Date;
  durationMs?: number;
  status: SpanStatus;
  statusMessage?: string;
  attributes: SpanAttributes;
  events: SpanEvent[];
  links: SpanLink[];
}

export interface TracerConfig {
  serviceName: string;
  serviceVersion?: string;
  environment?: string;
  exporterType?: 'console' | 'jaeger' | 'zipkin' | 'otlp' | 'none';
  exporterEndpoint?: string;
  sampleRate?: number; // 0.0 to 1.0
  maxSpansPerTrace?: number;
  flushIntervalMs?: number;
}

// ============================================
// SPAN IMPLEMENTATION
// ============================================

class SpanImpl implements Span {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  name: string;
  kind: SpanKind;
  startTime: Date;
  endTime?: Date;
  durationMs?: number;
  status: SpanStatus = 'unset';
  statusMessage?: string;
  attributes: SpanAttributes = {};
  events: SpanEvent[] = [];
  links: SpanLink[] = [];

  private tracer: TracingService;

  constructor(
    tracer: TracingService,
    name: string,
    options: {
      kind?: SpanKind;
      parentSpanId?: string;
      traceId?: string;
      attributes?: SpanAttributes;
      links?: SpanLink[];
    } = {}
  ) {
    this.tracer = tracer;
    this.name = name;
    this.kind = options.kind || 'internal';
    this.traceId = options.traceId || generateTraceId();
    this.spanId = generateSpanId();
    this.parentSpanId = options.parentSpanId;
    this.startTime = new Date();
    this.attributes = options.attributes || {};
    this.links = options.links || [];
  }

  setAttribute(key: string, value: string | number | boolean): this {
    this.attributes[key] = value;
    return this;
  }

  setAttributes(attributes: SpanAttributes): this {
    Object.assign(this.attributes, attributes);
    return this;
  }

  addEvent(name: string, attributes?: SpanAttributes): this {
    this.events.push({
      name,
      timestamp: new Date(),
      attributes,
    });
    return this;
  }

  setStatus(status: SpanStatus, message?: string): this {
    this.status = status;
    this.statusMessage = message;
    return this;
  }

  end(): void {
    this.endTime = new Date();
    this.durationMs = this.endTime.getTime() - this.startTime.getTime();

    if (this.status === 'unset') {
      this.status = 'ok';
    }

    this.tracer.recordSpan(this);
  }

  getContext(): SpanContext {
    return {
      traceId: this.traceId,
      spanId: this.spanId,
      traceFlags: 1, // Sampled
    };
  }
}

// ============================================
// TRACING SERVICE
// ============================================

export class TracingService {
  private config: TracerConfig;
  private spans: Map<string, Span[]> = new Map();
  private exportBuffer: Span[] = [];
  private flushTimer?: NodeJS.Timeout;

  constructor(config: TracerConfig) {
    this.config = {
      sampleRate: 1.0,
      maxSpansPerTrace: 1000,
      flushIntervalMs: 5000,
      exporterType: 'console',
      ...config,
    };

    this.startFlushTimer();
  }

  /**
   * Create a new span
   */
  startSpan(
    name: string,
    options: {
      kind?: SpanKind;
      parent?: Span | SpanContext;
      attributes?: SpanAttributes;
      links?: SpanLink[];
    } = {}
  ): SpanImpl {
    // Check sampling
    if (!this.shouldSample()) {
      // Return a no-op span
      return this.createNoOpSpan(name);
    }

    let parentSpanId: string | undefined;
    let traceId: string | undefined;

    if (options.parent) {
      const parent = options.parent as Span | SpanContext;
      parentSpanId = parent.spanId;
      traceId = parent.traceId;
    }

    return new SpanImpl(this, name, {
      kind: options.kind,
      parentSpanId,
      traceId,
      attributes: {
        'service.name': this.config.serviceName,
        'service.version': this.config.serviceVersion || 'unknown',
        'deployment.environment': this.config.environment || 'development',
        ...options.attributes,
      },
      links: options.links,
    });
  }

  /**
   * Create an LLM-specific span with standard attributes
   */
  startLLMSpan(
    operationName: string,
    options: {
      provider: string;
      model: string;
      parent?: Span | SpanContext;
      attributes?: SpanAttributes;
    }
  ): SpanImpl {
    return this.startSpan(`llm.${operationName}`, {
      kind: 'llm',
      parent: options.parent,
      attributes: {
        'gen_ai.operation.name': operationName,
        'gen_ai.system': options.provider,
        'gen_ai.request.model': options.model,
        ...options.attributes,
      },
    });
  }

  /**
   * Create a tool/function call span
   */
  startToolSpan(
    toolName: string,
    options: {
      parent?: Span | SpanContext;
      attributes?: SpanAttributes;
    } = {}
  ): SpanImpl {
    return this.startSpan(`tool.${toolName}`, {
      kind: 'tool',
      parent: options.parent,
      attributes: {
        'tool.name': toolName,
        ...options.attributes,
      },
    });
  }

  /**
   * Record a completed span for export
   */
  recordSpan(span: Span): void {
    // Store by trace ID
    const traceSpans = this.spans.get(span.traceId) || [];
    traceSpans.push(span);

    if (traceSpans.length <= (this.config.maxSpansPerTrace || 1000)) {
      this.spans.set(span.traceId, traceSpans);
    }

    // Add to export buffer
    this.exportBuffer.push(span);

    // Flush if buffer is large
    if (this.exportBuffer.length >= 100) {
      this.flush();
    }
  }

  /**
   * Get all spans for a trace
   */
  getTrace(traceId: string): Span[] {
    return this.spans.get(traceId) || [];
  }

  /**
   * Build a trace tree structure
   */
  getTraceTree(traceId: string): SpanTreeNode | null {
    const spans = this.getTrace(traceId);
    if (spans.length === 0) return null;

    // Find root span (no parent)
    const rootSpan = spans.find((s) => !s.parentSpanId);
    if (!rootSpan) return null;

    const buildTree = (span: Span): SpanTreeNode => {
      const children = spans
        .filter((s) => s.parentSpanId === span.spanId)
        .map((s) => buildTree(s));

      return {
        span,
        children,
      };
    };

    return buildTree(rootSpan);
  }

  /**
   * Flush spans to exporter
   */
  async flush(): Promise<void> {
    if (this.exportBuffer.length === 0) return;

    const spansToExport = [...this.exportBuffer];
    this.exportBuffer = [];

    await this.exportSpans(spansToExport);
  }

  /**
   * Shutdown the tracer
   */
  async shutdown(): Promise<void> {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }
    await this.flush();
  }

  // ============================================
  // PRIVATE METHODS
  // ============================================

  private shouldSample(): boolean {
    return Math.random() < (this.config.sampleRate || 1.0);
  }

  private createNoOpSpan(name: string): SpanImpl {
    const span = new SpanImpl(this, name);
    span.end = () => {}; // No-op
    return span;
  }

  private startFlushTimer(): void {
    this.flushTimer = setInterval(() => {
      this.flush().catch(console.error);
    }, this.config.flushIntervalMs || 5000);
  }

  private async exportSpans(spans: Span[]): Promise<void> {
    switch (this.config.exporterType) {
      case 'console':
        this.exportToConsole(spans);
        break;
      case 'jaeger':
        await this.exportToJaeger(spans);
        break;
      case 'otlp':
        await this.exportToOTLP(spans);
        break;
      case 'none':
        // Do nothing
        break;
      default:
        this.exportToConsole(spans);
    }
  }

  private exportToConsole(spans: Span[]): void {
    for (const span of spans) {
      console.log(JSON.stringify({
        timestamp: span.startTime.toISOString(),
        traceId: span.traceId,
        spanId: span.spanId,
        parentSpanId: span.parentSpanId,
        name: span.name,
        kind: span.kind,
        durationMs: span.durationMs,
        status: span.status,
        attributes: span.attributes,
        events: span.events,
      }));
    }
  }

  private async exportToJaeger(spans: Span[]): Promise<void> {
    if (!this.config.exporterEndpoint) {
      console.warn('Jaeger endpoint not configured');
      return;
    }

    // Convert to Jaeger Thrift format
    const jaegerSpans = spans.map((span) => ({
      traceIdLow: span.traceId.slice(16),
      traceIdHigh: span.traceId.slice(0, 16),
      spanId: span.spanId,
      parentSpanId: span.parentSpanId || '0',
      operationName: span.name,
      flags: 1,
      startTime: span.startTime.getTime() * 1000, // microseconds
      duration: (span.durationMs || 0) * 1000,
      tags: Object.entries(span.attributes).map(([key, value]) => ({
        key,
        vType: typeof value === 'string' ? 'STRING' : typeof value === 'number' ? 'DOUBLE' : 'BOOL',
        vStr: typeof value === 'string' ? value : undefined,
        vDouble: typeof value === 'number' ? value : undefined,
        vBool: typeof value === 'boolean' ? value : undefined,
      })),
      logs: span.events.map((event) => ({
        timestamp: event.timestamp.getTime() * 1000,
        fields: [
          { key: 'event', vType: 'STRING', vStr: event.name },
          ...Object.entries(event.attributes || {}).map(([key, value]) => ({
            key,
            vType: 'STRING',
            vStr: String(value),
          })),
        ],
      })),
    }));

    try {
      await fetch(`${this.config.exporterEndpoint}/api/traces`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          process: {
            serviceName: this.config.serviceName,
            tags: [
              { key: 'service.version', vType: 'STRING', vStr: this.config.serviceVersion },
              { key: 'deployment.environment', vType: 'STRING', vStr: this.config.environment },
            ],
          },
          spans: jaegerSpans,
        }),
      });
    } catch (error) {
      console.error('Failed to export to Jaeger:', error);
    }
  }

  private async exportToOTLP(spans: Span[]): Promise<void> {
    if (!this.config.exporterEndpoint) {
      console.warn('OTLP endpoint not configured');
      return;
    }

    // Convert to OTLP format
    const resourceSpans = {
      resource: {
        attributes: [
          { key: 'service.name', value: { stringValue: this.config.serviceName } },
          { key: 'service.version', value: { stringValue: this.config.serviceVersion } },
          { key: 'deployment.environment', value: { stringValue: this.config.environment } },
        ],
      },
      scopeSpans: [
        {
          scope: {
            name: '@aethermind/tracing',
            version: '1.0.0',
          },
          spans: spans.map((span) => ({
            traceId: hexToBase64(span.traceId),
            spanId: hexToBase64(span.spanId),
            parentSpanId: span.parentSpanId ? hexToBase64(span.parentSpanId) : undefined,
            name: span.name,
            kind: spanKindToOTLP(span.kind),
            startTimeUnixNano: span.startTime.getTime() * 1000000,
            endTimeUnixNano: span.endTime ? span.endTime.getTime() * 1000000 : undefined,
            attributes: Object.entries(span.attributes).map(([key, value]) => ({
              key,
              value: attributeToOTLP(value),
            })),
            events: span.events.map((event) => ({
              timeUnixNano: event.timestamp.getTime() * 1000000,
              name: event.name,
              attributes: Object.entries(event.attributes || {}).map(([key, value]) => ({
                key,
                value: attributeToOTLP(value),
              })),
            })),
            status: {
              code: span.status === 'error' ? 2 : span.status === 'ok' ? 1 : 0,
              message: span.statusMessage,
            },
          })),
        },
      ],
    };

    try {
      await fetch(`${this.config.exporterEndpoint}/v1/traces`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resourceSpans: [resourceSpans] }),
      });
    } catch (error) {
      console.error('Failed to export to OTLP:', error);
    }
  }
}

// ============================================
// HELPER TYPES AND FUNCTIONS
// ============================================

export interface SpanTreeNode {
  span: Span;
  children: SpanTreeNode[];
}

function generateTraceId(): string {
  return randomUUID().replace(/-/g, '');
}

function generateSpanId(): string {
  return randomUUID().replace(/-/g, '').slice(0, 16);
}

function hexToBase64(hex: string): string {
  return Buffer.from(hex, 'hex').toString('base64');
}

function spanKindToOTLP(kind: SpanKind): number {
  const kindMap: Record<SpanKind, number> = {
    internal: 1,
    server: 2,
    client: 3,
    producer: 4,
    consumer: 5,
    llm: 1,
    tool: 1,
    chain: 1,
    agent: 1,
  };
  return kindMap[kind] || 1;
}

type OTLPAttributeValue =
  | { stringValue: string }
  | { intValue: number }
  | { doubleValue: number }
  | { boolValue: boolean }
  | { arrayValue: { values: OTLPAttributeValue[] } };

function attributeToOTLP(value: string | number | boolean | string[] | number[] | boolean[]): OTLPAttributeValue {
  if (typeof value === 'string') {
    return { stringValue: value };
  } else if (typeof value === 'number') {
    return Number.isInteger(value) ? { intValue: value } : { doubleValue: value };
  } else if (typeof value === 'boolean') {
    return { boolValue: value };
  } else if (Array.isArray(value)) {
    return {
      arrayValue: {
        values: value.map((v) => attributeToOTLP(v as string | number | boolean)),
      },
    };
  }
  return { stringValue: String(value) };
}

// ============================================
// SINGLETON INSTANCE
// ============================================

let globalTracer: TracingService | null = null;

export function initTracing(config: TracerConfig): TracingService {
  globalTracer = new TracingService(config);
  return globalTracer;
}

export function getTracer(): TracingService {
  if (!globalTracer) {
    throw new Error('Tracing not initialized. Call initTracing() first.');
  }
  return globalTracer;
}

// ============================================
// DECORATOR FOR AUTOMATIC TRACING
// ============================================

export function traced(spanName?: string, options?: { kind?: SpanKind; attributes?: SpanAttributes }) {
  return function (target: unknown, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: unknown[]) {
      const tracer = getTracer();
      const span = tracer.startSpan(spanName || `${target?.constructor?.name}.${propertyKey}`, {
        kind: options?.kind || 'internal',
        attributes: options?.attributes,
      });

      try {
        const result = await originalMethod.apply(this, args);
        span.setStatus('ok');
        return result;
      } catch (error) {
        span.setStatus('error', error instanceof Error ? error.message : 'Unknown error');
        span.addEvent('exception', {
          'exception.type': error instanceof Error ? error.name : 'Error',
          'exception.message': error instanceof Error ? error.message : String(error),
        });
        throw error;
      } finally {
        span.end();
      }
    };

    return descriptor;
  };
}

export default TracingService;
