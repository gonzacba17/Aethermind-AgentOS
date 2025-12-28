'use client';

import { useEffect, useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TraceTree } from '@/components/TraceTree';
import { BackToHomeButton } from '@/components/BackToHomeButton';
import { fetchTraces, type Trace } from '@/lib/api';
import { formatDate, formatDuration } from '@/lib/utils';

export default function TracesPage() {
  const [traces, setTraces] = useState<Trace[]>([]);
  const [selectedTrace, setSelectedTrace] = useState<Trace | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadTraces() {
      try {
        const data = await fetchTraces();
        setTraces(data);
        if (data.length > 0) {
          setSelectedTrace(data[0] || null);
        }
      } catch (error) {
        console.error('Failed to fetch traces:', error);
      } finally {
        setLoading(false);
      }
    }
    loadTraces();
  }, []);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Traces</h1>
        <BackToHomeButton />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Executions</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-4 text-muted-foreground">Loading...</div>
            ) : traces.length === 0 ? (
              <div className="text-center py-4 text-muted-foreground">No traces yet</div>
            ) : (
              <div className="space-y-2">
                {traces.map((trace) => (
                  <div
                    key={trace.id}
                    className={`p-3 rounded-lg cursor-pointer transition-colors ${
                      selectedTrace?.id === trace.id
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted hover:bg-muted/80'
                    }`}
                    onClick={() => setSelectedTrace(trace)}
                  >
                    <div className="font-medium">{trace.rootNode.name}</div>
                    <div className="text-xs opacity-80">
                      {formatDate(trace.createdAt)}
                    </div>
                    {trace.rootNode.duration && (
                      <Badge variant="outline" className="mt-1">
                        {formatDuration(trace.rootNode.duration)}
                      </Badge>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Decision Tree</CardTitle>
          </CardHeader>
          <CardContent>
            {selectedTrace ? (
              <TraceTree node={selectedTrace.rootNode} />
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                Select a trace to view its decision tree
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
