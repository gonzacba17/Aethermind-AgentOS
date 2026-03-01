/**
 * Authentication Utilities — B2B Beta
 *
 * Uses localStorage with a client access token (no JWT, no OAuth).
 * Token is provided via URL ?token= param on first visit.
 * localStorage persists across page reloads and new tabs.
 */


const CLIENT_TOKEN_KEY = 'client_token';

/**
 * Retrieves the client access token from localStorage
 */
export function getAuthToken(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return localStorage.getItem(CLIENT_TOKEN_KEY);
  } catch {
    return null;
  }
}

/**
 * Stores the client access token in localStorage
 */
export function setAuthToken(token: string): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(CLIENT_TOKEN_KEY, token);
  } catch (error) {
    console.error('Error storing client token:', error);
  }
}

/**
 * Removes the client access token from localStorage
 */
export function clearAuthToken(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(CLIENT_TOKEN_KEY);
  } catch (error) {
    console.error('Error clearing client token:', error);
  }
}

/**
 * Checks if a client token exists in localStorage
 */
export function isAuthenticated(): boolean {
  return !!getAuthToken();
}
