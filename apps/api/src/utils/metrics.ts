import promClient from 'prom-client';

// Enable default metrics (CPU, memory, event loop lag)
promClient.collectDefaultMetrics({
  prefix: 'aethermind_',
  gcDurationBuckets: [0.001, 0.01, 0.1, 1, 2, 5],
});

// HTTP Request Duration Histogram
export const httpRequestDuration = new promClient.Histogram({
  name: 'aethermind_http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.1, 0.3, 0.5, 0.7, 1, 3, 5, 7, 10],
});

// HTTP Request Counter
export const httpRequestTotal = new promClient.Counter({
  name: 'aethermind_http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code'],
});

// Agent Execution Counter
export const agentExecutionsTotal = new promClient.Counter({
  name: 'aethermind_agent_executions_total',
  help: 'Total number of agent executions',
  labelNames: ['agent_id', 'status', 'provider'],
});

// Agent Execution Duration
export const agentExecutionDuration = new promClient.Histogram({
  name: 'aethermind_agent_execution_duration_seconds',
  help: 'Duration of agent executions in seconds',
  labelNames: ['agent_id', 'provider'],
  buckets: [1, 5, 10, 30, 60, 120, 300],
});

// LLM Tokens Used Counter
export const llmTokensUsed = new promClient.Counter({
  name: 'aethermind_llm_tokens_total',
  help: 'Total LLM tokens used',
  labelNames: ['provider', 'model', 'type'],
});

// LLM Cost Counter
export const llmCostTotal = new promClient.Counter({
  name: 'aethermind_llm_cost_dollars_total',
  help: 'Total LLM cost in dollars',
  labelNames: ['provider', 'model'],
});

// Budget Utilization Gauge
export const budgetUtilization = new promClient.Gauge({
  name: 'aethermind_budget_utilization_percent',
  help: 'Budget utilization percentage',
  labelNames: ['user_id', 'budget_id'],
});

// Active WebSocket Connections
export const activeConnections = new promClient.Gauge({
  name: 'aethermind_active_connections',
  help: 'Number of active WebSocket connections',
});

// Budget Alerts Counter
export const budgetAlertsTotal = new promClient.Counter({
  name: 'aethermind_budget_alerts_total',
  help: 'Total number of budget alerts sent',
  labelNames: ['severity', 'channel'],
});

// API Key Validation Counter
export const apiKeyValidations = new promClient.Counter({
  name: 'aethermind_api_key_validations_total',
  help: 'Total number of API key validations',
  labelNames: ['result'],
});

// Database Query Duration
export const dbQueryDuration = new promClient.Histogram({
  name: 'aethermind_db_query_duration_seconds',
  help: 'Duration of database queries in seconds',
  labelNames: ['operation', 'table'],
  buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5],
});

// Export Prometheus registry
export const register = promClient.register;
