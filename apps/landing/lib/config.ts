/**
 * Centralized configuration for Aethermind Landing Page
 * Single source of truth for all environment variables
 */

export const config = {
  /**
   * Backend API URL
   */
  apiUrl: process.env.NEXT_PUBLIC_API_URL || 'https://aethermindapi-production.up.railway.app/api',
  
  /**
   * Dashboard URL for post-authentication redirect
   */
  dashboardUrl: process.env.NEXT_PUBLIC_DASHBOARD_URL || 'https://aethermind-agent-os-dashboard.vercel.app',
  
  /**
   * Stripe configuration
   */
  stripe: {
    publishableKey: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || '',
    proPriceId: process.env.NEXT_PUBLIC_STRIPE_PRO_PRICE_ID || '',
  },
  
  /**
   * Google Analytics ID (optional)
   */
  googleAnalyticsId: process.env.NEXT_PUBLIC_GA_ID,
} as const;

// Validate critical configuration
if (!config.apiUrl) {
  throw new Error('NEXT_PUBLIC_API_URL is required');
}

// Export for convenience
export const API_BASE_URL = config.apiUrl;
