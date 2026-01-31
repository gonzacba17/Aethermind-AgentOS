import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { shouldUseMockData } from '@/lib/mock-data';
import { getAuthToken } from '@/lib/auth-utils';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || '';

function getHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (typeof window !== 'undefined') {
    const token = getAuthToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
  }
  return headers;
}

/**
 * Alert types and interfaces (Frontend)
 */
export interface Alert {
  id: string;
  name: string;
  type: 'budget' | 'usage' | 'error' | 'performance';
  condition: {
    metric: string;
    operator: 'gt' | 'lt' | 'eq' | 'gte' | 'lte';
    threshold: number;
    timeWindow?: string;
  };
  actions: AlertAction[];
  enabled: boolean;
  createdAt: string;
  lastTriggered?: string;
  triggerCount: number;
  budgetId?: string;
  description?: string;
  priority?: number;
  cooldownMinutes?: number;
}

export interface AlertAction {
  type: 'email' | 'webhook' | 'notification' | 'pause_agent' | 'notify_email' | 'notify_slack' | 'notify_webhook' | 'pause_budget' | 'reduce_limit' | 'throttle_requests' | 'block_requests';
  config: Record<string, any>;
}

export interface AlertTrigger {
  id: string;
  alertId: string;
  triggeredAt: string;
  value: number;
  resolved: boolean;
  resolvedAt?: string;
}

export interface CreateAlertData {
  name: string;
  type: Alert['type'];
  condition: Alert['condition'];
  actions: AlertAction[];
  budgetId?: string;
  description?: string;
}

/**
 * Backend ActionRule interface
 */
interface BackendActionRule {
  id: string;
  name: string;
  description?: string;
  enabled: boolean;
  priority: number;
  budgetId?: string;
  trigger: string;
  conditions: Array<{
    field: string;
    operator: string;
    value: number | string | number[];
  }>;
  actions: Array<{
    type: string;
    config: Record<string, any>;
    delayMs?: number;
    retryOnFailure?: boolean;
  }>;
  cooldownMinutes: number;
  maxExecutionsPerDay: number;
  createdAt?: string;
  lastExecutedAt?: string;
  executionCount?: number;
}

/**
 * Query keys for alerts
 */
export const alertKeys = {
  all: ['alerts'] as const,
  lists: () => [...alertKeys.all, 'list'] as const,
  list: (filters?: { enabled?: boolean }) => [...alertKeys.lists(), filters] as const,
  details: () => [...alertKeys.all, 'detail'] as const,
  detail: (id: string) => [...alertKeys.details(), id] as const,
  triggers: (id: string) => [...alertKeys.detail(id), 'triggers'] as const,
};

// Mock alerts for demo mode
const MOCK_ALERTS: Alert[] = [
  {
    id: 'alert-1',
    name: 'Budget Warning',
    type: 'budget',
    condition: {
      metric: 'monthly_cost',
      operator: 'gt',
      threshold: 80,
    },
    actions: [{ type: 'notification', config: {} }],
    enabled: true,
    createdAt: new Date().toISOString(),
    triggerCount: 2,
    lastTriggered: new Date(Date.now() - 3600000).toISOString(),
  },
  {
    id: 'alert-2',
    name: 'High Error Rate',
    type: 'error',
    condition: {
      metric: 'error_rate',
      operator: 'gt',
      threshold: 5,
      timeWindow: '1h',
    },
    actions: [
      { type: 'notification', config: {} },
      { type: 'email', config: { to: 'admin@example.com' } },
    ],
    enabled: true,
    createdAt: new Date().toISOString(),
    triggerCount: 0,
  },
  {
    id: 'alert-3',
    name: 'Slow Response Time',
    type: 'performance',
    condition: {
      metric: 'avg_response_time',
      operator: 'gt',
      threshold: 5000,
      timeWindow: '5m',
    },
    actions: [{ type: 'notification', config: {} }],
    enabled: false,
    createdAt: new Date().toISOString(),
    triggerCount: 5,
  },
];

/**
 * Transform backend ActionRule to frontend Alert
 */
