import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { getAuthToken, setAuthToken, clearAuthToken, getUserFromToken } from '@/lib/auth-utils';

export interface User {
  id: string;
  email: string;
  name: string | null;
  image: string | null;
  plan: 'free' | 'pro' | 'enterprise' | null;
  organizationId: string | null;
  role: 'owner' | 'admin' | 'developer' | 'viewer' | null;
}

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  
  // Actions
  initialize: () => Promise<void>;
  setUser: (user: User, token: string) => void;
  updateUser: (updates: Partial<User>) => void;
  logout: () => void;
  clearError: () => void;
  refreshUser: () => Promise<void>;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || '';

/**
 * Authentication Store
 * 
 * Manages user authentication state including:
 * - Current user information
 * - JWT token (stored in localStorage via auth-utils)
 * - Loading and error states
 * 
 * Token is persisted in localStorage, user info is hydrated on initialization
 */
export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: true,
      error: null,
      
      /**
       * Initialize auth state from stored token or httpOnly cookie (OAuth)
       * Should be called on app mount
       */
      initialize: async () => {
        set({ isLoading: true, error: null });

        try {
          const token = getAuthToken();

          // Build headers - include Bearer token if available in localStorage
          const headers: Record<string, string> = {};
          if (token) {
            headers['Authorization'] = `Bearer ${token}`;
          }

          // Try to fetch user profile - works with both:
          // 1. Bearer token in localStorage (email/password login)
          // 2. httpOnly cookie (OAuth login - cookie sent automatically with credentials: 'include')
          const response = await fetch(`${API_BASE}/api/auth/me`, {
            credentials: 'include',
            headers,
          });

          if (!response.ok) {
            if (response.status === 401) {
              // Not authenticated - clear any stale localStorage token
              if (token) clearAuthToken();
              set({ user: null, token: null, isAuthenticated: false, isLoading: false });
              return;
            }
            throw new Error('Failed to fetch user profile');
          }

          const data = await response.json();

          // Handle token refresh if provided
          if (data.newToken) {
            setAuthToken(data.newToken);
            set({ token: data.newToken });
          }

          // Get user info from response or decode from token
          const tokenUser = token ? getUserFromToken(token) : null;

          const user: User = {
            id: data.user?.id || data.id || tokenUser?.id || '',
            email: data.user?.email || data.email || tokenUser?.email || '',
            name: data.user?.name || data.name || null,
            image: data.user?.image || data.image || null,
            plan: data.user?.plan || data.plan || null,
            organizationId: data.user?.organizationId || data.organizationId || null,
            role: data.user?.role || data.role || null,
          };

          set({
            user,
            token: data.newToken || token || null,
            isAuthenticated: true,
            isLoading: false
          });
        } catch (error) {
          console.error('Auth initialization error:', error);
          set({
            user: null,
            token: null,
            isAuthenticated: false,
            isLoading: false,
            error: error instanceof Error ? error.message : 'Authentication failed'
          });
        }
      },
      
      /**
       * Set user after successful login
       */
      setUser: (user, token) => {
        setAuthToken(token);
        set({ user, token, isAuthenticated: true, isLoading: false, error: null });
      },
      
      /**
       * Update current user info (e.g., after profile update)
       */
      updateUser: (updates) => {
        const currentUser = get().user;
        if (currentUser) {
          set({ user: { ...currentUser, ...updates } });
        }
      },
      
      /**
       * Clear auth state and token
       */
      logout: () => {
        clearAuthToken();
        set({ user: null, token: null, isAuthenticated: false, error: null });
      },
      
      /**
       * Clear any stored error
       */
      clearError: () => {
        set({ error: null });
      },
      
      /**
       * Refresh user data from API
       */
      refreshUser: async () => {
        const token = get().token;
        if (!token) return;

        try {
          const response = await fetch(`${API_BASE}/api/auth/me`, {
            credentials: 'include',
            headers: {
              'Authorization': `Bearer ${token}`,
            },
          });
          
          if (response.ok) {
            const data = await response.json();
            
            if (data.newToken) {
              setAuthToken(data.newToken);
              set({ token: data.newToken });
            }
            
            if (data.user) {
              set({ user: data.user });
            }
          }
        } catch (error) {
          console.error('Failed to refresh user:', error);
        }
      },
    }),
    {
      name: 'aethermind-auth-storage',
      // Only persist minimal data - token is in localStorage via auth-utils
      partialize: () => ({}),
    }
  )
);
