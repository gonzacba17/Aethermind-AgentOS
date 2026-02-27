'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { TrendingUp, TrendingDown, ArrowRight } from 'lucide-react';
import { usePeriodComparison } from '@/hooks';
import { cn } from '@/lib/utils';

function formatCurrency(num: number): string {
  return `$${Math.abs(num).toFixed(2)}`;
}

export function PeriodComparisonCard() {
  const [period, setPeriod] = useState<'week' | 'month'>('month');
  const { data, isLoading, error } = usePeriodComparison(period);

  const label = period === 'week' ? 'This week vs last week' : 'This month vs last month';

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg">Period Comparison</CardTitle>
            <CardDescription>{label}</CardDescription>
          </div>
          <div className="flex gap-1">
            <button
              onClick={() => setPeriod('week')}
              className={cn(
                'px-3 py-1 text-xs rounded-md transition-colors',
                period === 'week'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
              )}
            >
              Week
            </button>
            <button
              onClick={() => setPeriod('month')}
              className={cn(
                'px-3 py-1 text-xs rounded-md transition-colors',
                period === 'month'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
              )}
            >
              Month
            </button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="text-sm text-muted-foreground py-4 text-center">Loading...</div>
        ) : error ? (
          <div className="text-sm text-destructive py-4 text-center">Failed to load comparison</div>
        ) : data ? (
          <div className="space-y-4">
            {/* Cost comparison */}
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <span className="text-xs text-muted-foreground uppercase tracking-wider">Cost</span>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">{formatCurrency(data.previous.cost)}</span>
                  <ArrowRight className="h-3 w-3 text-muted-foreground" />
                  <span className="text-sm font-medium">{formatCurrency(data.current.cost)}</span>
                </div>
              </div>
              <div
                className={cn(
                  'flex items-center gap-1 text-sm font-medium px-2 py-1 rounded-full',
                  data.delta.cost > 0
                    ? 'bg-destructive/10 text-destructive'
                    : data.delta.cost < 0
                    ? 'bg-green-500/10 text-green-500'
                    : 'bg-muted text-muted-foreground'
                )}
              >
                {data.delta.cost > 0 ? (
                  <TrendingUp className="h-3 w-3" />
                ) : data.delta.cost < 0 ? (
                  <TrendingDown className="h-3 w-3" />
                ) : null}
                {data.delta.costPercent > 0 ? '+' : ''}{data.delta.costPercent.toFixed(1)}%
              </div>
            </div>

            {/* Tokens comparison */}
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <span className="text-xs text-muted-foreground uppercase tracking-wider">Tokens</span>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">{data.previous.tokens.toLocaleString()}</span>
                  <ArrowRight className="h-3 w-3 text-muted-foreground" />
                  <span className="text-sm font-medium">{data.current.tokens.toLocaleString()}</span>
                </div>
              </div>
              <span className="text-xs text-muted-foreground">
                {data.delta.tokens > 0 ? '+' : ''}{data.delta.tokens.toLocaleString()}
              </span>
            </div>

            {/* Requests comparison */}
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <span className="text-xs text-muted-foreground uppercase tracking-wider">Requests</span>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">{data.previous.requests.toLocaleString()}</span>
                  <ArrowRight className="h-3 w-3 text-muted-foreground" />
                  <span className="text-sm font-medium">{data.current.requests.toLocaleString()}</span>
                </div>
              </div>
              <span className="text-xs text-muted-foreground">
                {data.delta.requests > 0 ? '+' : ''}{data.delta.requests.toLocaleString()}
              </span>
            </div>
          </div>
        ) : (
          <div className="text-sm text-muted-foreground py-4 text-center">No data</div>
        )}
      </CardContent>
    </Card>
  );
}
