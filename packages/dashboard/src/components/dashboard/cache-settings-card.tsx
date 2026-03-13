'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Settings2, Trash2, Loader2 } from 'lucide-react';
import { useCacheSettings, useUpdateCacheSettings, usePurgeCache } from '@/hooks/api/useClientCache';

export function CacheSettingsCard() {
  const { data: settings, isLoading } = useCacheSettings();
  const updateSettings = useUpdateCacheSettings();
  const purgeCache = usePurgeCache();

  const [localEnabled, setLocalEnabled] = useState<boolean | null>(null);
  const [localThreshold, setLocalThreshold] = useState<number | null>(null);
  const [localTtlHours, setLocalTtlHours] = useState<string>('');

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings2 className="h-5 w-5" />
            Cache Settings
          </CardTitle>
          <CardDescription>Loading settings...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-3">
            <div className="h-4 bg-muted rounded w-3/4" />
            <div className="h-4 bg-muted rounded w-1/2" />
          </div>
        </CardContent>
      </Card>
    );
  }

  const enabled = localEnabled ?? settings?.enabled ?? false;
  const threshold = localThreshold ?? settings?.similarityThreshold ?? 0.90;
  const ttlSeconds = settings?.ttlSeconds ?? 86400;
  const ttlHours = localTtlHours || String(Math.round(ttlSeconds / 3600));

  const handleToggle = (checked: boolean) => {
    setLocalEnabled(checked);
    updateSettings.mutate({ enabled: checked });
  };

  const handleThresholdChange = (value: number[]) => {
    setLocalThreshold(value[0]);
  };

  const handleThresholdCommit = () => {
    if (localThreshold != null) {
      updateSettings.mutate({ similarityThreshold: localThreshold });
    }
  };

  const handleTtlSave = () => {
    const hours = parseInt(localTtlHours, 10);
    if (!isNaN(hours) && hours > 0) {
      updateSettings.mutate({ ttlSeconds: hours * 3600 });
      setLocalTtlHours('');
    }
  };

  const handlePurge = () => {
    if (confirm('Are you sure you want to purge all cached entries?')) {
      purgeCache.mutate();
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Settings2 className="h-5 w-5" />
          Cache Settings
        </CardTitle>
        <CardDescription>
          Configure semantic caching behavior
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Enable/Disable */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">Semantic Cache</p>
            <p className="text-xs text-muted-foreground">
              Enable similarity-based prompt caching
            </p>
          </div>
          <Switch
            checked={enabled}
            onCheckedChange={handleToggle}
            disabled={updateSettings.isPending}
          />
        </div>

        {/* Similarity Threshold */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">Similarity Threshold</p>
            <span className="text-sm text-muted-foreground">
              {(threshold * 100).toFixed(0)}%
            </span>
          </div>
          <Slider
            value={[threshold]}
            min={0.80}
            max={0.99}
            step={0.01}
            onValueChange={handleThresholdChange}
            onValueCommit={handleThresholdCommit}
            disabled={!enabled}
          />
          <p className="text-xs text-muted-foreground">
            Higher = stricter matching (fewer cache hits, more accurate)
          </p>
        </div>

        {/* TTL */}
        <div className="space-y-2">
          <p className="text-sm font-medium">TTL (hours)</p>
          <div className="flex gap-2">
            <Input
              type="number"
              placeholder={ttlHours}
              value={localTtlHours}
              onChange={(e) => setLocalTtlHours(e.target.value)}
              disabled={!enabled}
              className="w-24"
              min={1}
            />
            <Button
              size="sm"
              variant="outline"
              onClick={handleTtlSave}
              disabled={!enabled || !localTtlHours || updateSettings.isPending}
            >
              Save
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Current: {Math.round(ttlSeconds / 3600)}h ({(ttlSeconds / 86400).toFixed(1)} days)
          </p>
        </div>

        {/* Purge */}
        <div className="pt-2 border-t border-border">
          <Button
            variant="outline"
            size="sm"
            onClick={handlePurge}
            disabled={purgeCache.isPending}
            className="w-full border-red-500/30 text-[#ff4444] hover:bg-red-500/10"
          >
            {purgeCache.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Trash2 className="h-4 w-4 mr-2" />
            )}
            Purge Cache
          </Button>
          {purgeCache.isSuccess && (
            <p className="text-xs text-green-500 mt-1 text-center">
              Cache purged successfully
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
