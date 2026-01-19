import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

/**
 * Alert types and interfaces
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
}

export interface AlertAction {
  type: 'email' | 'webhook' | 'notification' | 'pause_agent';
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

// Mock alerts for demo (will be replaced with real API)
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
 * Hook to fetch all alerts
 */
export function useAlerts(filters?: { enabled?: boolean }) {
  return useQuery({
    queryKey: alertKeys.list(filters),
    queryFn: async (): Promise<Alert[]> => {
      // TODO: Replace with real API call
      // const response = await fetch('/api/alerts');
      // return response.json();
      
      await new Promise(r => setTimeout(r, 500)); // Simulate API delay
      let alerts = [...MOCK_ALERTS];
      
      if (filters?.enabled !== undefined) {
        alerts = alerts.filter(a => a.enabled === filters.enabled);
      }
      
      return alerts;
    },
    staleTime: 30 * 1000,
  });
}

/**
 * Hook to fetch a single alert
 */
export function useAlert(id: string) {
  return useQuery({
    queryKey: alertKeys.detail(id),
    queryFn: async (): Promise<Alert | undefined> => {
      await new Promise(r => setTimeout(r, 300));
      return MOCK_ALERTS.find(a => a.id === id);
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
      await new Promise(r => setTimeout(r, 300));
      
      // Mock trigger history
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
      // TODO: Replace with real API call
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
      await new Promise(r => setTimeout(r, 500));
      
      const index = MOCK_ALERTS.findIndex(a => a.id === id);
      if (index === -1) throw new Error('Alert not found');
      
      MOCK_ALERTS[index] = { ...MOCK_ALERTS[index], ...data };
      return MOCK_ALERTS[index];
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
      await new Promise(r => setTimeout(r, 500));
      
      const index = MOCK_ALERTS.findIndex(a => a.id === id);
      if (index !== -1) {
        MOCK_ALERTS.splice(index, 1);
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
      await new Promise(r => setTimeout(r, 300));
      
      const index = MOCK_ALERTS.findIndex(a => a.id === id);
      if (index === -1) throw new Error('Alert not found');
      
      MOCK_ALERTS[index].enabled = enabled;
      return MOCK_ALERTS[index];
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