function transformToAlert(rule: BackendActionRule): Alert {
  // Map trigger type to alert type
  const typeMap: Record<string, Alert['type']> = {
    threshold_reached: 'budget',
    threshold_exceeded: 'budget',
    anomaly_detected: 'error',
    circuit_tripped: 'error',
    forecast_warning: 'budget',
    manual: 'usage',
    scheduled: 'usage',
  };

  // Get the first condition for the alert
  const condition = rule.conditions[0];
  const operatorMap: Record<string, Alert['condition']['operator']> = {
    gt: 'gt',
    lt: 'lt',
    eq: 'eq',
    gte: 'gte',
    lte: 'lte',
    between: 'gte',
    in: 'eq',
  };

  return {
    id: rule.id,
    name: rule.name,
    description: rule.description,
    type: typeMap[rule.trigger] || 'budget',
    condition: {
      metric: condition?.field || 'utilization',
      operator: operatorMap[condition?.operator] || 'gt',
      threshold: typeof condition?.value === 'number' ? condition.value : 80,
    },
    actions: rule.actions.map(a => ({
      type: a.type as AlertAction['type'],
      config: a.config,
    })),
    enabled: rule.enabled,
    createdAt: rule.createdAt || new Date().toISOString(),
    lastTriggered: rule.lastExecutedAt,
    triggerCount: rule.executionCount || 0,
    budgetId: rule.budgetId,
    priority: rule.priority,
    cooldownMinutes: rule.cooldownMinutes,
  };
}

/**
 * Transform frontend CreateAlertData to backend ActionRule
 */
function transformToActionRule(data: CreateAlertData): Partial<BackendActionRule> {
  // Map alert type to trigger
  const triggerMap: Record<Alert['type'], string> = {
    budget: 'threshold_exceeded',
    usage: 'scheduled',
    error: 'anomaly_detected',
    performance: 'threshold_reached',
  };

  return {
    name: data.name,
    description: data.description,
    enabled: true,
    priority: 0,
    budgetId: data.budgetId,
    trigger: triggerMap[data.type],
    conditions: [{
      field: data.condition.metric,
      operator: data.condition.operator,
      value: data.condition.threshold,
    }],
    actions: data.actions.map(a => ({
      type: a.type,
      config: a.config,
    })),
    cooldownMinutes: 60,
    maxExecutionsPerDay: 10,
  };
}

/**
 * Hook to fetch all alerts
 */
export function useAlerts(filters?: { enabled?: boolean }) {
  return useQuery({
    queryKey: alertKeys.list(filters),
    queryFn: async (): Promise<Alert[]> => {
      // Use mock data if API is not configured
      if (shouldUseMockData()) {
        await new Promise(r => setTimeout(r, 500));
        let alerts = [...MOCK_ALERTS];
        if (filters?.enabled !== undefined) {
          alerts = alerts.filter(a => a.enabled === filters.enabled);
        }
        return alerts;
      }

      try {
        const response = await fetch(`${API_BASE}/api/budgets/actions/rules`, {
          headers: getHeaders(),
        });

        if (!response.ok) {
          throw new Error('Failed to fetch alerts');
        }

        const data = await response.json();
        let alerts = (data.rules || data || []).map(transformToAlert);

        if (filters?.enabled !== undefined) {
          alerts = alerts.filter((a: Alert) => a.enabled === filters.enabled);
        }

        return alerts;
      } catch (error) {
        console.warn('[useAlerts] API request failed, using mock data:', error);
        let alerts = [...MOCK_ALERTS];
        if (filters?.enabled !== undefined) {
          alerts = alerts.filter(a => a.enabled === filters.enabled);
        }
        return alerts;
      }
    },
    staleTime: 30 * 1000,
    retry: 1,
  });
}

/**
 * Hook to fetch a single alert
 */
export function useAlert(id: string) {
  return useQuery({
    queryKey: alertKeys.detail(id),
    queryFn: async (): Promise<Alert | undefined> => {
      if (shouldUseMockData()) {
        await new Promise(r => setTimeout(r, 300));
        return MOCK_ALERTS.find(a => a.id === id);
      }

      try {
        const response = await fetch(`${API_BASE}/api/budgets/actions/rules`, {
          headers: getHeaders(),
        });

        if (!response.ok) {
          throw new Error('Failed to fetch alert');
        }

        const data = await response.json();
        const rules = data.rules || data || [];
        const rule = rules.find((r: BackendActionRule) => r.id === id);
        return rule ? transformToAlert(rule) : undefined;
      } catch (error) {
        console.warn('[useAlert] API request failed, using mock data:', error);
        return MOCK_ALERTS.find(a => a.id === id);
      }
    },
    enabled: !!id,
  });
}

/**
 * Hook to fetch alert trigger history
 */
export function useAlertTriggers(alertId: string) {
  return useQuery({
    queryKey: alertKeys.triggers(alertId),
    queryFn: async (): Promise<AlertTrigger[]> => {
      // This would need a separate endpoint for trigger history
      // For now, return mock data
      await new Promise(r => setTimeout(r, 300));
      return [
        {
          id: 'trigger-1',
          alertId,
          triggeredAt: new Date(Date.now() - 3600000).toISOString(),
          value: 85,
          resolved: true,
          resolvedAt: new Date(Date.now() - 1800000).toISOString(),
        },
        {
          id: 'trigger-2',
          alertId,
          triggeredAt: new Date(Date.now() - 86400000).toISOString(),
          value: 92,
          resolved: true,
          resolvedAt: new Date(Date.now() - 82800000).toISOString(),
        },
      ];
    },
    enabled: !!alertId,
  });
}

