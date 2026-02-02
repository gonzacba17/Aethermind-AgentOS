import { User } from './api/auth';
import { config } from './config';

/**
 * Save authentication token to storage
 * @param token JWT token from backend
 * @param rememberMe Whether to use persistent storage (localStorage) or session storage
 */
export function saveToken(token: string, rememberMe = false) {
  if (typeof window === 'undefined') return;

  if (rememberMe) {
    // Persistent storage - survives browser close
    localStorage.setItem('token', token);
    localStorage.setItem('rememberMe', 'true');
  } else {
    // Session storage - cleared when browser closes
    sessionStorage.setItem('token', token);
    localStorage.removeItem('rememberMe');
  }

  // CRITICAL: Save token in cookie for middleware access
  // Cookie is HttpOnly-like (can't be set as httpOnly from client, but SameSite=Strict provides CSRF protection)
  const maxAge = rememberMe ? 30 * 24 * 60 * 60 : undefined; // 30 days for rememberMe, session otherwise
  const cookieString = [
    `token=${token}`,
    'path=/',
    'SameSite=Strict',
    window.location.protocol === 'https:' ? 'Secure' : '',
    maxAge ? `max-age=${maxAge}` : '',
  ].filter(Boolean).join('; ');
  
  document.cookie = cookieString;
  console.log('[saveToken] Token saved to cookie:', { rememberMe, maxAge });
}

/**
 * Get authentication token from storage
 * Checks both localStorage (persistent) and sessionStorage
 */
export function getToken(): string | null {
  if (typeof window === 'undefined') return null;

  // Check if user had "remember me" enabled
  const rememberMe = localStorage.getItem('rememberMe') === 'true';

  if (rememberMe) {
    return localStorage.getItem('token');
  } else {
    // Check session storage first, fallback to localStorage
    return sessionStorage.getItem('token') || localStorage.getItem('token');
  }
}

/**
 * Remove authentication token from all storage
 */
export function removeToken() {
  if (typeof window === 'undefined') return;

  localStorage.removeItem('token');
  localStorage.removeItem('rememberMe');
  sessionStorage.removeItem('token');
  
  // CRITICAL: Clear cookie as well
  document.cookie = 'token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Strict';
  console.log('[removeToken] Token removed from all storage including cookies');
}

/**
 * Check if Remember Me is enabled
 */
export function isRememberMeEnabled(): boolean {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem('rememberMe') === 'true';
}

/**
 * Get subscription status with smart logic for trials and expiration
 * @param user User object from backend
 * @returns Subscription status
 */
export function getSubscriptionStatus(user?: User): 'active' | 'trialing' | 'past_due' | 'canceled' | 'none' {
  if (!user || !user.subscription) return 'none';
  
  const status = user.subscription.status;
  
  // Handle trialing status with expiration check
  if (status === 'trialing') {
    if (user.subscription.trial_end) {
      const trialEnd = new Date(user.subscription.trial_end);
      const now = new Date();
      if (now > trialEnd) {
        return 'past_due'; // Trial expired
      }
    }
    return 'trialing';
  }
  
  // Handle other statuses
  if (status === 'active') return 'active';
  if (status === 'past_due') return 'past_due';
  if (status === 'canceled') return 'canceled';
  
  return 'none';
}

/**
 * Redirect user after successful authentication
 * Smart redirect based on membership status and onboarding completion
 * @param user Optional user object to check membership
 */
