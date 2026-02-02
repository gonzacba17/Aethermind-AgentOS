'use client';

import { Suspense, useEffect, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { saveToken } from '@/lib/auth-utils';
import { redirectAfterAuth } from '@/lib/auth-utils';

function CallbackContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const hasProcessed = useRef(false);

  useEffect(() => {
    // Prevent multiple executions in React StrictMode or fast navigation
    if (hasProcessed.current) return;
    hasProcessed.current = true;

    const processCallback = async () => {
      const token = searchParams.get('token');
      const error = searchParams.get('error');

      console.log('[OAuth Callback] Processing callback', {
        token: token ? 'RECEIVED' : 'MISSING',
        error,
        url: window.location.href
      });

      if (error) {
        // OAuth failed, redirect to login with error
        console.error('[OAuth Callback] OAuth error:', error);
        router.push(`/login?error=${error}`);
        return;
      }

      if (token) {
        // Verificar que el token tenga un formato válido (JWT tiene 3 partes separadas por .)
        const tokenParts = token.split('.');
        if (tokenParts.length !== 3) {
          console.error('[OAuth Callback] Invalid token format, expected JWT');
          router.push('/login?error=invalid_token');
          return;
        }

        // Save token with rememberMe=true for OAuth logins (persistent storage)
        console.log('[OAuth Callback] Saving token to localStorage');
        saveToken(token, true);

        // Pequeño delay para asegurar que el token se guardó antes de redirigir
        await new Promise(resolve => setTimeout(resolve, 100));

        console.log('[OAuth Callback] Calling redirectAfterAuth');
        redirectAfterAuth();
      } else {
        // No token, go back to login
        console.error('[OAuth Callback] No token received, redirecting to login');
        router.push('/login');
      }
    };

    processCallback();
  }, [searchParams, router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-black">
      <div className="text-center">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-white mb-4"></div>
        <h2 className="text-white text-xl font-medium">Authenticating...</h2>
        <p className="text-zinc-400 mt-2">Please wait while we log you in</p>
      </div>
    </div>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-black">
        <div className="text-white">Loading...</div>
      </div>
    }>
      <CallbackContent />
    </Suspense>
  );
}
