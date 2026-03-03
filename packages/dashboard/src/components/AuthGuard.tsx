'use client';

import { useEffect, useState } from 'react';
import { useAuthStore } from '@/store/useAuthStore';
import { LOGIN_URL } from '@/lib/config';

/**
 * Authentication Guard — B2B Beta
 *
 * Token capture happens in app/page.tsx (root page).
 * By the time AuthGuard mounts the token is already in localStorage.
 *
 * Calls initialize() once — it reads the token from localStorage,
 * validates via GET /api/client/me, and populates the auth store.
 */
export function AuthGuard({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<'loading' | 'authenticated' | 'denied'>('loading');
  const initialize = useAuthStore((s) => s.initialize);

  useEffect(() => {
    let cancelled = false;

    initialize().then((ok) => {
      if (!cancelled) setStatus(ok ? 'authenticated' : 'denied');
    });

    return () => { cancelled = true; };
  }, [initialize]);

  // Auto-redirect to login when denied
  useEffect(() => {
    if (status === 'denied') {
      const timer = setTimeout(() => {
        window.location.href = `${LOGIN_URL}?redirect=dashboard`;
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [status]);

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="inline-block h-12 w-12 animate-spin rounded-full border-4 border-solid border-primary border-r-transparent mb-4" />
          <p className="text-muted-foreground">Verifying access...</p>
        </div>
      </div>
    );
  }

  if (status === 'denied') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center max-w-md mx-auto p-8">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-6">
            <span className="text-primary font-bold text-2xl">A</span>
          </div>
          <h1 className="text-2xl font-bold text-foreground mb-3">
            Aethermind AgentOS
          </h1>
          <p className="text-muted-foreground mb-6">
            Session expired or not authenticated. Redirecting to login...
          </p>
          <a
            href={`${LOGIN_URL}?redirect=dashboard`}
            className="inline-flex items-center justify-center rounded-md bg-primary px-6 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            Go to Login
          </a>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
