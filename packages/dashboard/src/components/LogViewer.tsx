'use client';

import { useEffect, useState, useRef } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Pause, Play, Trash2 } from 'lucide-react';
import { useWebSocket } from '@/hooks/useWebSocket';
import type { LogEntry } from '@/lib/api';
import { formatDate, getWebSocketUrl } from '@/lib/utils';

interface LogViewerProps {
  initialLogs?: LogEntry[];
  maxLogs?: number;
}

function getLevelVariant(level: LogEntry['level']) {
  switch (level) {
    case 'debug':
      return 'secondary';
    case 'info':
      return 'default';
    case 'warn':
      return 'warning';
    case 'error':
      return 'destructive';
    default:
      return 'default';
  }
}

export function LogViewer({ initialLogs = [], maxLogs = 200 }: LogViewerProps) {
  const [logs, setLogs] = useState<LogEntry[]>(initialLogs);
  const [isPaused, setIsPaused] = useState(false);
  const [filter, setFilter] = useState<LogEntry['level'] | 'all'>('all');
  const containerRef = useRef<HTMLDivElement>(null);
  const wsUrl = getWebSocketUrl();

  const { subscribe, isConnected } = useWebSocket(wsUrl);

  useEffect(() => {
    if (isPaused) return;

    const unsubscribe = subscribe('log', (data) => {
      const entry = data as LogEntry;
      setLogs((prev) => {
        const newLogs = [...prev, entry];
        if (newLogs.length > maxLogs) {
          return newLogs.slice(-maxLogs);
        }
        return newLogs;
      });
    });

    return unsubscribe;
  }, [subscribe, isPaused, maxLogs]);

  useEffect(() => {
    if (containerRef.current && !isPaused) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [logs, isPaused]);

  const filteredLogs = filter === 'all' ? logs : logs.filter((log) => log.level === filter);

  const clearLogs = () => setLogs([]);

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CardTitle>Logs</CardTitle>
            <Badge variant={isConnected ? 'success' : 'destructive'}>
              {isConnected ? 'Connected' : 'Disconnected'}
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            <select
              className="text-sm border rounded px-2 py-1"
              value={filter}
              onChange={(e) => setFilter(e.target.value as typeof filter)}
            >
              <option value="all">All Levels</option>
              <option value="debug">Debug</option>
              <option value="info">Info</option>
              <option value="warn">Warn</option>
              <option value="error">Error</option>
            </select>
            <Button size="sm" variant="outline" onClick={() => setIsPaused(!isPaused)}>
              {isPaused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
            </Button>
            <Button size="sm" variant="outline" onClick={clearLogs}>
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex-1 overflow-hidden p-0">
        <div ref={containerRef} className="h-full overflow-y-auto font-mono text-xs p-4">
          {filteredLogs.length === 0 ? (
            <div className="text-muted-foreground text-center py-8">No logs yet</div>
          ) : (
            filteredLogs.map((log) => (
              <div key={log.id} className="flex gap-2 py-1 hover:bg-muted/50 px-2 rounded">
                <span className="text-muted-foreground whitespace-nowrap">
                  {formatDate(log.timestamp).split(' ')[1]}
                </span>
                <Badge variant={getLevelVariant(log.level)} className="text-[10px] px-1">
                  {log.level.toUpperCase().padEnd(5)}
                </Badge>
                {log.agentId && (
                  <span className="text-blue-500">[{log.agentId.slice(0, 8)}]</span>
                )}
                <span className="flex-1">{log.message}</span>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}
