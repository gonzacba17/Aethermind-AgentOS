'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { isAuthenticated } from '@/lib/auth-utils';

/**
 * Authentication Guard Component
 * 
 * Protects routes by checking for authentication token.
 * Redirects to landing page if user is not authenticated.
 */
export function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    // Don't check auth on the OAuth callback page
    if (pathname === '/auth/callback') {
      setIsChecking(false);
      return;
    }

    // Check if user is authenticated
    const authenticated = isAuthenticated();

    if (!authenticated) {
      console.log('[AuthGuard] No token found - redirecting to landing page');
      // Redirect to landing page
      window.location.href = 'https://aethermind-page.vercel.app';
      return;
    }

    console.log('[AuthGuard] User authenticated - allowing access');
    setIsChecking(false);
  }, [pathname, router]);

  // Show loading state while checking auth
  if (isChecking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="inline-block h-12 w-12 animate-spin rounded-full border-4 border-solid border-primary border-r-transparent mb-4"></div>
          <p className="text-muted-foreground">Verifying authentication...</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