export async function redirectAfterAuth(user?: User) {
  if (typeof window === 'undefined') return;

  console.log('[redirectAfterAuth] Starting redirect logic', { user });

  // Check if user has completed technical onboarding
  const hasCompletedTechnicalOnboarding = localStorage.getItem('onboarding_technical_complete') === 'true';
  const hasSeenMarketingOnboarding = localStorage.getItem('onboarding_marketing_seen') === 'true';

  // Check if user just completed onboarding payment selection
  const onboardingPaymentRaw = localStorage.getItem('onboarding_payment');
  if (onboardingPaymentRaw) {
    try {
      const onboardingData = JSON.parse(onboardingPaymentRaw);
      const fiveMinutesInMs = 5 * 60 * 1000; // 5 minutes
      const isRecent = (Date.now() - onboardingData.timestamp) < fiveMinutesInMs;

      if (onboardingData.completed && isRecent) {
        console.log('[redirectAfterAuth] Recent onboarding payment detected');
        console.log('[redirectAfterAuth] Selected plan:', onboardingData.selectedPlan);

        // Check if technical onboarding is complete
        if (!hasCompletedTechnicalOnboarding) {
          console.log('[redirectAfterAuth] Redirecting to technical setup');
          window.location.href = '/onboarding/setup';
          return;
        }

        // Clear the flag to prevent permanent bypass
        localStorage.removeItem('onboarding_payment');

        // Redirect to complete page for secure dashboard redirect
        console.log('[redirectAfterAuth] Redirecting to complete page');
        window.location.href = '/onboarding/complete';
        return;
      } else if (!isRecent) {
        // Clean up expired flag
        console.log('[redirectAfterAuth] Onboarding payment flag expired, removing');
        localStorage.removeItem('onboarding_payment');
      }
    } catch (error) {
      console.error('[redirectAfterAuth] Error parsing onboarding payment data:', error);
      localStorage.removeItem('onboarding_payment');
    }
  }

  // If user hasn't seen marketing onboarding, redirect to welcome
  if (!hasSeenMarketingOnboarding && !user?.hasCompletedOnboarding) {
    console.log('[redirectAfterAuth] User has not seen marketing onboarding, redirecting to welcome');
    window.location.href = '/onboarding/welcome';
    return;
  }

  try {
    // If no user provided, try to fetch from API
    if (!user) {
      console.log('[redirectAfterAuth] No user provided, fetching from API');
      const token = getToken();
      console.log('[redirectAfterAuth] Token found:', token ? 'YES' : 'NO');
      
      if (!token) {
        console.log('[redirectAfterAuth] No token, redirecting to pricing');
        window.location.href = '/pricing?checkout=true';
        return;
      }

      // Fetch user info to check membership
      console.log('[redirectAfterAuth] Fetching user from:', `${config.apiUrl}/auth/me`);
      const response = await fetch(`${config.apiUrl}/auth/me`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      console.log('[redirectAfterAuth] API response status:', response.status);

      if (!response.ok) {
        console.error('[redirectAfterAuth] API call failed, status:', response.status);

        // Si el token es inválido (401), limpiar la sesión y redirigir a login
        if (response.status === 401) {
          console.log('[redirectAfterAuth] Token invalid, clearing session');
          removeToken();
          localStorage.removeItem('user');
          window.location.href = '/login?error=session_expired';
          return;
        }

        // Para otros errores, ir a pricing
        window.location.href = '/pricing?checkout=true';
        return;
      }

      user = await response.json();
      console.log('[redirectAfterAuth] User fetched:', user);
    }

    // Get subscription status after fetching user
    const subscriptionStatus = getSubscriptionStatus(user);
    
    console.log('[redirectAfterAuth] Subscription check:', {
      user,
      plan: user?.plan,
      subscription: user?.subscription,
      subscriptionStatus
    });

    // Route based on subscription status
    if (subscriptionStatus === 'past_due') {
      // Subscription expired or trial ended
      console.log('[redirectAfterAuth] Subscription past due, redirecting to renew');
      window.location.href = '/renew?reason=expired';
    } else if (subscriptionStatus === 'canceled') {
      // Subscription was canceled
      console.log('[redirectAfterAuth] Subscription canceled, redirecting to pricing');
      window.location.href = '/pricing?reason=canceled';
    } else if (subscriptionStatus === 'active' || subscriptionStatus === 'trialing') {
      // Has active subscription or in trial, redirect to dashboard
      console.log('[redirectAfterAuth] Has active/trial subscription, redirecting to dashboard:', `${config.dashboardUrl}/dashboard`);
      window.location.href = `${config.dashboardUrl}/dashboard`;
    } else {
      // No subscription, check if has paid plan
      const hasPaidPlan = user?.plan && user.plan !== 'free';
      if (hasPaidPlan) {
        console.log('[redirectAfterAuth] Has paid plan, redirecting to dashboard');
        window.location.href = `${config.dashboardUrl}/dashboard`;
      } else {
        // User doesn't have membership, redirect to pricing
        console.log('[redirectAfterAuth] No membership, redirecting to pricing');
        window.location.href = '/pricing?checkout=true';
      }
    }
  } catch (error) {
    console.error('[redirectAfterAuth] Error during redirect:', error);
    // Fallback to pricing page on error
    window.location.href = '/pricing';
  }
}
