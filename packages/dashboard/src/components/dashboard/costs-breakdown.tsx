'use client';

import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip, Cell } from "recharts"
import { useCostsByModel, useCostSummary } from "@/hooks"
import { ChartSkeleton } from "@/components/ui/skeleton"
import { AlertCircle, RefreshCw, ExternalLink } from "lucide-react"

// Color palette for models
const modelColors: Record<string, string> = {
  'gpt-4': '#8b5cf6',
  'gpt-4-turbo': '#a78bfa',
  'gpt-3.5-turbo': '#10b981',
  'claude-3': '#3b82f6',
  'claude-3-opus': '#1d4ed8',
  'claude-3-sonnet': '#60a5fa',
  'claude-3-haiku': '#93c5fd',
  'llama': '#f472b6',
  'mistral': '#fbbf24',
};

function getColorForModel(model: string): string {
  const lowerModel = model.toLowerCase();
  for (const [key, color] of Object.entries(modelColors)) {
    if (lowerModel.includes(key)) {
      return color;
    }
  }
  return '#64748b'; // Default gray
}

/**
 * Custom tooltip for the chart
 */
function CustomTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  
  const data = payload[0].payload;
  
  return (
    <div className="bg-popover border border-border rounded-lg p-3 shadow-lg">
      <p className="text-sm font-medium mb-1">{data.model}</p>
      <div className="space-y-1 text-xs">
        <p>
          <span className="text-muted-foreground">Cost: </span>
          <span className="font-medium">${data.cost.toFixed(2)}</span>
        </p>
        <p>
          <span className="text-muted-foreground">Tokens: </span>
          <span className="font-medium">{data.tokens.toLocaleString()}</span>
        </p>
        <p>
          <span className="text-muted-foreground">Usage: </span>
          <span className="font-medium">{data.usage}%</span>
        </p>
      </div>
    </div>
  );
}

/**
 * Costs Breakdown Component
 * 
 * Displays cost distribution across AI models in a horizontal bar chart.
 * Connected to real data via useCostsByModel hook.
 */
export function CostsBreakdown() {
  const router = useRouter();
  const { data: costsByModel, isLoading, error, refetch } = useCostsByModel();
  const { data: summary } = useCostSummary();

  const handleViewAll = () => {
    router.push('/costs');
  };

  if (isLoading) {
    return <ChartSkeleton />;
  }

  if (error) {
    return (
      <Card className="bg-card border-border">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg font-semibold text-foreground">Costs by Model</CardTitle>
            <Button variant="ghost" size="sm" onClick={() => refetch()}>
              <RefreshCw className="h-4 w-4 mr-1" />
              Retry
            </Button>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col items-center justify-center h-[200px]">
          <AlertCircle className="h-8 w-8 text-destructive/70 mb-2" />
          <p className="text-sm text-muted-foreground">Failed to load cost data</p>
        </CardContent>
      </Card>
    );
  }

  // Transform data for chart with colors
  const chartData = (costsByModel || []).map(item => ({
    ...item,
    color: getColorForModel(item.model),
  })).sort((a, b) => b.cost - a.cost);

  const totalCost = summary?.total || chartData.reduce((sum, item) => sum + item.cost, 0);

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg font-semibold text-foreground">Costs by Model</CardTitle>
            <p className="text-sm text-muted-foreground">
              ${totalCost.toFixed(2)} total this month
            </p>
          </div>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={handleViewAll}
            className="text-primary hover:text-primary/80"
          >
            <ExternalLink className="h-4 w-4 mr-1" />
            Details
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="h-[200px]">
          {chartData.length === 0 ? (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              No cost data available
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart 
                data={chartData} 
                layout="vertical" 
                margin={{ top: 10, right: 30, left: 10, bottom: 0 }}
              >
                <CartesianGrid 
                  strokeDasharray="3 3" 
                  stroke="hsl(var(--border))" 
                  horizontal={false} 
                />
                <XAxis
                  type="number"
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v) => `$${v}`}
                />
                <YAxis
                  dataKey="model"
                  type="category"
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  width={80}
                />
                <Tooltip content={<CustomTooltip />} />
                <Bar 
                  dataKey="cost" 
                  radius={[0, 4, 4, 0]}
                  cursor="pointer"
                  onClick={(data) => router.push(`/costs?model=${data.model}`)}
                >
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
