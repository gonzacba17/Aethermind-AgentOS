'use client';

import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import type { CostSummary } from '@/lib/api';
import { formatCost } from '@/lib/utils';

interface CostDashboardProps {
  summary: CostSummary;
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8'];

export function CostDashboard({ summary }: CostDashboardProps) {
  const modelData = Object.entries(summary.byModel).map(([model, data]) => ({
    model: model.split('-').slice(-1)[0],
    fullModel: model,
    cost: data.cost,
    tokens: data.tokens,
    count: data.count,
  }));

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Cost</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{formatCost(summary.total)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Tokens</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{summary.totalTokens.toLocaleString()}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Executions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{summary.executionCount}</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Cost by Model</CardTitle>
          </CardHeader>
          <CardContent>
            {modelData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={modelData}>
                  <XAxis dataKey="model" />
                  <YAxis tickFormatter={(value) => `$${value.toFixed(2)}`} />
                  <Tooltip
                    formatter={(value: number) => formatCost(value)}
                    labelFormatter={(label) => modelData.find((d) => d.model === label)?.fullModel || label}
                  />
                  <Bar dataKey="cost" fill="#0088FE" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                No cost data available
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Token Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            {modelData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={modelData}
                    dataKey="tokens"
                    nameKey="model"
                    cx="50%"
                    cy="50%"
                    outerRadius={100}
                    label={({ model, percent }) => `${model} (${(percent * 100).toFixed(0)}%)`}
                  >
                    {modelData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number) => value.toLocaleString()} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                No token data available
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Model Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2">Model</th>
                  <th className="text-right py-2">Executions</th>
                  <th className="text-right py-2">Tokens</th>
                  <th className="text-right py-2">Cost</th>
                </tr>
              </thead>
              <tbody>
                {modelData.map((row) => (
                  <tr key={row.fullModel} className="border-b">
                    <td className="py-2">{row.fullModel}</td>
                    <td className="text-right py-2">{row.count}</td>
                    <td className="text-right py-2">{row.tokens.toLocaleString()}</td>
                    <td className="text-right py-2">{formatCost(row.cost)}</td>
                  </tr>
                ))}
                {modelData.length === 0 && (
                  <tr>
                    <td colSpan={4} className="text-center py-4 text-muted-foreground">
                      No data available
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
