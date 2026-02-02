'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { authAPI } from '@/lib/api/auth';

type PageState = 'loading' | 'success' | 'error' | 'no-token';

function VerifyEmailContent() {
  const [pageState, setPageState] = useState<PageState>('loading');
  const [error, setError] = useState('');
  const searchParams = useSearchParams();

  useEffect(() => {
    const token = searchParams.get('token');

    if (!token) {
      setPageState('no-token');
      return;
    }

    async function verifyToken() {
      try {
        await authAPI.verifyEmail(token!);
        setPageState('success');
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Error al verificar el email';
        setError(message);
        setPageState('error');
      }
    }

    verifyToken();
  }, [searchParams]);

  // Loading state
  if (pageState === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-white mb-4"></div>
          <p className="text-white">Verificando tu email...</p>
        </div>
      </div>
    );
  }

  // No token state
  if (pageState === 'no-token') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black px-4">
        <div className="max-w-md w-full text-center space-y-6 bg-zinc-900 p-8 rounded-2xl border border-zinc-800">
          <div className="w-16 h-16 bg-blue-500/10 rounded-full flex items-center justify-center mx-auto">
            <svg className="w-8 h-8 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>

          <h1 className="text-2xl font-bold text-white">Revisa tu email</h1>
          <p className="text-zinc-400">
            Te hemos enviado un enlace de verificación para confirmar tu dirección de email.
          </p>

          <Link href="/login" className="inline-block text-white hover:underline">
            Volver al inicio de sesión
          </Link>
        </div>
      </div>
    );
  }

  // Error state
  if (pageState === 'error') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black px-4">
        <div className="max-w-md w-full text-center space-y-6 bg-zinc-900 p-8 rounded-2xl border border-zinc-800">
          <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto">
            <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>

          <h1 className="text-2xl font-bold text-white">Error de verificación</h1>
          <p className="text-zinc-400">
            {error || 'El enlace de verificación ha expirado o no es válido.'}
          </p>

          <div className="pt-4 space-y-3">
            <Link
              href="/login"
              className="block w-full bg-white text-black py-3 px-4 rounded-lg font-medium hover:bg-zinc-200 transition-colors text-center"
            >
              Ir al inicio de sesión
            </Link>
            <p className="text-zinc-500 text-sm">
              Si el problema persiste, contacta a soporte.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Success state
  return (
    <div className="min-h-screen flex items-center justify-center bg-black px-4">
      <div className="max-w-md w-full text-center space-y-6 bg-zinc-900 p-8 rounded-2xl border border-zinc-800">
        <div className="w-16 h-16 bg-green-500/10 rounded-full flex items-center justify-center mx-auto">
          <svg className="w-8 h-8 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>

        <h1 className="text-2xl font-bold text-white">Email verificado</h1>
        <p className="text-zinc-400">
          Tu dirección de email ha sido verificada exitosamente. Ya puedes iniciar sesión.
        </p>

        <div className="pt-4">
          <Link
            href="/login"
            className="block w-full bg-white text-black py-3 px-4 rounded-lg font-medium hover:bg-zinc-200 transition-colors text-center"
          >
            Ir al inicio de sesión
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-black">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-white mb-4"></div>
          <p className="text-white">Cargando...</p>
        </div>
      </div>
    }>
      <VerifyEmailContent />
    </Suspense>
  );
}
