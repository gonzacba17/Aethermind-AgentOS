'use client';

/**
 * Root page — captures ?token= from URL, persists to sessionStorage,
 * then redirects to /home where AuthGuard reads it back.
 *
 * We deliberately use window.location (not Next router) to parse the
 * query string because useSearchParams() requires a Suspense boundary
 * and can introduce timing issues with the redirect. A plain
 * URLSearchParams on window.location.search is synchronous and
 * guaranteed to run before we navigate away.
 */

import { useEffect } from 'react';
import { setAuthToken } from '@/lib/auth-utils';

export default function RootPage() {
  useEffect(() => {
    // 1. Read token directly from the browser URL (synchronous, no hooks)
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');

    console.log('[RootPage] URL search params:', window.location.search);
    console.log('[RootPage] Token from URL:', token ? `${token.slice(0, 8)}…` : 'null');

    if (token) {
      // 2. Persist to sessionStorage (synchronous)
      setAuthToken(token);

      // 3. Verify the value actually persisted
      const verification = sessionStorage.getItem('client_token');
      console.log('[RootPage] Verification read from sessionStorage:', verification ? `${verification.slice(0, 8)}…` : 'null');
      console.log('[RootPage] Token persisted successfully:', !!verification);
    } else {
      console.warn('[RootPage] No token found in URL — navigating to /home without token');
    }

    // 4. Navigate to /home — AuthGuard there will read sessionStorage
    //    Using href instead of replace() to test if replace() was racing
    //    against sessionStorage persistence.
    console.log('[RootPage] Navigating to /home via window.location.href...');
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
