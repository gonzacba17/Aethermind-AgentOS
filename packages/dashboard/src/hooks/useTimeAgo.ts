import { useState, useEffect } from 'react';

/**
 * Returns a reactive "Xs ago" / "Xm ago" string that updates every second.
 * Pass 0 or undefined to get null (no update yet).
 */
export function useTimeAgo(timestamp: number | undefined): string | null {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (!timestamp) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [timestamp]);

  if (!timestamp) return null;

  const seconds = Math.floor((now - timestamp) / 1000);
  if (seconds < 5) return 'just now';
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  return `${minutes}m ago`;
}
