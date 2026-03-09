'use client';

import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/api';

interface AgentOverviewData {
  totalAgents: number;
  totalRequests: number;
  totalCost: number;
  agents: {
    agentId: string;
    agentName: string | null;
    totalRequests: number;
    totalCost: number;
    avgLatency: number;
    errorCount: number;
    errorRate: number;
    lastActive: string;
  }[];
}

function useAgentTracingOverview() {
  return useQuery({
    queryKey: ['agentTracing', 'overview'],
    queryFn: () => apiRequest<AgentOverviewData>('/api/client/analytics/agents/overview'),
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
}

export default function AgentsTracingPage() {
  const { data: overview, isLoading, error } = useAgentTracingOverview();

  if (isLoading) {
    return (
      <div className="p-8 space-y-6">
        <h1 className="text-2xl font-bold">Agent Tracing</h1>
        <div className="grid grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="rounded-lg border p-4 animate-pulse">
              <div className="h-4 bg-muted rounded w-24 mb-2"></div>
              <div className="h-8 bg-muted rounded w-16"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8">
        <h1 className="text-2xl font-bold mb-4">Agent Tracing</h1>
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-destructive">
          Failed to load agent tracing data: {(error as Error).message}
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Agent Tracing</h1>
        <p className="text-muted-foreground mt-1">
          Monitor individual agent performance within your multi-agent systems.
        </p>
      </div>

      {/* Overview cards */}
      <div className="grid grid-cols-4 gap-4">
        <StatCard label="Total Agents" value={overview?.totalAgents ?? 0} />
        <StatCard label="Total Requests" value={overview?.totalRequests ?? 0} />
        <StatCard label="Total Cost" value={`$${(overview?.totalCost ?? 0).toFixed(4)}`} />
        <StatCard label="Active Agents" value={overview?.agents?.length ?? 0} />
      </div>

      {/* Agents table */}
      {overview?.agents && overview.agents.length > 0 ? (
        <div className="rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="p-3 text-left">Agent</th>
                <th className="p-3 text-right">Requests</th>
                <th className="p-3 text-right">Avg Latency</th>
                <th className="p-3 text-right">Total Cost</th>
                <th className="p-3 text-right">Error Rate</th>
                <th className="p-3 text-right">Last Active</th>
              </tr>
            </thead>
            <tbody>
              {overview.agents.map((agent) => (
                <tr key={agent.agentId} className="border-t hover:bg-muted/30">
                  <td className="p-3 font-mono text-xs">{agent.agentName || agent.agentId}</td>
                  <td className="p-3 text-right">{agent.totalRequests}</td>
                  <td className="p-3 text-right">{agent.avgLatency}ms</td>
                  <td className="p-3 text-right">${parseFloat(String(agent.totalCost)).toFixed(4)}</td>
                  <td className="p-3 text-right">{(agent.errorRate * 100).toFixed(1)}%</td>
                  <td className="p-3 text-right text-muted-foreground text-xs">
                    {agent.lastActive ? new Date(agent.lastActive).toLocaleDateString() : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="rounded-lg border p-8 text-center text-muted-foreground">
          <p className="text-lg font-medium mb-2">No agent traces yet</p>
          <p className="text-sm">
            Send requests through the gateway with the <code className="bg-muted px-1 rounded">X-Agent-Id</code> header to start tracing agents.
          </p>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border p-4">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="text-2xl font-bold mt-1">{value}</p>
    </div>
  );
}
