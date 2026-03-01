'use client';

import { useEffect, useState } from 'react';
import { getAuthToken, clearAuthToken } from '@/lib/auth-utils';
import { useAuthStore } from '@/store/useAuthStore';
import { API_URL } from '@/lib/config';

/**
 * Authentication Guard — B2B Beta
 *
 * Token capture happens in app/page.tsx (root page).
 * By the time AuthGuard mounts the token is already in localStorage.
 *
 * This guard:
 *  1. Reads localStorage for client_token
 *  2. If found → validates via GET /api/client/me
 *  3. If valid → populates auth store, renders children
 *  4. If missing or invalid → shows "Contact Aethermind" screen
 */
export function AuthGuard({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<'loading' | 'authenticated' | 'denied'>('loading');
  const initialize = useAuthStore((s) => s.initialize);

  useEffect(() => {
    async function check() {
      // Diagnostic: dump localStorage state at mount time
      console.log('[AuthGuard] Mounting — reading localStorage...');
      const allKeys = Object.keys(localStorage);
      console.log('[AuthGuard] localStorage keys:', allKeys);
      console.log('[AuthGuard] Raw client_token value:', localStorage.getItem('client_token'));

      const token = getAuthToken();
      console.log('[AuthGuard] getAuthToken() returned:', token ? `${token.slice(0, 8)}…` : 'null');

      if (!token) {
        console.warn('[AuthGuard] No token found — setting status to denied');
        setStatus('denied');
        return;
      }

      try {
        console.log('[AuthGuard] Calling /api/client/me with API_URL:', API_URL);
        const res = await fetch(`${API_URL}/api/client/me`, {
          headers: { 'X-Client-Token': token },
        });

        console.log('[AuthGuard] /api/client/me response status:', res.status);

        if (!res.ok) {
          clearAuthToken();
          setStatus('denied');
          return;
        }

        await initialize();
        setStatus('authenticated');
      } catch (err) {
        console.error('[AuthGuard] /api/client/me fetch error:', err);
        clearAuthToken();
        setStatus('denied');
      }
    }

    check();
  }, [initialize]);

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
