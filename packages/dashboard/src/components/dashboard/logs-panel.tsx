'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuCheckboxItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu"
import { ChevronDown, Columns2, Trash2, Circle, AlertCircle, Pause, Play, ExternalLink } from "lucide-react"
import { useLogs, useWebSocket } from "@/hooks"
import { LogsPanelSkeleton } from "@/components/ui/skeleton"
import { EmptyState } from "@/components/ui/empty-state"
import { ConnectionStatus } from "@/components/ui/connection-status"
import { Badge } from "@/components/ui/badge"

const levelColors = {
  debug: 'text-muted-foreground fill-muted-foreground',
  info: 'text-primary fill-primary',
  warn: 'text-amber-500 fill-amber-500',
  warning: 'text-amber-500 fill-amber-500',
  error: 'text-destructive fill-destructive',
};

const levelLabels = {
  debug: 'Debug',
  info: 'Info',
  warn: 'Warning',
  warning: 'Warning',
  error: 'Error',
};

/**
 * Logs Panel Component
 * 
 * Displays recent logs in the dashboard with real-time updates.
 * Connected to real data via useLogs hook and WebSocket.
 */
export function LogsPanel() {
  const router = useRouter();
  const [selectedLevels, setSelectedLevels] = useState<string[]>([]);
  const [isPaused, setIsPaused] = useState(false);
  
  const { isConnected, lastEvent } = useWebSocket();
  const { data, isLoading, error, refetch } = useLogs({ 
    level: selectedLevels.length > 0 ? selectedLevels : undefined,
    limit: 10 
  });

  // Track new logs from WebSocket when not paused
  const [liveLogs, setLiveLogs] = useState<any[]>([]);
  
  useEffect(() => {
    if (lastEvent?.type === 'log' && !isPaused) {
      setLiveLogs(prev => [lastEvent.data, ...prev].slice(0, 10));
    }
  }, [lastEvent, isPaused]);

  // Combine API logs with live logs
  const logs = isPaused 
    ? (data?.logs || []) 
    : [...liveLogs, ...(data?.logs || [])].slice(0, 10);

  const toggleLevel = (level: string) => {
    setSelectedLevels(prev => 
      prev.includes(level) 
        ? prev.filter(l => l !== level)
        : [...prev, level]
    );
  };

  const handleViewAll = () => {
    router.push('/logs');
  };

  const handleClearLogs = () => {
    setLiveLogs([]);
    // Note: This only clears live logs from display
    // Backend logs are not deleted
  };

  const formatTimestamp = (timestamp: string) => {
    try {
      const date = new Date(timestamp);
      return date.toLocaleTimeString('en-US', { 
        hour12: false, 
        hour: '2-digit', 
        minute: '2-digit', 
        second: '2-digit' 
      });
    } catch {
      return timestamp;
    }
  };

  if (isLoading) {
    return <LogsPanelSkeleton items={5} />;
  }

  if (error) {
    return (
      <Card className="bg-card border-border h-full">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <CardTitle className="text-lg font-semibold text-foreground">Logs</CardTitle>
          <Button variant="ghost" size="sm" onClick={() => refetch()}>
            Retry
          </Button>
        </CardHeader>
        <CardContent className="flex flex-col items-center justify-center py-8">
          <AlertCircle className="h-8 w-8 text-destructive/70 mb-2" />
          <p className="text-sm text-muted-foreground">Failed to load logs</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-card border-border h-full">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <div className="flex items-center gap-2">
          <CardTitle className="text-lg font-semibold text-foreground">Logs</CardTitle>
          <ConnectionStatus size="sm" />
        </div>
        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1 h-8 bg-transparent border-border text-foreground">
                {selectedLevels.length === 0 ? 'All Levels' : `${selectedLevels.length} selected`}
                <ChevronDown className="h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuCheckboxItem 
                checked={selectedLevels.includes('info')}
                onCheckedChange={() => toggleLevel('info')}
              >
                <Circle className="h-2 w-2 text-primary fill-primary mr-2" />
                Info
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem 
                checked={selectedLevels.includes('warn')}
                onCheckedChange={() => toggleLevel('warn')}
              >
                <Circle className="h-2 w-2 text-amber-500 fill-amber-500 mr-2" />
                Warning
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem 
                checked={selectedLevels.includes('error')}
                onCheckedChange={() => toggleLevel('error')}
              >
                <Circle className="h-2 w-2 text-destructive fill-destructive mr-2" />
                Error
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem 
                checked={selectedLevels.includes('debug')}
                onCheckedChange={() => toggleLevel('debug')}
              >
                <Circle className="h-2 w-2 text-muted-foreground fill-muted-foreground mr-2" />
                Debug
              </DropdownMenuCheckboxItem>
              {selectedLevels.length > 0 && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => setSelectedLevels([])}>
                    Clear filters
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
          <Button 
            variant="outline" 
            size="icon" 
            className="h-8 w-8 bg-transparent border-border"
            onClick={() => setIsPaused(!isPaused)}
            title={isPaused ? 'Resume' : 'Pause'}
          >
            {isPaused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
          </Button>
          <Button 
            variant="outline" 
            size="icon" 
            className="h-8 w-8 bg-transparent border-border"
            onClick={handleClearLogs}
            title="Clear logs"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
          <Button 
            variant="outline" 
            size="icon" 
            className="h-8 w-8 bg-transparent border-border"
            onClick={handleViewAll}
            title="View all logs"
          >
            <ExternalLink className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {logs.length === 0 ? (
          <EmptyState
            preset="logs"
            className="py-8"
          />
        ) : (
          <div className="space-y-2 font-mono text-sm max-h-[280px] overflow-y-auto">
            {logs.map((log: any, index: number) => (
              <div
                key={log.id || `log-${index}`}
                className="flex items-start gap-3 p-2.5 rounded-lg bg-secondary/30 hover:bg-secondary/50 transition-colors cursor-pointer"
                onClick={() => router.push(`/logs?search=${encodeURIComponent(log.message?.slice(0, 30))}`)}
              >
                <span className="text-xs text-muted-foreground shrink-0 pt-0.5">
                  {formatTimestamp(log.timestamp)}
                </span>
                <Circle
                  className={`h-2 w-2 mt-1.5 shrink-0 ${
                    levelColors[log.level as keyof typeof levelColors] || levelColors.info
                  }`}
                />
                <span className="text-foreground/90 flex-1 text-xs leading-relaxed line-clamp-2">
                  {log.message}
                </span>
                {log.agentId && (
                  <Badge variant="outline" className="text-[10px] shrink-0">
                    Agent
                  </Badge>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
