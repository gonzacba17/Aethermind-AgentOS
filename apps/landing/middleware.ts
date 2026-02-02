import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Rutas que requieren autenticación
const protectedPaths = ['/dashboard'];

// Rutas que requieren NO estar autenticado (login, signup)
const authPaths = ['/login', '/signup'];

export function middleware(request: NextRequest) {
  const token = request.cookies.get('token')?.value;
  const { pathname, origin } = new URL(request.url);

  console.log('[Middleware] Processing:', { pathname, hasToken: !!token });

  // Proteger rutas del dashboard
  const isProtectedPath = protectedPaths.some(path => pathname.startsWith(path));
  if (isProtectedPath && !token) {
    console.log('[Middleware] Protected route without token, redirecting to login');
    const loginUrl = new URL('/login', origin);
    loginUrl.searchParams.set('returnTo', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Redirigir usuarios autenticados fuera de login/signup
  const isAuthPath = authPaths.some(path => pathname.startsWith(path));
  if (isAuthPath && token) {
    console.log('[Middleware] Auth route with token, redirecting to dashboard');
    
    // Check if there's a returnTo parameter
    const url = new URL(request.url);
    const returnTo = url.searchParams.get('returnTo');
    
    if (returnTo && returnTo.startsWith('/')) {
      return NextResponse.redirect(new URL(returnTo, origin));
    }
    
    // Default redirect to dashboard
    const dashboardUrl = process.env.NEXT_PUBLIC_DASHBOARD_URL || 'https://aethermind-agent-os-dashboard.vercel.app';
    return NextResponse.redirect(new URL(dashboardUrl));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/dashboard/:path*', '/login', '/signup'],
};
