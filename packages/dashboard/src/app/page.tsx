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

    if (token) {
      // 2. Persist to sessionStorage (synchronous)
      setAuthToken(token);
      console.log('[RootPage] Token captured and saved to sessionStorage');
    }

    // 3. Navigate to /home — AuthGuard there will read sessionStorage
    //    Using window.location.replace guarantees sessionStorage is
    //    committed before the navigation starts (same-origin, same tab).
    window.location.replace('/home');
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
