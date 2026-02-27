'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Bot, Download, ArrowUpDown } from 'lucide-react';
import { useAgentCosts, exportAnalyticsCSV } from '@/hooks';
import { useState } from 'react';

type SortKey = 'cost' | 'tokens' | 'requests';

export function AgentCostsTable() {
  const { data: agents, isLoading, error } = useAgentCosts('30d');
  const [sortBy, setSortBy] = useState<SortKey>('cost');

  const sorted = [...(agents || [])].sort((a, b) => b[sortBy] - a[sortBy]);

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Bot className="h-5 w-5 text-primary" />
              Cost by Agent (Top 10)
            </CardTitle>
            <CardDescription>Last 30 days</CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => exportAnalyticsCSV('30d')}
          >
            <Download className="h-4 w-4 mr-1" />
            Export CSV
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="text-sm text-muted-foreground py-4 text-center">Loading...</div>
        ) : error ? (
          <div className="text-sm text-destructive py-4 text-center">Failed to load agent costs</div>
        ) : !sorted.length ? (
          <div className="text-sm text-muted-foreground py-4 text-center">
            No agent data available yet
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-muted-foreground">
                  <th className="text-left py-2 font-medium">Agent</th>
                  <th className="text-right py-2 font-medium cursor-pointer" onClick={() => setSortBy('cost')}>
                    <span className="inline-flex items-center gap-1">
                      Cost {sortBy === 'cost' && <ArrowUpDown className="h-3 w-3" />}
                    </span>
                  </th>
                  <th className="text-right py-2 font-medium cursor-pointer" onClick={() => setSortBy('tokens')}>
                    <span className="inline-flex items-center gap-1">
                      Tokens {sortBy === 'tokens' && <ArrowUpDown className="h-3 w-3" />}
                    </span>
                  </th>
                  <th className="text-right py-2 font-medium cursor-pointer" onClick={() => setSortBy('requests')}>
                    <span className="inline-flex items-center gap-1">
                      Requests {sortBy === 'requests' && <ArrowUpDown className="h-3 w-3" />}
                    </span>
                  </th>
                  <th className="text-right py-2 font-medium">Avg Latency</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((agent) => (
                  <tr key={agent.agentId} className="border-b border-border/50 hover:bg-muted/50">
                    <td className="py-2 font-mono text-xs">{agent.agentId}</td>
                    <td className="py-2 text-right font-medium">${agent.cost.toFixed(4)}</td>
                    <td className="py-2 text-right text-muted-foreground">
                      {agent.tokens.toLocaleString()}
                    </td>
                    <td className="py-2 text-right text-muted-foreground">{agent.requests}</td>
                    <td className="py-2 text-right text-muted-foreground">{agent.avgLatency}ms</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
