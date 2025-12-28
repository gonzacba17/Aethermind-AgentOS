'use client';

import { Card, CardHeader, CardTitle,  CardContent } from '@/components/ui/card';
import { Activity, Bot, DollarSign, Clock } from 'lucide-react';
import { formatCost } from '@/lib/utils';
import type { Agent, CostSummary } from '@/lib/api';

interface StatsGridProps {
  agents: Agent[];
  costSummary: CostSummary | null;
  apiHealth: { status: string; timestamp: string } | null;
  loading: boolean;
}

export function StatsGrid({ agents, costSummary, apiHealth, loading }: StatsGridProps) {
  const activeAgents = agents.filter((a) => a.status === 'running').length;
  const totalExecutions = costSummary?.executionCount || 0;
  const totalCost = costSummary?.total || 0;
  
  // Calculate uptime from API health timestamp
  const uptimeText = apiHealth?.timestamp 
    ? 'Connected'
    : 'Disconnected';

  const stats = [
    {
      label: 'Active Agents',
      value: loading ? '-' : activeAgents.toString(),
      icon: Bot,
      subtitle: `${agents.length} total`,
    },
    {
      label: 'Total Executions',
      value: loading ? '-' : totalExecutions.toLocaleString(),
      icon: Activity,
      subtitle: 'All time',
    },
    {
      label: 'Total Cost',
      value: loading ? '-' : formatCost(totalCost),
      icon: DollarSign,
      subtitle: 'Across all models',
    },
    {
      label: 'System Status',
      value: uptimeText,
      icon: Clock,
      subtitle: apiHealth?.status === 'ok' ? 'All systems operational' : 'Check connection',
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {stats.map((stat) => (
        <Card key={stat.label}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">{stat.label}</CardTitle>
            <stat.icon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stat.value}</div>
            <p className="text-xs text-muted-foreground mt-1">{stat.subtitle}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
