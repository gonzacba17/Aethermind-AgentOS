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
    const code = params.get('code');
    const token = params.get('token'); // legacy support
    const session = params.get('session');

    // Preferred: one-time exchange code (ct_* never in URL)
    if (code) {
      (async () => {
        try {
          const res = await fetch(`${API_URL}/api/auth/exchange`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code }),
          });

          if (res.ok) {
            const data = await res.json();
            if (data.clientAccessToken) {
              setAuthToken(data.clientAccessToken);
            }
          }
        } catch {
          // Exchange failed — user will land on /home unauthenticated
        }
        window.location.href = '/home';
      })();
      return;
    }

    // Legacy: direct token in URL (backwards compat, will be removed)
    if (token) {
      setAuthToken(token);
      window.location.href = '/home';
      return;
    }

    if (session) {
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
            }
          }
        } catch {
          // Session exchange failed
        }
        window.location.href = '/home';
      })();
      return;
    }

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
