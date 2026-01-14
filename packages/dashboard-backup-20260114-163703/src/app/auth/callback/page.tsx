'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { setAuthToken, clearAuthToken } from '@/lib/auth-utils';
import { LANDING_PAGE_URL } from '@/lib/config';

/**
 * OAuth Callback Page
 * 
 * Handles the OAuth redirect from backend after successful Google/GitHub login.
 * Extracts JWT token from URL, stores it, validates it, and redirects to dashboard.
 */

// Loading fallback for Suspense
function LoadingFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="max-w-md w-full mx-4">
        <div className="bg-card border border-border rounded-lg shadow-lg p-8">
          <div className="text-center">
            <div className="mb-4">
              <div className="inline-block h-12 w-12 animate-spin rounded-full border-4 border-solid border-primary border-r-transparent"></div>
            </div>
            <h1 className="text-2xl font-bold mb-2">Loading...</h1>
            <p className="text-muted-foreground">
              Please wait...
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// Component that uses useSearchParams - must be wrapped in Suspense
function AuthCallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState<string>('');

  useEffect(() => {
    async function handleCallback() {
      try {
        // Extract token from URL query parameter
        const token = searchParams.get('token');
        const error = searchParams.get('error');
        const errorMsg = searchParams.get('message');

        // Handle OAuth error
        if (error) {
          console.error('[Auth Callback] OAuth error:', error, errorMsg);
          setStatus('error');
          setErrorMessage(errorMsg || 'Authentication failed. Please try again.');
          
          // Clear any existing token
          clearAuthToken();
          
          // Redirect to landing page after 3 seconds
          setTimeout(() => {
            window.location.href = LANDING_PAGE_URL;
          }, 3000);
          return;
        }

        // Validate token exists
        if (!token) {
          console.error('[Auth Callback] No token found in URL');
          setStatus('error');
          setErrorMessage('No authentication token received. Please try logging in again.');
          
          // Redirect to landing page after 3 seconds
          setTimeout(() => {
            window.location.href = LANDING_PAGE_URL;
          }, 3000);
          return;
        }

        console.log('[Auth Callback] Token received, storing...');
        
        // Store token in localStorage
        setAuthToken(token);

        // Validate token by calling /auth/me endpoint
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || '';
        const response = await fetch(`${apiUrl}/api/auth/me`, {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          throw new Error('Token validation failed');
        }

        const userData = await response.json();
        console.log('[Auth Callback] Token validated successfully. User:', userData.email);

        setStatus('success');

        // Redirect to dashboard home after brief delay
        setTimeout(() => {
          router.push('/');
        }, 1500);

      } catch (error) {
        console.error('[Auth Callback] Error during authentication:', error);
        setStatus('error');
        setErrorMessage('Failed to validate authentication. Please try logging in again.');
        
        // Clear invalid token
        clearAuthToken();
        
        // Redirect to landing page after 3 seconds
        setTimeout(() => {
          window.location.href = LANDING_PAGE_URL;
        }, 3000);
      }
    }

    handleCallback();
  }, [searchParams, router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="max-w-md w-full mx-4">
        <div className="bg-card border border-border rounded-lg shadow-lg p-8">
          {status === 'loading' && (
            <div className="text-center">
              <div className="mb-4">
                <div className="inline-block h-12 w-12 animate-spin rounded-full border-4 border-solid border-primary border-r-transparent"></div>
              </div>
              <h1 className="text-2xl font-bold mb-2">Authenticating...</h1>
              <p className="text-muted-foreground">
                Please wait while we log you in.
              </p>
            </div>
          )}

          {status === 'success' && (
            <div className="text-center">
              <div className="mb-4">
                <svg
                  className="mx-auto h-12 w-12 text-green-500"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              </div>
              <h1 className="text-2xl font-bold mb-2 text-green-600">Success!</h1>
              <p className="text-muted-foreground">
                You&apos;ve been authenticated successfully. Redirecting to dashboard...
              </p>
            </div>
          )}

          {status === 'error' && (
            <div className="text-center">
              <div className="mb-4">
                <svg
                  className="mx-auto h-12 w-12 text-red-500"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </div>
              <h1 className="text-2xl font-bold mb-2 text-red-600">Authentication Failed</h1>
              <p className="text-muted-foreground mb-4">
                {errorMessage}
              </p>
              <p className="text-sm text-muted-foreground">
                Redirecting to login page...
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Main page component
export default function AuthCallbackPage() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <AuthCallbackContent />
    </Suspense>
  );
}
