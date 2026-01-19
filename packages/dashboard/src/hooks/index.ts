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
  useCreateBudget, 
  useUpdateBudget, 
  useDeleteBudget,
  getBudgetProgressInfo,
  budgetKeys 
} from './api/useBudget';
export type { Budget, BudgetStatus, CreateBudgetData } from './api/useBudget';

export { useMetrics, useTraceTimeSeries, metricsKeys } from './api/useMetrics';
export type { DashboardMetrics } from './api/useMetrics';

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
