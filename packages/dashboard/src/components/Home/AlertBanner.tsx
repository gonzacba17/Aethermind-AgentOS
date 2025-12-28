'use client';

import { useState, useEffect } from 'react';
import { AlertCircle, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface AlertBannerProps {
  condition: boolean;
  title: string;
  message: string;
  storageKey: string;
  variant?: 'error' | 'warning' | 'info';
}

const variantStyles = {
  error: 'bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-900 text-red-900 dark:text-red-100',
  warning: 'bg-yellow-50 dark:bg-yellow-950/20 border-yellow-200 dark:border-yellow-900 text-yellow-900 dark:text-yellow-100',
  info: 'bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-900 text-blue-900 dark:text-blue-100',
};

export function AlertBanner({
  condition,
  title,
  message,
  storageKey,
  variant = 'warning',
}: AlertBannerProps) {
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const wasDismissed = localStorage.getItem(`alert-dismissed-${storageKey}`) === 'true';
    setDismissed(wasDismissed);
  }, [storageKey]);

  const handleDismiss = () => {
    setDismissed(true);
    localStorage.setItem(`alert-dismissed-${storageKey}`, 'true');
  };

  if (!condition || dismissed) return null;

  return (
    <div className={`p-4 rounded-lg border flex items-start gap-3 ${variantStyles[variant]}`}>
      <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <h3 className="font-semibold mb-1">{title}</h3>
        <p className="text-sm opacity-90">{message}</p>
      </div>
      <Button
        variant="ghost"
        size="sm"
        onClick={handleDismiss}
        className="shrink-0 -mt-1 -mr-1 hover:bg-black/5 dark:hover:bg-white/5"
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
}
