import { User } from './api/auth';
import { config } from './config';

/**
 * Build a secure dashboard URL using a one-time exchange code.
 * The actual ct_* token never appears in the URL — only an opaque
 * exchange code that expires in 30 seconds and is single-use.
 * Falls back to a plain URL if exchange code creation fails.
 */
export async function buildDashboardUrl(): Promise<string> {
  const clientToken = typeof window !== 'undefined' ? localStorage.getItem('clientAccessToken') : null;
  if (!clientToken) {
    return `${config.dashboardUrl}`;
  }

  try {
    const res = await fetch(`${config.apiUrl}/auth/create-exchange-code`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientAccessToken: clientToken }),
    });

    if (res.ok) {
      const { code } = await res.json();
      return `${config.dashboardUrl}?code=${encodeURIComponent(code)}`;
    }
  } catch {
    // Fallback — redirect without token (dashboard will show login prompt)
  }

  return `${config.dashboardUrl}`;
}

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

  // Save token in cookie for middleware access (SameSite=Strict for CSRF protection)
  const maxAge = rememberMe ? 30 * 24 * 60 * 60 : undefined;
  const cookieString = [
    `token=${token}`,
    'path=/',
    'SameSite=Strict',
    window.location.protocol === 'https:' ? 'Secure' : '',
    maxAge ? `max-age=${maxAge}` : '',
  ].filter(Boolean).join('; ');

  document.cookie = cookieString;
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
  
  // Clear cookie as well
  document.cookie = 'token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Strict';
}

/**
 * Check if Remember Me is enabled
 */
export function isRememberMeEnabled(): boolean {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem('rememberMe') === 'true';
}

/**
 * Save client access token (B2B dashboard token) to localStorage
 */
export function saveClientToken(token: string) {
  if (typeof window === 'undefined') return;
  localStorage.setItem('clientAccessToken', token);
}

/**
 * Get client access token from localStorage
 */
export function getClientToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('clientAccessToken');
}

/**
 * Remove client access token from localStorage
 */
export function removeClientToken() {
  if (typeof window === 'undefined') return;
  localStorage.removeItem('clientAccessToken');
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

  const hasCompletedTechnicalOnboarding = localStorage.getItem('onboarding_technical_complete') === 'true';
  const hasSeenMarketingOnboarding = localStorage.getItem('onboarding_marketing_seen') === 'true';

  const onboardingPaymentRaw = localStorage.getItem('onboarding_payment');
  if (onboardingPaymentRaw) {
    try {
      const onboardingData = JSON.parse(onboardingPaymentRaw);
      const fiveMinutesInMs = 5 * 60 * 1000;
      const isRecent = (Date.now() - onboardingData.timestamp) < fiveMinutesInMs;

      if (onboardingData.completed && isRecent) {
        if (!hasCompletedTechnicalOnboarding) {
          window.location.href = '/onboarding/setup';
          return;
        }

        localStorage.removeItem('onboarding_payment');
        window.location.href = '/onboarding/complete';
        return;
      } else if (!isRecent) {
        localStorage.removeItem('onboarding_payment');
      }
    } catch {
      localStorage.removeItem('onboarding_payment');
    }
  }

  if (!hasSeenMarketingOnboarding && !user?.hasCompletedOnboarding) {
    window.location.href = '/onboarding/welcome';
    return;
  }

  try {
    if (!user) {
      const token = getToken();

      if (!token) {
        window.location.href = '/pricing?checkout=true';
        return;
      }

      const response = await fetch(`${config.apiUrl}/auth/me`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });

      if (!response.ok) {
        if (response.status === 401) {
          removeToken();
          localStorage.removeItem('user');
          window.location.href = '/login?error=session_expired';
          return;
        }
        window.location.href = '/pricing?checkout=true';
        return;
      }

      user = await response.json();
    }

    const subscriptionStatus = getSubscriptionStatus(user);

    if (subscriptionStatus === 'past_due') {
      window.location.href = '/renew?reason=expired';
    } else if (subscriptionStatus === 'canceled') {
      window.location.href = '/pricing?reason=canceled';
    } else if (subscriptionStatus === 'active' || subscriptionStatus === 'trialing') {
      const dashUrl = await buildDashboardUrl();
      window.location.href = dashUrl;
    } else {
      const clientToken = getClientToken();
      if (clientToken) {
        const dashUrl2 = await buildDashboardUrl();
        window.location.href = dashUrl2;
      } else {
        const hasPaidPlan = user?.plan && user.plan !== 'free';
        if (hasPaidPlan) {
          const dashUrl3 = await buildDashboardUrl();
          window.location.href = dashUrl3;
        } else {
          window.location.href = '/pricing?checkout=true';
        }
      }
    }
  } catch {
    window.location.href = '/pricing';
  }
}
