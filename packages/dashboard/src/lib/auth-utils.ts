/**
 * Authentication Utilities — B2B Beta
 *
 * Uses sessionStorage with a client access token (no JWT, no OAuth).
 * Token is provided via URL ?token= param on first visit.
 *
 * Previous version used localStorage + JWT — kept as reference below.
 */

// ─── Previous JWT-based implementation (commented out, not deleted) ───
// import { LANDING_PAGE_URL } from './config';
// const AUTH_TOKEN_KEY = 'auth_token';
// export function getAuthToken() { return localStorage.getItem(AUTH_TOKEN_KEY); }
// export function setAuthToken(token: string) { localStorage.setItem(AUTH_TOKEN_KEY, token); }
// export function clearAuthToken() { localStorage.removeItem(AUTH_TOKEN_KEY); }
// export function isAuthenticated() { return !!getAuthToken(); }
// export function getUserFromToken(token: string) { /* JWT decode */ }
// export interface AuthUser { ... }
// export interface AuthMeResponse extends AuthUser {}

const CLIENT_TOKEN_KEY = 'client_token';

/**
 * Retrieves the client access token from sessionStorage
 */
export function getAuthToken(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return sessionStorage.getItem(CLIENT_TOKEN_KEY);
  } catch {
    return null;
  }
}

/**
 * Stores the client access token in sessionStorage
 */
export function setAuthToken(token: string): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(CLIENT_TOKEN_KEY, token);
  } catch (error) {
    console.error('Error storing client token:', error);
  }
}

/**
 * Removes the client access token from sessionStorage
 */
export function clearAuthToken(): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.removeItem(CLIENT_TOKEN_KEY);
  } catch (error) {
    console.error('Error clearing client token:', error);
  }
}

/**
 * Checks if a client token exists in sessionStorage
 */
export function isAuthenticated(): boolean {
  return !!getAuthToken();
}
