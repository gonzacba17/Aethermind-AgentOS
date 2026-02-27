'use client';

import { Card, CardContent } from "@/components/ui/card"
import { Bot, Activity, DollarSign, Coins, Clock, TrendingUp, TrendingDown, AlertCircle } from "lucide-react"
import { useMetrics, useClientMetrics } from "@/hooks"
import { StatsCardsSkeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

/**
 * Format large numbers to human-readable format
 */
function formatNumber(num: number): string {
  if (num >= 1000000) {
    return `${(num / 1000000).toFixed(1)}M`;
  }
  if (num >= 1000) {
    return `${(num / 1000).toFixed(1)}K`;
  }
  return num.toLocaleString();
}

/**
 * Format currency
 */
function formatCurrency(num: number): string {
  return `$${num.toFixed(2)}`;
}

interface StatCardProps {
  title: string;
  value: string;
  subtitle: string;
  icon: React.ElementType;
  trend?: string;
  trendUp?: boolean;
  showTrend?: boolean;
}

function StatCard({ title, value, subtitle, icon: Icon, trend, trendUp = true, showTrend = true }: StatCardProps) {
  return (
    <Card className="bg-card border-border hover:border-primary/50 transition-colors">
      <CardContent className="p-5">
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">{title}</span>
          <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
            <Icon className="h-4 w-4 text-primary" />
          </div>
        </div>
        <div className="mt-3 flex items-end justify-between">
          <div>
            <span className="text-3xl font-bold text-foreground">{value}</span>
            <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>
          </div>
          {showTrend && trend && (
            <div
              className={cn(
                "flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full",
                trendUp ? "bg-primary/10 text-primary" : "bg-destructive/10 text-destructive",
              )}
            >
              {trendUp ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
              {trend}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Stats Cards Component
 * 
 * Displays key metrics in a grid of cards.
 * Connected to real data via useMetrics hook.
 */
export function StatsCards() {
  const { data: metrics, isLoading: metricsLoading, error: metricsError } = useMetrics();
  const { data: clientMetrics, isLoading: clientLoading } = useClientMetrics('30d');

  const isLoading = metricsLoading || clientLoading;

  if (isLoading) {
    return <StatsCardsSkeleton />;
  }

  if (metricsError) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="col-span-full bg-destructive/10 border-destructive/50">
          <CardContent className="p-5 flex items-center gap-3">
            <AlertCircle className="h-5 w-5 text-destructive" />
            <span className="text-sm text-destructive">Failed to load metrics</span>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Prefer telemetry-based client metrics when available, fall back to legacy
  const totalCost = clientMetrics?.totalCost ?? metrics?.costMTD ?? 0;
  const totalTokens = clientMetrics?.totalTokens ?? metrics?.tokensUsed24h ?? 0;
  const totalEvents = clientMetrics?.totalEvents ?? metrics?.totalExecutions24h ?? 0;
  const avgLatency = clientMetrics?.avgLatency ?? (metrics?.avgResponseTime ? metrics.avgResponseTime * 1000 : 0);
  const successRate = clientMetrics?.successRate ?? Number(metrics?.successRate ?? 100);

  const stats = [
    {
      title: "Total Cost (30d)",
      value: formatCurrency(totalCost),
      subtitle: `${clientMetrics?.errorCount ?? 0} errors`,
      icon: DollarSign,
      trend: totalCost > 0 ? formatCurrency(totalCost) : undefined,
      trendUp: false,
    },
    {
      title: "Total Tokens",
      value: formatNumber(totalTokens),
      subtitle: "across all models",
      icon: Coins,
      trend: totalTokens > 0 ? formatNumber(totalTokens) : undefined,
      trendUp: true,
      showTrend: false,
    },
    {
      title: "Requests",
      value: formatNumber(totalEvents),
      subtitle: `${successRate.toFixed(1)}% success rate`,
      icon: Activity,
      trend: `${successRate.toFixed(1)}%`,
      trendUp: successRate >= 95,
    },
    {
      title: "Avg Latency",
      value: `${avgLatency}ms`,
      subtitle: `${metrics?.activeAgents ?? 0} active agents`,
      icon: Clock,
      trend: avgLatency > 0 ? `${avgLatency}ms` : undefined,
      trendUp: avgLatency < 2000,
      showTrend: false,
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {stats.map((stat) => (
        <StatCard key={stat.title} {...stat} />
      ))}
    </div>
  );
}
