/**
 * Authentication Utilities
 * 
 * Provides centralized token management and authentication helpers
 * for the Aethermind dashboard.
 */

import { LANDING_PAGE_URL } from './config';

const AUTH_TOKEN_KEY = 'auth_token';

/**
 * Retrieves the JWT authentication token from localStorage
 * @returns JWT token string or null if not found
 */
export function getAuthToken(): string | null {
  if (typeof window === 'undefined') {
    return null;
  }
  
  try {
    return localStorage.getItem(AUTH_TOKEN_KEY);
  } catch (error) {
    console.error('Error reading auth token from localStorage:', error);
    return null;
  }
}

/**
 * Stores the JWT authentication token in localStorage
 * @param token - JWT token to store
 */
export function setAuthToken(token: string): void {
  if (typeof window === 'undefined') {
    return;
  }
  
  try {
    localStorage.setItem(AUTH_TOKEN_KEY, token);
    console.log('[Auth] Token stored successfully');
  } catch (error) {
    console.error('Error storing auth token in localStorage:', error);
  }
}

/**
 * Removes the JWT authentication token from localStorage
 */
export function clearAuthToken(): void {
  if (typeof window === 'undefined') {
    return;
  }
  
  try {
    localStorage.removeItem(AUTH_TOKEN_KEY);
    console.log('[Auth] Token cleared');
  } catch (error) {
    console.error('Error clearing auth token from localStorage:', error);
  }
}

/**
 * Checks if user is authenticated (has valid token)
 * Note: This only checks for token existence, not validity
 * @returns true if token exists, false otherwise
 */
export function isAuthenticated(): boolean {
  const token = getAuthToken();
  return !!token;
}

/**
 * Redirects user to the landing page login
 * @param returnUrl - Optional URL to return to after login
 */
export function redirectToLogin(returnUrl?: string): void {
  if (typeof window === 'undefined') {
    return;
  }
  
  const returnParam = returnUrl ? `?return=${encodeURIComponent(returnUrl)}` : '';
  
  console.log('[Auth] Redirecting to login...');
  window.location.href = `${LANDING_PAGE_URL}${returnParam}`;
}

/**
 * User information from /auth/me endpoint
 */
export interface AuthUser {
  id: string;
  name: string | null;
  email: string;
  plan: string;
  apiKey: string;
  emailVerified: boolean;
  usageCount: number;
  usageLimit: number;
  subscription: {
    status: string;
    plan: string;
  } | null;
  createdAt: string;
}

/**
 * Response from /auth/me endpoint
 */
export interface AuthMeResponse extends AuthUser {}

/**
 * Error response from authentication endpoints
 */
export interface AuthErrorResponse {
  error: string;
  message: string;
}
