'use client';

import { useEffect, useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { LogViewer } from '@/components/LogViewer';
import { BackToHomeButton } from '@/components/BackToHomeButton';
import { fetchAgents, fetchCostSummary, fetchHealth, type Agent, type CostSummary } from '@/lib/api';
import { formatCost } from '@/lib/utils';
import { Bot, Activity, DollarSign, Cpu } from 'lucide-react';

export default function DashboardPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [costSummary, setCostSummary] = useState<CostSummary | null>(null);
  const [isHealthy, setIsHealthy] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        const [agentsData, costsData] = await Promise.all([
          fetchAgents().catch(() => []),
          fetchCostSummary().catch(() => null),
        ]);
        setAgents(agentsData);
        setCostSummary(costsData);

        const health = await fetchHealth().catch(() => null);
        setIsHealthy(health?.status === 'ok');
      } finally {
        setLoading(false);
      }
    }
    loadData();
    const interval = setInterval(loadData, 5000);
    return () => clearInterval(interval);
  }, []);

  const runningAgents = agents.filter((a) => a.status === 'running').length;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <div className="flex items-center gap-3">
          <BackToHomeButton />
          <Badge variant={isHealthy ? 'success' : 'destructive'}>
            {isHealthy ? 'API Connected' : 'API Disconnected'}
          </Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Agents</CardTitle>
            <Bot className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{loading ? '-' : agents.length}</div>
            <p className="text-xs text-muted-foreground">
              {runningAgents} running
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Executions</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {loading ? '-' : (costSummary?.executionCount || 0)}
            </div>
            <p className="text-xs text-muted-foreground">
              Total executions
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Cost</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {loading ? '-' : formatCost(costSummary?.total || 0)}
            </div>
            <p className="text-xs text-muted-foreground">
              Across all models
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Tokens Used</CardTitle>
            <Cpu className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {loading ? '-' : (costSummary?.totalTokens || 0).toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">
              Total tokens
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Active Agents</CardTitle>
          </CardHeader>
          <CardContent>
            {agents.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No agents registered yet
              </div>
            ) : (
              <div className="space-y-2">
                {agents.slice(0, 5).map((agent) => (
                  <div
                    key={agent.id}
                    className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <Bot className="h-5 w-5 text-primary" />
                      <div>
                        <div className="font-medium">{agent.name}</div>
                        <div className="text-xs text-muted-foreground">{agent.model}</div>
                      </div>
                    </div>
                    <Badge
                      variant={
                        agent.status === 'running'
                          ? 'warning'
                          : agent.status === 'completed'
                          ? 'success'
                          : agent.status === 'failed'
                          ? 'destructive'
                          : 'secondary'
                      }
                    >
                      {agent.status}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="h-[400px]">
          <LogViewer maxLogs={50} />
        </div>
      </div>
    </div>
  );
}
