'use client';

import { useEffect, useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { CheckCircle, Info, AlertTriangle, XCircle } from 'lucide-react';
import { fetchLogs, type LogEntry } from '@/lib/api';
import { formatDate } from '@/lib/utils';

const iconMap = {
  debug: Info,
  info: Info,
  warn: AlertTriangle,
  error: XCircle,
};

const colorMap = {
  debug: 'text-gray-500',
  info: 'text-blue-500',
  warn: 'text-yellow-500',
  error: 'text-red-500',
};

export function RecentActivity() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadLogs() {
      try {
        const response = await fetchLogs({ limit: 5 });
        setLogs(response.logs);
      } catch (error) {
        console.error('Failed to fetch recent logs:', error);
        setLogs([]);
      } finally {
        setLoading(false);
      }
    }

    loadLogs();
    const interval = setInterval(loadLogs, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>Recent Activity</CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="text-center py-8 text-muted-foreground">Loading activity...</div>
        ) : logs.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Info className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>No recent activity</p>
            <p className="text-xs mt-1">Activity will appear here as agents execute</p>
          </div>
        ) : (
          <div className="space-y-3">
            {logs.map((log) => {
              const Icon = iconMap[log.level];
              const color = colorMap[log.level];
              
              return (
                <div key={log.id} className="flex items-start gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors">
                  <Icon className={`h-4 w-4 mt-0.5 ${color}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm truncate">{log.message}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {formatDate(log.timestamp)}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
