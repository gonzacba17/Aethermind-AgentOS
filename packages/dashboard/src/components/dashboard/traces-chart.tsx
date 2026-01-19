'use client';

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip } from "recharts"
import { useTraceTimeSeries } from "@/hooks"
import { ChartSkeleton } from "@/components/ui/skeleton"
import { AlertCircle, RefreshCw } from "lucide-react"

/**
 * Format time for chart labels
 */
function formatTimeLabel(isoString: string): string {
  try {
    const date = new Date(isoString);
    return date.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      hour12: false 
    }) + ':00';
  } catch {
    return '';
  }
}

/**
 * Custom tooltip for the chart
 */
function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  
  const data = payload[0].payload;
  const time = new Date(data.time);
  
  return (
    <div className="bg-popover border border-border rounded-lg p-3 shadow-lg">
      <p className="text-xs text-muted-foreground mb-1">
        {time.toLocaleString('en-US', { 
          month: 'short', 
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          hour12: false
        })}
      </p>
      <div className="space-y-1">
        <p className="text-sm">
          <span className="text-primary font-medium">{data.traces}</span>
          <span className="text-muted-foreground"> traces</span>
        </p>
        {data.errors > 0 && (
          <p className="text-sm">
            <span className="text-destructive font-medium">{data.errors}</span>
            <span className="text-muted-foreground"> errors</span>
          </p>
        )}
      </div>
    </div>
  );
}

/**
 * Traces Chart Component
 * 
 * Displays trace count over time in an area chart.
 * Connected to real data via useTraceTimeSeries hook.
 */
export function TracesChart() {
  const { data, isLoading, error, refetch } = useTraceTimeSeries('24h');

  if (isLoading) {
    return <ChartSkeleton />;
  }

  if (error) {
    return (
      <Card className="bg-card border-border">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg font-semibold text-foreground">Traces Over Time</CardTitle>
            <Button variant="ghost" size="sm" onClick={() => refetch()}>
              <RefreshCw className="h-4 w-4 mr-1" />
              Retry
            </Button>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col items-center justify-center h-[200px]">
          <AlertCircle className="h-8 w-8 text-destructive/70 mb-2" />
          <p className="text-sm text-muted-foreground">Failed to load chart data</p>
        </CardContent>
      </Card>
    );
  }

  // Transform data for chart
  const chartData = data?.map(point => ({
    ...point,
    timeLabel: formatTimeLabel(point.time),
  })) || [];

  // Calculate totals for header
  const totalTraces = chartData.reduce((sum, point) => sum + point.traces, 0);
  const totalErrors = chartData.reduce((sum, point) => sum + point.errors, 0);

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg font-semibold text-foreground">Traces Over Time</CardTitle>
            <p className="text-sm text-muted-foreground">
              {totalTraces.toLocaleString()} traces in the last 24 hours
              {totalErrors > 0 && (
                <span className="text-destructive ml-2">
                  ({totalErrors} errors)
                </span>
              )}
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="h-[200px]">
          {chartData.length === 0 ? (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              No trace data available
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="traceGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="errorGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--destructive))" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="hsl(var(--destructive))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid 
                  strokeDasharray="3 3" 
                  stroke="hsl(var(--border))" 
                  vertical={false} 
                />
                <XAxis 
                  dataKey="timeLabel" 
                  stroke="hsl(var(--muted-foreground))" 
                  fontSize={11} 
                  tickLine={false} 
                  axisLine={false} 
                />
                <YAxis 
                  stroke="hsl(var(--muted-foreground))" 
                  fontSize={11} 
                  tickLine={false} 
                  axisLine={false} 
                />
                <Tooltip content={<CustomTooltip />} />
                <Area 
                  type="monotone" 
                  dataKey="traces" 
                  stroke="hsl(var(--primary))" 
                  strokeWidth={2} 
                  fill="url(#traceGradient)" 
                />
                {totalErrors > 0 && (
                  <Area 
                    type="monotone" 
                    dataKey="errors" 
                    stroke="hsl(var(--destructive))" 
                    strokeWidth={2} 
                    fill="url(#errorGradient)" 
                  />
                )}
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
