import { create } from 'zustand';
import { getAuthToken, clearAuthToken } from '@/lib/auth-utils';

// ─── Previous JWT-based store (commented out, not deleted) ───
// export interface User { id, email, name, image, plan, organizationId, role }
// interface AuthState { user, token, isAuthenticated, isLoading, error, initialize, setUser, updateUser, logout, clearError, refreshUser }
// Used persist middleware + localStorage + /api/auth/me

export interface ClientInfo {
  companyName: string;
  sdkApiKey: string;
  id: string;
}

interface AuthState {
  client: ClientInfo | null;
  isAuthenticated: boolean;
  isLoading: boolean;

  initialize: () => Promise<void>;
  logout: () => void;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || '';

export const useAuthStore = create<AuthState>()((set) => ({
  client: null,
  isAuthenticated: false,
  isLoading: true,

  initialize: async () => {
    set({ isLoading: true });

    const token = getAuthToken();
    if (!token) {
      set({ client: null, isAuthenticated: false, isLoading: false });
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/api/client/me`, {
        headers: { 'X-Client-Token': token },
      });

      if (!res.ok) {
        clearAuthToken();
        set({ client: null, isAuthenticated: false, isLoading: false });
        return;
      }

      const data = await res.json();

      set({
        client: {
          companyName: data.companyName,
          sdkApiKey: data.sdkApiKey,
          id: data.id,
        },
        isAuthenticated: true,
        isLoading: false,
      });
    } catch {
      set({ client: null, isAuthenticated: false, isLoading: false });
    }
  },

  logout: () => {
    clearAuthToken();
    set({ client: null, isAuthenticated: false });
  },
}));
