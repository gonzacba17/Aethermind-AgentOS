// TODO: Install prom-client package
// import promClient from 'prom-client';

// ---------------------------------------------------------------------------
// No-op metric stubs — safe to call at runtime without prom-client installed.
// Each stub exposes the same chainable API as prom-client metrics so that
// middleware code like  metric.labels(...).observe(v)  never throws.
// ---------------------------------------------------------------------------

/** Object returned by `.labels()` — every mutating method is a silent no-op. */
interface NoOpLabelValues {
  observe(value: number): void;
  inc(value?: number): void;
  dec(value?: number): void;
  set(value: number): void;
}

/** Minimal prom-client–compatible metric shape. */
interface NoOpMetric {
  labels(...values: string[]): NoOpLabelValues;
  observe(value: number): void;
  inc(value?: number): void;
  dec(value?: number): void;
  set(value: number): void;
  reset(): void;
}

/** Minimal prom-client Registry shape. */
interface NoOpRegistry {
  contentType: string;
  metrics(): Promise<string>;
  resetMetrics(): void;
}

// Shared label-values instance (stateless, so one is enough)
const noOpLabelValues: NoOpLabelValues = {
  observe: () => {},
  inc: () => {},
  dec: () => {},
  set: () => {},
};

function createNoOpMetric(): NoOpMetric {
  return {
    labels: () => noOpLabelValues,
    observe: () => {},
    inc: () => {},
    dec: () => {},
    set: () => {},
    reset: () => {},
  };
}

// ---------------------------------------------------------------------------
// Exported stubs — drop-in replacements until prom-client is wired up
// ---------------------------------------------------------------------------

export const httpRequestDuration: NoOpMetric = createNoOpMetric();
export const httpRequestTotal: NoOpMetric = createNoOpMetric();
export const agentExecutionsTotal: NoOpMetric = createNoOpMetric();
export const agentExecutionDuration: NoOpMetric = createNoOpMetric();
export const llmTokensUsed: NoOpMetric = createNoOpMetric();
export const llmCostTotal: NoOpMetric = createNoOpMetric();
export const budgetUtilization: NoOpMetric = createNoOpMetric();
export const activeConnections: NoOpMetric = createNoOpMetric();
export const budgetAlertsTotal: NoOpMetric = createNoOpMetric();
export const apiKeyValidations: NoOpMetric = createNoOpMetric();
export const dbQueryDuration: NoOpMetric = createNoOpMetric();

export const register: NoOpRegistry = {
  contentType: 'text/plain; version=0.0.4; charset=utf-8',
  metrics: async () => '',
  resetMetrics: () => {},
};
