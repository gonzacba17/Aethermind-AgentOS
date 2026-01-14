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

// API URL
export const API_URL = process.env.NEXT_PUBLIC_API_URL || '';
