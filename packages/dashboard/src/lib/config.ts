/**
 * Dashboard Configuration
 * Provides environment-aware URLs for cross-deployment compatibility
 *
 * Environment Variables:
 * - NEXT_PUBLIC_LANDING_URL: Landing page URL for redirects (login, logout, etc.)
 * - NEXT_PUBLIC_API_URL: Backend API URL
 */

// Landing page URL - must be set in Vercel environment variables
// For local development: http://localhost:3000
// For production: https://aethermind-page.vercel.app
export const LANDING_PAGE_URL = process.env.NEXT_PUBLIC_LANDING_URL || 'http://localhost:3000';

// Login page path on the landing/frontend
export const LOGIN_PATH = '/login';

// Full login URL
export const LOGIN_URL = `${LANDING_PAGE_URL}${LOGIN_PATH}`;

// API URL — strip trailing /api and slashes to get base URL
// Production fallback ensures dashboard works even without env var on Vercel
const FALLBACK_API_URL = 'https://aethermind-agentos-production.up.railway.app';
export const API_URL = (process.env.NEXT_PUBLIC_API_URL || FALLBACK_API_URL).replace(/\/api\/?$/, '').replace(/\/+$/, '');
