'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Database, TrendingUp, Zap, Hash } from 'lucide-react';
import { useCacheStats } from '@/hooks/api/useClientCache';

export function CacheStatsCard() {
  const { data: stats, isLoading } = useCacheStats('30d');

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Semantic Cache
          </CardTitle>
          <CardDescription>Loading cache analytics...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-3">
            <div className="h-4 bg-muted rounded w-3/4" />
            <div className="h-4 bg-muted rounded w-1/2" />
            <div className="h-4 bg-muted rounded w-2/3" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!stats) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Semantic Cache
          </CardTitle>
          <CardDescription>No cache data available yet</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const hitRatePercent = (stats.hitRate * 100).toFixed(1);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Database className="h-5 w-5" />
          Semantic Cache
        </CardTitle>
        <CardDescription>
          Cache performance over the last {stats.period}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Key metrics */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <TrendingUp className="h-3 w-3" />
              Hit Rate
            </p>
            <p className="text-2xl font-bold">{hitRatePercent}%</p>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <Zap className="h-3 w-3" />
              Total Saved
            </p>
            <p className="text-2xl font-bold text-green-500">
              ${stats.totalSavedUsd.toFixed(2)}
            </p>
          </div>
        </div>

        {/* Progress ring representation */}
        <div className="flex items-center gap-4">
          <div className="flex-1 bg-muted rounded-full h-2">
            <div
              className="h-2 rounded-full bg-primary transition-all"
              style={{ width: `${Math.min(parseFloat(hitRatePercent), 100)}%` }}
            />
          </div>
          <span className="text-xs text-muted-foreground">
            {stats.cacheHits}/{stats.totalRequests} hits
          </span>
        </div>

        {/* Cache info */}
        <div className="grid grid-cols-2 gap-4 pt-2 border-t border-border">
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <Hash className="h-3 w-3" />
              Cache Size
            </p>
            <p className="text-sm font-medium">{stats.cacheSize} entries</p>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Deterministic</p>
            <p className="text-sm font-medium">{stats.deterministicCount} entries</p>
          </div>
        </div>

        {/* Top cached prompts */}
        {stats.topCachedPrompts.length > 0 && (
          <div className="pt-2 border-t border-border">
            <p className="text-xs text-muted-foreground mb-2">Top Cached Prompts</p>
            <div className="space-y-2">
              {stats.topCachedPrompts.slice(0, 3).map((p, i) => (
                <div key={i} className="flex items-center justify-between text-xs">
                  <span className="truncate flex-1 mr-2 text-muted-foreground">
                    {p.promptPreview}...
                  </span>
                  <span className="text-nowrap font-medium">
                    {p.hitCount} hits (${p.savedUsd.toFixed(2)})
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
