'use client';

import { useState } from 'react';
import Link from 'next/link';
import { authAPI } from '@/lib/api/auth';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await authAPI.forgotPassword(email);
      setSuccess(true);
    } catch (err: unknown) {
      if (err instanceof Error) {
        // Check for 404 (endpoint not implemented)
        const apiError = err as { statusCode?: number };
        if (apiError.statusCode === 404) {
          setError('La función de restablecimiento de contraseña estará disponible pronto. Por favor contacta a support@aethermind.com para asistencia.');
        } else {
          setError(err.message);
        }
      } else {
        setError('Ocurrió un error. Intenta nuevamente.');
      }
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black px-4">
        <div className="max-w-md w-full text-center space-y-6 bg-zinc-900 p-8 rounded-2xl border border-zinc-800">
          <div className="w-16 h-16 bg-green-500/10 rounded-full flex items-center justify-center mx-auto">
            <svg className="w-8 h-8 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>

          <h1 className="text-2xl font-bold text-white">Revisa tu email</h1>
          <p className="text-zinc-400">
            Hemos enviado instrucciones para restablecer tu contraseña a <span className="text-white">{email}</span>
          </p>
          <p className="text-zinc-500 text-sm">
            ¿No recibiste el email? Revisa tu carpeta de spam o intenta nuevamente.
          </p>

          <div className="pt-4 space-y-3">
            <Link
              href="/login"
              className="block w-full bg-white text-black py-3 px-4 rounded-lg font-medium hover:bg-zinc-200 transition-colors text-center"
            >
              Volver al inicio de sesión
            </Link>
            <button
              onClick={() => {
                setSuccess(false);
                setEmail('');
              }}
              className="block w-full bg-zinc-800 border border-zinc-700 text-white py-3 px-4 rounded-lg hover:bg-zinc-700 transition-colors"
            >
              Intentar con otro email
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-black px-4">
      <div className="max-w-md w-full space-y-8 bg-zinc-900 p-8 rounded-2xl border border-zinc-800">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-white">AETHERMIND</h1>
          <p className="mt-2 text-zinc-400">Restablecer contraseña</p>
        </div>

        <div className="bg-zinc-800/50 border border-zinc-700 rounded-lg p-4">
          <p className="text-zinc-300 text-sm">
            Ingresa tu dirección de email y te enviaremos instrucciones para restablecer tu contraseña.
          </p>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/50 text-red-500 px-4 py-3 rounded-lg text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-zinc-300">
              Dirección de email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 block w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-white focus:border-transparent"
              placeholder="tu@ejemplo.com"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-white text-black py-3 px-4 rounded-lg font-medium hover:bg-zinc-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Enviando...' : 'Enviar instrucciones'}
          </button>
        </form>

        <div className="text-center">
          <Link href="/login" className="text-sm text-zinc-400 hover:text-white transition-colors">
            ← Volver al inicio de sesión
          </Link>
        </div>

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-zinc-800"></div>
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-2 bg-zinc-900 text-zinc-500">¿Necesitas ayuda?</span>
          </div>
        </div>

        <div className="text-center">
          <p className="text-sm text-zinc-400">
            ¿No tienes cuenta?{' '}
            <Link href="/signup" className="text-white hover:underline font-medium">
              Regístrate
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
