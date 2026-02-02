'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import Link from 'next/link';
import { authAPI } from '@/lib/api/auth';
import { resetPasswordSchema, type ResetPasswordFormData } from '@/lib/validations/auth';

type PageState = 'loading' | 'form' | 'success' | 'token-error';

function ResetPasswordForm() {
  const [pageState, setPageState] = useState<PageState>('loading');
  const [error, setError] = useState('');
  const [token, setToken] = useState<string | null>(null);
  const searchParams = useSearchParams();
  const router = useRouter();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ResetPasswordFormData>({
    resolver: zodResolver(resetPasswordSchema),
  });

  // Validate token on mount
  useEffect(() => {
    const tokenParam = searchParams.get('token');

    if (!tokenParam) {
      setPageState('token-error');
      setError('No se proporcionó un token de restablecimiento. Por favor solicita un nuevo enlace.');
      return;
    }

    setToken(tokenParam);
    setPageState('form');
  }, [searchParams]);

  const onSubmit = async (data: ResetPasswordFormData) => {
    if (!token) return;

    setError('');

    try {
      await authAPI.resetPassword(token, data.password);
      setPageState('success');

      // Redirect to login after 3 seconds
      setTimeout(() => {
        router.push('/login?reset=success');
      }, 3000);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error al restablecer la contraseña';

      // Check if it's a token error
      if (message.toLowerCase().includes('token') ||
          message.toLowerCase().includes('expired') ||
          message.toLowerCase().includes('invalid')) {
        setPageState('token-error');
        setError('El enlace ha expirado o no es válido. Por favor solicita uno nuevo.');
      } else {
        setError(message);
      }
    }
  };

  // Loading state
  if (pageState === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-white mb-4"></div>
          <p className="text-white">Verificando enlace...</p>
        </div>
      </div>
    );
  }

  // Token error state
  if (pageState === 'token-error') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black px-4">
        <div className="max-w-md w-full text-center space-y-6 bg-zinc-900 p-8 rounded-2xl border border-zinc-800">
          <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto">
            <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>

          <h1 className="text-2xl font-bold text-white">Enlace no válido</h1>
          <p className="text-zinc-400">{error}</p>

          <div className="pt-4 space-y-3">
            <Link
              href="/forgot-password"
              className="block w-full bg-white text-black py-3 px-4 rounded-lg font-medium hover:bg-zinc-200 transition-colors text-center"
            >
              Solicitar nuevo enlace
            </Link>
            <Link
              href="/login"
              className="block w-full bg-zinc-800 border border-zinc-700 text-white py-3 px-4 rounded-lg hover:bg-zinc-700 transition-colors text-center"
            >
              Volver al inicio de sesión
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Success state
  if (pageState === 'success') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black px-4">
        <div className="max-w-md w-full text-center space-y-6 bg-zinc-900 p-8 rounded-2xl border border-zinc-800">
          <div className="w-16 h-16 bg-green-500/10 rounded-full flex items-center justify-center mx-auto">
            <svg className="w-8 h-8 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>

          <h1 className="text-2xl font-bold text-white">Contraseña actualizada</h1>
          <p className="text-zinc-400">
            Tu contraseña ha sido restablecida exitosamente. Serás redirigido al inicio de sesión.
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

  // Form state
  return (
    <div className="min-h-screen flex items-center justify-center bg-black px-4">
      <div className="max-w-md w-full space-y-8 bg-zinc-900 p-8 rounded-2xl border border-zinc-800">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-white">AETHERMIND</h1>
          <p className="mt-2 text-zinc-400">Restablecer contraseña</p>
        </div>

        <div className="bg-zinc-800/50 border border-zinc-700 rounded-lg p-4">
          <p className="text-zinc-300 text-sm">
            Ingresa tu nueva contraseña. Debe tener al menos 8 caracteres, una mayúscula, una minúscula y un número.
          </p>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/50 text-red-500 px-4 py-3 rounded-lg text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-zinc-300">
              Nueva contraseña
            </label>
            <input
              id="password"
              type="password"
              {...register('password')}
              className="mt-1 block w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-white focus:border-transparent"
              placeholder="••••••••"
            />
            {errors.password && (
              <p className="mt-1 text-sm text-red-400">{errors.password.message}</p>
            )}
          </div>

          <div>
            <label htmlFor="confirmPassword" className="block text-sm font-medium text-zinc-300">
              Confirmar contraseña
            </label>
            <input
              id="confirmPassword"
              type="password"
              {...register('confirmPassword')}
              className="mt-1 block w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-white focus:border-transparent"
              placeholder="••••••••"
            />
            {errors.confirmPassword && (
              <p className="mt-1 text-sm text-red-400">{errors.confirmPassword.message}</p>
            )}
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-white text-black py-3 px-4 rounded-lg font-medium hover:bg-zinc-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? 'Restableciendo...' : 'Restablecer contraseña'}
          </button>
        </form>

        <div className="text-center">
          <Link href="/login" className="text-sm text-zinc-400 hover:text-white transition-colors">
            ← Volver al inicio de sesión
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-black">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-white mb-4"></div>
          <p className="text-white">Cargando...</p>
        </div>
      </div>
    }>
      <ResetPasswordForm />
    </Suspense>
  );
}
