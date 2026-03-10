/**
 * Hooks Exports
 * 
 * Central export point for all custom hooks
 */

// API Hooks
export { useAgents, useAgent, useCreateAgent, useUpdateAgent, useDeleteAgent, useExecuteAgent, useToggleAgentStatus, agentKeys } from './api/useAgents';
export type { AgentFilters } from './api/useAgents';

export { useTraces, useTrace, useTraceStats, exportTraces, traceKeys } from './api/useTraces';
export type { TraceFilters, TraceListItem, TraceStep, TraceDetail } from './api/useTraces';

export { useLogs, useLogStats, useLogSources, exportLogs, logKeys } from './api/useLogs';
export type { LogFilters, EnhancedLogEntry } from './api/useLogs';

export { 
  useCostSummary, 
  useCostHistory, 
  useDailyCosts, 
  useCostsByModel, 
  useCostPrediction,
  exportCostReport,
  costKeys 
} from './api/useCosts';
export type { CostFilters, DailyCost, CostByModel, CostPrediction } from './api/useCosts';

export {
  useBudget,
  useBudgets,
  useBudgetDetail,
  useBudgetUsage,
  usePauseBudget,
  useCreateBudget,
  useUpdateBudget,
  useDeleteBudget,
  getBudgetProgressInfo,
  budgetKeys
} from './api/useBudget';
export type { Budget, BudgetStatus, CreateBudgetData } from './api/useBudget';

// Workflows Hook
export {
  useWorkflows,
  useWorkflow,
  useCreateWorkflow,
  useUpdateWorkflow,
  useDeleteWorkflow,
  useEstimateWorkflow,
  useExecuteWorkflow,
  workflowKeys
} from './api/useWorkflows';
export type { Workflow, WorkflowStep, CreateWorkflowData, WorkflowEstimate, WorkflowExecution } from './api/useWorkflows';

// Forecasting Hook
export {
  useForecast,
  usePatterns,
  useAnomalies,
  useForecastingAlerts,
  useSeasonalPatterns,
  useAcknowledgeAlert,
  useBudgetProjection,
  forecastingKeys
} from './api/useForecasting';
export type { Forecast, ForecastPeriod, Anomaly, Pattern, PredictiveAlert, SeasonalPattern } from './api/useForecasting';

// Optimization Hook
export {
  useOptimizationReport,
  useAvailableModels,
  useRoutingRules,
  useEstimateCost,
  useFindAlternatives,
  useAddRoutingRule,
  useDeleteRoutingRule,
  optimizationKeys
} from './api/useOptimization';
export type { OptimizationReport, OptimizationRecommendation, ModelInfo, ModelAlternative, RoutingRule, CostEstimate } from './api/useOptimization';

export { useMetrics, useTraceTimeSeries, metricsKeys } from './api/useMetrics';
export type { DashboardMetrics } from './api/useMetrics';

// Client Metrics Hook (telemetry-based)
export {
  useClientMetrics,
  useClientMetricsByModel,
  useClientTimeseries,
  clientMetricsKeys
} from './api/useClientMetrics';
export type { ClientMetrics, ClientMetricsByModel, ClientTimeseriesPoint } from './api/useClientMetrics';

// Client Budgets Hook (Phase 1)
export {
  useClientBudgets,
  useClientBudgetStatus,
  useCreateClientBudget,
  useDeleteClientBudget,
  clientBudgetKeys
} from './api/useClientBudgets';
export type { ClientBudget, BudgetEvaluation, CreateClientBudgetData } from './api/useClientBudgets';

// Client Analytics Hook (Phase 1)
export {
  useAgentCosts,
  useWorkflowCosts,
  usePeriodComparison,
  exportAnalyticsCSV,
  clientAnalyticsKeys
} from './api/useClientAnalytics';
export type { AgentCost, WorkflowCost, PeriodComparison } from './api/useClientAnalytics';

// Client Forecast Hook (Phase 1)
export {
  useClientForecast,
  useClientForecastByModel,
  clientForecastKeys
} from './api/useClientForecast';
export type { ClientForecast, ModelForecast } from './api/useClientForecast';

// Client Cache Hook (Phase 3)
export {
  useCacheStats,
  useCacheSettings,
  useUpdateCacheSettings,
  usePurgeCache,
  clientCacheKeys
} from './api/useClientCache';
export type { CacheSettings, CacheStats } from './api/useClientCache';

// Client Insights Hook (Phase 5)
export {
  useClientInsights,
  useClientInsightsHistory,
  useApplyInsight,
  useDismissInsight,
  clientInsightKeys
} from './api/useClientInsights';
export type { ClientInsight } from './api/useClientInsights';

// Client Benchmarks Hook (Phase 5)
export {
  useClientBenchmarks,
  clientBenchmarkKeys
} from './api/useClientBenchmarks';
export type { BenchmarkData, ClientBenchmarkMetrics, BenchmarkComparison } from './api/useClientBenchmarks';

// Trial Hook
export { useTrialStatus, trialKeys } from './api/useTrial';
export type { TrialStatus } from './api/useTrial';

// WebSocket Hook
export { useWebSocket, useWebSocketEvent } from './useWebSocket';
export type { ConnectionStatus, WebSocketEvent } from './useWebSocket';

// Alerts Hook
export { 
  useAlerts, 
  useAlert, 
  useAlertTriggers, 
  useCreateAlert, 
  useUpdateAlert, 
  useDeleteAlert, 
  useToggleAlert,
  getOperatorLabel,
  getAlertTypeColor,
  alertKeys 
} from './api/useAlerts';
export type { Alert, AlertAction, AlertTrigger, CreateAlertData } from './api/useAlerts';

// Organization Hook
export {
  useOrganization,
  useOrganizations,
  useOrganizationMembers,
  useOrganizationInvitations,
  useCreateOrganization,
  useUpdateOrganization,
  useInviteMember,
  useRemoveMember,
  useUpdateMemberRole,
  useCancelInvitation,
  getRoleColor,
  organizationKeys
} from './api/useOrganization';
export type { Organization, OrganizationMember, Invitation, CreateOrganizationData, InviteMemberData } from './api/useOrganization';

// User Profile Hook
export {
  useUserProfile,
  useTestSDKConnection,
  useRegenerateApiKey,
  userProfileKeys
} from './api/useUserProfile';
export type { UserProfile, SDKConnectionStatus } from './api/useUserProfile';

// User API Keys Hook
export {
  useUserApiKeys,
  useAddApiKey,
  useDeleteApiKey,
  useValidateApiKey,
  useProviderUsage,
  getProviderInfo,
  userApiKeyKeys
} from './api/useUserApiKeys';
export type { UserApiKey, AddApiKeyData } from './api/useUserApiKeys';
