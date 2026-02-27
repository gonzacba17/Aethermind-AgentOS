'use client';

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip } from "recharts"
import { useClientTimeseries } from "@/hooks"
import { ChartSkeleton } from "@/components/ui/skeleton"
import { AlertCircle, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;

  const data = payload[0].payload;
  return (
    <div className="bg-popover border border-border rounded-lg p-3 shadow-lg">
      <p className="text-sm font-medium mb-1">{data.date}</p>
      <div className="space-y-1 text-xs">
        <p>
          <span className="text-muted-foreground">Cost: </span>
          <span className="font-medium">${data.cost.toFixed(4)}</span>
        </p>
        <p>
          <span className="text-muted-foreground">Tokens: </span>
          <span className="font-medium">{data.tokens.toLocaleString()}</span>
        </p>
        <p>
          <span className="text-muted-foreground">Requests: </span>
          <span className="font-medium">{data.events}</span>
        </p>
      </div>
    </div>
  );
}

export function CostTimeseriesChart() {
  const { data, isLoading, error, refetch } = useClientTimeseries('30d');

  if (isLoading) {
    return <ChartSkeleton />;
  }

  if (error) {
    return (
      <Card className="bg-card border-border">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg font-semibold text-foreground">Cost Trend</CardTitle>
            <Button variant="ghost" size="sm" onClick={() => refetch()}>
              <RefreshCw className="h-4 w-4 mr-1" />
              Retry
            </Button>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col items-center justify-center h-[200px]">
          <AlertCircle className="h-8 w-8 text-destructive/70 mb-2" />
          <p className="text-sm text-muted-foreground">Failed to load cost trend</p>
        </CardContent>
      </Card>
    );
  }

  const chartData = data || [];

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg font-semibold text-foreground">Cost Trend (30d)</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[200px]">
          {chartData.length === 0 ? (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              No telemetry data yet
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 30, left: 10, bottom: 0 }}>
                <defs>
                  <linearGradient id="costGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis
                  dataKey="date"
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v) => {
                    const d = new Date(v);
                    return `${d.getMonth() + 1}/${d.getDate()}`;
                  }}
                />
                <YAxis
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v) => `$${v}`}
                />
                <Tooltip content={<CustomTooltip />} />
                <Area
                  type="monotone"
                  dataKey="cost"
                  stroke="hsl(var(--primary))"
                  fill="url(#costGradient)"
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
