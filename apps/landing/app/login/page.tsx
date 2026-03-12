'use client'
import { useState, useEffect, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import Link from 'next/link'
import { authAPI } from '@/lib/api/auth'
import { redirectAfterAuth, removeToken, removeClientToken, buildDashboardUrl, getClientToken } from '@/lib/auth-utils'
import { loginSchema, type LoginFormData } from '@/lib/validations/auth'
import { useAuth } from '@/hooks/useAuth'
import { config } from '@/lib/config'

function LoginForm() {
  const [error, setError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const searchParams = useSearchParams()
  const router = useRouter()
  const { isAuthenticated, isLoading } = useAuth()

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  })

  // Redirect authenticated users to dashboard (skip if just logged out)
  useEffect(() => {
    if (searchParams.get('logout') === 'true') return;
    if (!isLoading && isAuthenticated) {
      const clientToken = getClientToken();
      if (clientToken) {
        buildDashboardUrl().then((url) => { window.location.href = url; });
      }
    }
  }, [isLoading, isAuthenticated, searchParams]);

  // Handle ?logout=true — clear all auth state from landing
  useEffect(() => {
    if (searchParams.get('logout') === 'true') {
      removeToken();
      removeClientToken();
      localStorage.removeItem('user');
      const url = new URL(window.location.href);
      url.searchParams.delete('logout');
      window.history.replaceState({}, '', url.toString());
    }
  }, [searchParams]);

  useEffect(() => {
    if (searchParams.get('registered') === 'true') {
      setSuccessMessage('Account created successfully! Please sign in.');
    }
    const authError = searchParams.get('error');
    if (authError) {
      if (authError === 'session_expired') {
        setError('Your session expired. Please sign in again.');
      } else if (authError === 'invalid_token') {
        setError('Authentication error. Please try signing in again.');
      } else {
        setError('Authentication failed. Please try again.');
      }
    }
  }, [searchParams]);

  const onSubmit = async (data: LoginFormData) => {
    setError('')
    try {
      const response = await authAPI.login(data, false)
      const returnTo = searchParams.get('returnTo');
      if (returnTo && returnTo.startsWith('/')) {
        window.location.href = returnTo;
      } else if (response.clientAccessToken) {
        const dashUrl = await buildDashboardUrl();
        window.location.href = dashUrl;
      } else {
        await redirectAfterAuth(response.user)
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black">
        <div className="font-mono text-xs text-white/40 animate-pulse">loading...</div>
      </div>
    );
  }

  if (isAuthenticated) {
    return null;
  }

  return (
    <div className="min-h-screen flex bg-black">
      {/* Left panel — branding */}
      <div className="hidden lg:flex lg:w-[40%] flex-col justify-center px-16 border-r border-white/[0.06]">
        <h1 className="font-mono text-sm tracking-[0.2em] text-white mb-6">AETHERMIND</h1>
        <p className="text-lg font-light text-white/40 mb-12 leading-relaxed">
          The AI Gateway built for<br />multi-agent systems.
        </p>
        <div className="space-y-4 font-mono text-xs text-white/20">
          <p>// agent-level tracing</p>
          <p>// byok — your keys</p>
          <p>// drop-in openai replacement</p>
        </div>
      </div>

      {/* Right panel — form */}
      <div className="flex-1 flex items-center justify-center px-6 bg-[#0a0a0a]">
        <div className="w-full max-w-md space-y-8">
          {/* Mobile logo */}
          <div className="lg:hidden mb-8">
            <h1 className="font-mono text-sm tracking-[0.2em] text-white">AETHERMIND</h1>
          </div>

          <div>
            <h2 className="text-2xl font-light text-white mb-2">Welcome back.</h2>
            <p className="text-sm text-white/40">Sign in to your dashboard.</p>
          </div>

          {successMessage && (
            <div className="border border-green-500/30 text-green-400 px-4 py-3 text-sm flex items-center gap-2">
              <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 13l4 4L19 7" />
              </svg>
              <span>{successMessage}</span>
            </div>
          )}

          {error && (
            <div className="border border-[#ff4444]/30 text-[#ff4444] px-4 py-3 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <div>
              <label htmlFor="email" className="block font-mono text-xs text-white/40 mb-2">
                email
              </label>
              <input
                id="email"
                type="email"
                {...register('email')}
                className="block w-full px-4 py-3 bg-black border border-white/[0.1] text-white text-sm placeholder-white/20 focus:outline-none focus:border-white/30 transition-colors"
                placeholder="you@example.com"
              />
              {errors.email && (
                <p className="mt-1 text-xs text-[#ff4444]">{errors.email.message}</p>
              )}
            </div>

            <div>
              <label htmlFor="password" className="block font-mono text-xs text-white/40 mb-2">
                password
              </label>
              <input
                id="password"
                type="password"
                {...register('password')}
                className="block w-full px-4 py-3 bg-black border border-white/[0.1] text-white text-sm placeholder-white/20 focus:outline-none focus:border-white/30 transition-colors"
                placeholder="••••••••"
              />
              {errors.password && (
                <p className="mt-1 text-xs text-[#ff4444]">{errors.password.message}</p>
              )}
            </div>

            <div className="flex justify-end">
              <Link href="/forgot-password" className="font-mono text-xs text-white/40 hover:text-white transition-colors">
                forgot password?
              </Link>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full font-mono text-sm bg-white text-black py-3 hover:bg-white/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'signing in...' : 'sign_in()'}
            </button>
          </form>

          <div className="text-center text-sm">
            <span className="text-white/40">Don&apos;t have an account?</span>{' '}
            <Link href="/signup" className="font-mono text-xs text-white hover:text-white/70 transition-colors">
              start_free()
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-black">
        <div className="font-mono text-xs text-white/40 animate-pulse">loading...</div>
      </div>
    }>
      <LoginForm />
    </Suspense>
  )
}
