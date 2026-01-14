'use client';

import { useEffect, useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle, Circle, Rocket } from 'lucide-react';

interface ChecklistItem {
  id: string;
  label: string;
  checked: boolean;
}

export function GettingStarted() {
  const [items, setItems] = useState<ChecklistItem[]>([
    { id: 'api', label: 'API Connected', checked: false },
    { id: 'agent', label: 'Create your first agent', checked: false },
    { id: 'demo', label: 'Run a demo workflow', checked: false },
    { id: 'alerts', label: 'Set up cost alerts', checked: false },
    { id: 'docs', label: 'Review documentation', checked: false },
  ]);

  // Load from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('gettingStartedChecklist');
    if (saved) {
      try {
        setItems(JSON.parse(saved));
      } catch (e) {
        console.error('Failed to load checklist:', e);
      }
    }
  }, []);

  // Save to localStorage when items change
  const toggleItem = (id: string) => {
    const newItems = items.map((item) =>
      item.id === id ? { ...item, checked: !item.checked } : item
    );
    setItems(newItems);
    localStorage.setItem('gettingStartedChecklist', JSON.stringify(newItems));
  };

  const completedCount = items.filter((item) => item.checked).length;
  const progress = Math.round((completedCount / items.length) * 100);

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Getting Started</span>
          <span className="text-sm font-normal text-muted-foreground">{progress}%</span>
        </CardTitle>
        <div className="w-full bg-muted rounded-full h-2 mt-2">
          <div
            className="bg-primary h-2 rounded-full transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          {items.map((item) => (
            <button
              key={item.id}
              onClick={() => toggleItem(item.id)}
              className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors text-left"
            >
              {item.checked ? (
                <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
              ) : (
                <Circle className="h-5 w-5 text-muted-foreground" />
              )}
              <span className={item.checked ? 'line-through text-muted-foreground' : ''}>
                {item.label}
              </span>
            </button>
          ))}
        </div>

        {progress === 100 && (
          <div className="p-3 bg-green-50 dark:bg-green-950/20 rounded-lg border border-green-200 dark:border-green-900">
            <div className="flex items-center gap-2 text-sm text-green-900 dark:text-green-100">
              <Rocket className="h-4 w-4" />
              <span className="font-semibold">Great job! You&apos;re all set up.</span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
