'use client';

import { useState, useEffect } from 'react';
import { getToken, removeToken } from '@/lib/auth-utils';
import { authAPI, type User } from '@/lib/api/auth';

export interface AuthState {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: User | null;
}

/**
 * Custom hook to manage authentication state
 * Checks for token on mount and fetches user data
 */
export function useAuth(): AuthState {
  const [state, setState] = useState<AuthState>({
    isAuthenticated: false,
    isLoading: true,
    user: null,
  });

  useEffect(() => {
    async function checkAuth() {
      const token = getToken();
      
      if (!token) {
        setState({
          isAuthenticated: false,
          isLoading: false,
          user: null,
        });
        return;
      }

      try {
        // Fetch current user to verify token is valid
        const user = await authAPI.getCurrentUser();
        setState({
          isAuthenticated: true,
          isLoading: false,
          user,
        });
      } catch (error) {
        // Token is invalid, remove it
        console.error('Auth verification failed:', error);
        removeToken();
        setState({
          isAuthenticated: false,
          isLoading: false,
          user: null,
        });
      }
    }

    checkAuth();

    // CRITICAL: Listen for storage changes from other tabs
    function handleStorageChange(e: StorageEvent) {
      if (e.key === 'token') {
        if (!e.newValue) {
          // Token removed in another tab, logout here too
          console.log('[useAuth] Token removed in another tab, logging out');
          setState({ isAuthenticated: false, isLoading: false, user: null });
          // Redirect to login with message
          window.location.href = '/login?reason=session_ended';
        } else if (e.newValue !== e.oldValue) {
          // Token changed in another tab, re-verify
          console.log('[useAuth] Token changed in another tab, re-verifying');
          checkAuth();
        }
      }
    }

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  return state;
}
