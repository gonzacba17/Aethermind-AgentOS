'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { getAuthToken, setAuthToken, clearAuthToken } from '@/lib/auth-utils';
import { useAuthStore } from '@/store/useAuthStore';

/**
 * Authentication Guard — B2B Beta
 *
 * 1. On mount, check URL for ?token= param
 * 2. If present → save to sessionStorage, remove from URL
 * 3. Check sessionStorage for token
 * 4. If token exists → validate via GET /api/client/me
 * 5. If valid → render children
 * 6. If no token or invalid → show "Contact Aethermind for access" screen
 *
 * Previous version redirected to landing page for OAuth login.
 */

function AuthGuardInner({ children }: { children: React.ReactNode }) {
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<'loading' | 'authenticated' | 'denied'>('loading');
  const initialize = useAuthStore((s) => s.initialize);

  useEffect(() => {
    async function check() {
      // 1. Capture ?token= from URL
      const urlToken = searchParams.get('token');
      if (urlToken) {
        setAuthToken(urlToken);
        // Remove token from URL for clean UX
        const url = new URL(window.location.href);
        url.searchParams.delete('token');
        window.history.replaceState({}, '', url.pathname + url.search);
      }

      // 2. Check sessionStorage
      const token = getAuthToken();
      if (!token) {
        setStatus('denied');
        return;
      }

      // 3. Validate via /api/client/me
      try {
        const API_BASE = process.env.NEXT_PUBLIC_API_URL || '';
        const res = await fetch(`${API_BASE}/api/client/me`, {
          headers: { 'X-Client-Token': token },
        });

        if (!res.ok) {
          clearAuthToken();
          setStatus('denied');
          return;
        }

        // Token is valid — also populate auth store
        await initialize();
        setStatus('authenticated');
      } catch {
        clearAuthToken();
        setStatus('denied');
      }
    }

    check();
  }, [searchParams, initialize]);

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
            This dashboard is available to authorized beta clients only.
            If you believe you should have access, please contact the Aethermind team.
          </p>
          <a
            href="mailto:support@aethermind.io"
            className="inline-flex items-center justify-center rounded-md bg-primary px-6 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            Contact Aethermind for Access
          </a>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

export function AuthGuard({ children }: { children: React.ReactNode }) {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-background">
          <div className="text-center">
            <div className="inline-block h-12 w-12 animate-spin rounded-full border-4 border-solid border-primary border-r-transparent mb-4" />
            <p className="text-muted-foreground">Loading...</p>
          </div>
        </div>
      }
    >
      <AuthGuardInner>{children}</AuthGuardInner>
    </Suspense>
  );
}
