'use client';

/**
 * Root page — captures ?token= or ?session= from URL, persists to
 * localStorage, then redirects to /home where AuthGuard reads it back.
 *
 * - ?token=  → client access token (B2B), stored directly
 * - ?session= → temp session ID, exchanged via POST /api/auth/session for
 *               user data + client token
 *
 * We deliberately use window.location (not Next router) to parse the
 * query string because useSearchParams() requires a Suspense boundary
 * and can introduce timing issues with the redirect.
 */

import { useEffect } from 'react';
import { setAuthToken } from '@/lib/auth-utils';
import { API_URL } from '@/lib/config';

export default function RootPage() {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    const session = params.get('session');

    console.log('[RootPage] URL search params:', window.location.search);
    console.log('[RootPage] Token from URL:', token ? `${token.slice(0, 8)}…` : 'null');
    console.log('[RootPage] Session from URL:', session ? `${session.slice(0, 8)}…` : 'null');

    if (token) {
      // Direct client token — persist and redirect
      setAuthToken(token);
      console.log('[RootPage] Client token persisted, navigating to /home');
      window.location.href = '/home';
      return;
    }

    if (session) {
      // Session ID — exchange for client token via API
      (async () => {
        try {
          const res = await fetch(`${API_URL}/api/auth/session`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sessionId: session }),
          });

          if (res.ok) {
            const data = await res.json();
            if (data.clientAccessToken) {
              setAuthToken(data.clientAccessToken);
              console.log('[RootPage] Session exchanged for client token, navigating to /home');
            } else {
              console.warn('[RootPage] Session response missing clientAccessToken');
            }
          } else {
            console.error('[RootPage] Session exchange failed:', res.status);
          }
        } catch (err) {
          console.error('[RootPage] Session exchange error:', err);
        }
        window.location.href = '/home';
      })();
      return;
    }

    // No token or session — navigate to /home, AuthGuard will handle
    console.warn('[RootPage] No token or session in URL — navigating to /home');
    window.location.href = '/home';
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center">
        <div className="inline-block h-12 w-12 animate-spin rounded-full border-4 border-solid border-primary border-r-transparent mb-4" />
        <p className="text-muted-foreground">Loading...</p>
      </div>
    </div>
  );
}
