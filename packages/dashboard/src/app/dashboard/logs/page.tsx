'use client';

import { LogViewer } from '@/components/LogViewer';

export default function LogsPage() {
  return (
    <div className="p-6 h-[calc(100vh-48px)]">
      <h1 className="text-3xl font-bold mb-6">Logs</h1>
      <div className="h-[calc(100%-80px)]">
        <LogViewer maxLogs={500} />
      </div>
    </div>
  );
}
