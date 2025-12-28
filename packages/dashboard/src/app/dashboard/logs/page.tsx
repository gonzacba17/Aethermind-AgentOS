'use client';

import { LogViewer } from '@/components/LogViewer';
import { BackToHomeButton } from '@/components/BackToHomeButton';

export default function LogsPage() {
  return (
    <div className="p-6 h-[calc(100vh-48px)]">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">Logs</h1>
        <BackToHomeButton />
      </div>
      <div className="h-[calc(100%-80px)]">
        <LogViewer maxLogs={500} />
      </div>
    </div>
  );
}
