'use client';

// ─── Previous version (server component, simple redirect) ───
// import { redirect } from "next/navigation"
// export default function Home() { redirect("/home") }

import { Suspense, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { setAuthToken } from '@/lib/auth-utils';

function TokenCapture() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const token = searchParams.get('token');
    if (token) {
      setAuthToken(token);
    }
    router.replace('/home');
  }, [router, searchParams]);

  return null;
}

/**
 * Root page — captures ?token= from URL, stores in sessionStorage,
 * then redirects to /home.
 */
export default function RootPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center">
        <div className="inline-block h-12 w-12 animate-spin rounded-full border-4 border-solid border-primary border-r-transparent mb-4" />
        <p className="text-muted-foreground">Loading...</p>
      </div>
      <Suspense>
        <TokenCapture />
      </Suspense>
    </div>
  );
}
