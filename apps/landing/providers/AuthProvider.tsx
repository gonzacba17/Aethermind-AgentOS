'use client';

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  type ReactNode,
} from 'react';
import { getToken, removeToken, saveToken } from '@/lib/auth-utils';
import { authAPI, type User, type LoginData, type SignupData } from '@/lib/api/auth';

export interface AuthContextValue {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  login: (data: LoginData, rememberMe?: boolean) => Promise<User>;
  signup: (data: SignupData) => Promise<User>;
  logout: () => void;
  loginWithGoogle: () => void;
  loginWithGitHub: () => void;
  refreshUser: () => Promise<void>;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const isAuthenticated = !!user;

  // Fetch current user from API
  const refreshUser = useCallback(async () => {
    const token = getToken();
    if (!token) {
      setUser(null);
      setIsLoading(false);
      return;
    }

    try {
      const currentUser = await authAPI.getCurrentUser();
      setUser(currentUser);
      // Update localStorage with fresh user data
      localStorage.setItem('user', JSON.stringify(currentUser));
    } catch (err) {
      console.error('[AuthProvider] Failed to fetch user:', err);
      removeToken();
      localStorage.removeItem('user');
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Initial auth check on mount
  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  // Cross-tab sync via storage events
  useEffect(() => {
    function handleStorageChange(e: StorageEvent) {
      if (e.key === 'token') {
        if (!e.newValue) {
          // Token removed in another tab
          console.log('[AuthProvider] Token removed in another tab');
          setUser(null);
        } else if (e.newValue !== e.oldValue) {
          // Token changed in another tab, re-fetch user
          console.log('[AuthProvider] Token changed in another tab');
          refreshUser();
        }
      } else if (e.key === 'user' && e.newValue) {
        // User data updated in another tab
        try {
          const updatedUser = JSON.parse(e.newValue);
          setUser(updatedUser);
        } catch {
          // Ignore parse errors
        }
      }
    }

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [refreshUser]);

  const login = useCallback(async (data: LoginData, rememberMe = false): Promise<User> => {
    setError(null);
    try {
      const response = await authAPI.login(data, rememberMe);
      setUser(response.user);
      return response.user;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error al iniciar sesión';
      setError(message);
      throw err;
    }
  }, []);

  const signup = useCallback(async (data: SignupData): Promise<User> => {
    setError(null);
    try {
      const response = await authAPI.signup(data);
      setUser(response.user);
      return response.user;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error al registrarse';
      setError(message);
      throw err;
    }
  }, []);

  const logout = useCallback(() => {
    authAPI.logout();
    setUser(null);
    setError(null);
  }, []);

  const loginWithGoogle = useCallback(() => {
    authAPI.loginWithGoogle();
  }, []);

  const loginWithGitHub = useCallback(() => {
    authAPI.loginWithGitHub();
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // Memoize context value to prevent unnecessary re-renders
  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isAuthenticated,
      isLoading,
      error,
      login,
      signup,
      logout,
      loginWithGoogle,
      loginWithGitHub,
      refreshUser,
      clearError,
    }),
    [
      user,
      isAuthenticated,
      isLoading,
      error,
      login,
      signup,
      logout,
      loginWithGoogle,
      loginWithGitHub,
      refreshUser,
      clearError,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuthContext(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuthContext must be used within an AuthProvider');
  }
  return context;
}