/**
 * Hook to create a new alert
 */
export function useCreateAlert() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateAlertData): Promise<Alert> => {
      if (shouldUseMockData()) {
        await new Promise(r => setTimeout(r, 500));
        const newAlert: Alert = {
          id: `alert-${Date.now()}`,
          ...data,
          enabled: true,
          createdAt: new Date().toISOString(),
          triggerCount: 0,
        };
        MOCK_ALERTS.push(newAlert);
        return newAlert;
      }

      const response = await fetch(`${API_BASE}/api/budgets/actions/rules`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(transformToActionRule(data)),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.message || 'Failed to create alert');
      }

      const rule = await response.json();
      return transformToAlert(rule);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: alertKeys.lists() });
    },
  });
}

/**
 * Hook to update an alert
 */
export function useUpdateAlert() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...data }: Partial<Alert> & { id: string }): Promise<Alert> => {
      if (shouldUseMockData()) {
        await new Promise(r => setTimeout(r, 500));
        const index = MOCK_ALERTS.findIndex(a => a.id === id);
        if (index === -1) throw new Error('Alert not found');
        MOCK_ALERTS[index] = { ...MOCK_ALERTS[index], ...data };
        return MOCK_ALERTS[index];
      }

      const response = await fetch(`${API_BASE}/api/budgets/actions/rules/${id}`, {
        method: 'PATCH',
        headers: getHeaders(),
        body: JSON.stringify({
          name: data.name,
          description: data.description,
          enabled: data.enabled,
          priority: data.priority,
          conditions: data.condition ? [{
            field: data.condition.metric,
            operator: data.condition.operator,
            value: data.condition.threshold,
          }] : undefined,
          actions: data.actions?.map(a => ({
            type: a.type,
            config: a.config,
          })),
          cooldownMinutes: data.cooldownMinutes,
        }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.message || 'Failed to update alert');
      }

      const rule = await response.json();
      return transformToAlert(rule);
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: alertKeys.lists() });
      queryClient.invalidateQueries({ queryKey: alertKeys.detail(data.id) });
    },
  });
}

/**
 * Hook to delete an alert
 */
export function useDeleteAlert() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string): Promise<void> => {
      if (shouldUseMockData()) {
        await new Promise(r => setTimeout(r, 500));
        const index = MOCK_ALERTS.findIndex(a => a.id === id);
        if (index !== -1) {
          MOCK_ALERTS.splice(index, 1);
        }
        return;
      }

      const response = await fetch(`${API_BASE}/api/budgets/actions/rules/${id}`, {
        method: 'DELETE',
        headers: getHeaders(),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.message || 'Failed to delete alert');
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: alertKeys.lists() });
    },
  });
}

/**
 * Hook to toggle alert enabled status
 */
export function useToggleAlert() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, enabled }: { id: string; enabled: boolean }): Promise<Alert> => {
      if (shouldUseMockData()) {
        await new Promise(r => setTimeout(r, 300));
        const index = MOCK_ALERTS.findIndex(a => a.id === id);
        if (index === -1) throw new Error('Alert not found');
        MOCK_ALERTS[index].enabled = enabled;
        return MOCK_ALERTS[index];
      }

      const response = await fetch(`${API_BASE}/api/budgets/actions/rules/${id}`, {
        method: 'PATCH',
        headers: getHeaders(),
        body: JSON.stringify({ enabled }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.message || 'Failed to toggle alert');
      }

      const rule = await response.json();
      return transformToAlert(rule);
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: alertKeys.lists() });
      queryClient.invalidateQueries({ queryKey: alertKeys.detail(data.id) });
    },
  });
}

/**
 * Helper to get human-readable operator
 */
export function getOperatorLabel(operator: Alert['condition']['operator']): string {
  const labels: Record<string, string> = {
    gt: 'greater than',
    lt: 'less than',
    eq: 'equal to',
    gte: 'greater than or equal to',
    lte: 'less than or equal to',
  };
  return labels[operator] || operator;
}

/**
 * Helper to get alert type icon color
 */
export function getAlertTypeColor(type: Alert['type']): string {
  const colors: Record<string, string> = {
    budget: 'text-emerald-500',
    usage: 'text-blue-500',
    error: 'text-red-500',
    performance: 'text-amber-500',
  };
  return colors[type] || 'text-muted-foreground';
}
