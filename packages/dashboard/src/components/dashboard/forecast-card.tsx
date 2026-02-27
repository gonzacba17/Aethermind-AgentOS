'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { TrendingUp, Target, Calendar, BarChart3 } from 'lucide-react';
import { useClientForecast } from '@/hooks';
import { cn } from '@/lib/utils';

function getIndicatorColor(percentProjected: number | null | undefined, hasBudget: boolean) {
  if (!hasBudget || percentProjected == null) return '';
  if (percentProjected >= 100) return 'text-destructive';
  if (percentProjected >= 80) return 'text-yellow-500';
  return 'text-green-500';
}

function getIndicatorBg(percentProjected: number | null | undefined, hasBudget: boolean) {
  if (!hasBudget || percentProjected == null) return 'bg-muted';
  if (percentProjected >= 100) return 'bg-destructive/10';
  if (percentProjected >= 80) return 'bg-yellow-500/10';
  return 'bg-green-500/10';
}

function getConfidenceLabel(confidence: string) {
  switch (confidence) {
    case 'high': return 'High confidence';
    case 'medium': return 'Medium confidence';
    default: return 'Low confidence (limited data)';
  }
}

export function ForecastCard() {
  const { data: forecast, isLoading, error } = useClientForecast();

  if (isLoading) {
    return (
      <Card className="bg-card border-border">
        <CardContent className="p-5">
          <div className="text-sm text-muted-foreground py-4 text-center">Loading forecast...</div>
        </CardContent>
      </Card>
    );
  }

  if (error || !forecast) {
    return (
      <Card className="bg-card border-border">
        <CardContent className="p-5">
          <div className="text-sm text-muted-foreground py-4 text-center">
            Unable to generate forecast. More data needed.
          </div>
        </CardContent>
      </Card>
    );
  }

  const hasBudget = !!forecast.budget;
  const percentProjected = forecast.budget?.percentProjected;
  const indicatorColor = getIndicatorColor(percentProjected, hasBudget);
  const indicatorBg = getIndicatorBg(percentProjected, hasBudget);

  return (
    <Card className={cn('bg-card border-border', hasBudget && indicatorBg)}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <TrendingUp className={cn('h-5 w-5', indicatorColor || 'text-primary')} />
          Monthly Forecast
        </CardTitle>
        <CardDescription>{getConfidenceLabel(forecast.confidence)}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Main projection */}
        <div className="text-center">
          <span className="text-xs text-muted-foreground uppercase tracking-wider">
            At this rate, you'll spend
          </span>
          <p className={cn('text-4xl font-bold mt-1', indicatorColor || 'text-foreground')}>
            ~${forecast.projectedMonthlyUsd.toFixed(2)}
          </p>
          <span className="text-sm text-muted-foreground">this month</span>
        </div>

        {/* Budget comparison */}
        {hasBudget && percentProjected != null && (
          <div className="flex items-center justify-center gap-2">
            <Target className={cn('h-4 w-4', indicatorColor)} />
            <span className={cn('text-sm font-medium', indicatorColor)}>
              {percentProjected >= 100
                ? `Projected to exceed budget by ${(percentProjected - 100).toFixed(0)}%`
                : `${percentProjected.toFixed(0)}% of $${forecast.budget!.limitUsd} budget`}
            </span>
          </div>
        )}

        {/* Stats grid */}
        <div className="grid grid-cols-3 gap-3 pt-2 border-t border-border">
          <div className="text-center">
            <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground">
              <BarChart3 className="h-3 w-3" />
              Avg/day
            </div>
            <p className="text-sm font-medium mt-1">${forecast.avgDailyUsd.toFixed(2)}</p>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground">
              <TrendingUp className="h-3 w-3" />
              Spent so far
            </div>
            <p className="text-sm font-medium mt-1">${forecast.spentSoFar.toFixed(2)}</p>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground">
              <Calendar className="h-3 w-3" />
              Days left
            </div>
            <p className="text-sm font-medium mt-1">{forecast.daysRemaining}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
