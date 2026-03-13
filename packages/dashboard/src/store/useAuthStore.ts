import { create } from 'zustand';
import { getAuthToken, clearAuthToken } from '@/lib/auth-utils';
import { API_URL } from '@/lib/config';

export interface ClientInfo {
  companyName: string;
  sdkApiKey: string;
  id: string;
  hasCompletedOnboarding: boolean;
}

interface AuthState {
  client: ClientInfo | null;
  isAuthenticated: boolean;
  isLoading: boolean;

  initialize: () => Promise<boolean>;
  setOnboardingComplete: () => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()((set, get) => ({
  client: null,
  isAuthenticated: false,
  isLoading: true,

  initialize: async (): Promise<boolean> => {
    if (get().isAuthenticated && get().client) return true;

    set({ isLoading: true });

    const token = getAuthToken();
    if (!token) {
      set({ client: null, isAuthenticated: false, isLoading: false });
      return false;
    }

    try {
      const res = await fetch(`${API_URL}/api/client/me`, {
        headers: { 'X-Client-Token': token },
      });

      if (!res.ok) {
        clearAuthToken();
        set({ client: null, isAuthenticated: false, isLoading: false });
        return false;
      }

      const data = await res.json();

      set({
        client: {
          companyName: data.companyName,
          sdkApiKey: data.sdkApiKey,
          id: data.id,
          hasCompletedOnboarding: data.hasCompletedOnboarding ?? true,
        },
        isAuthenticated: true,
        isLoading: false,
      });
      return true;
    } catch {
      set({ client: null, isAuthenticated: false, isLoading: false });
      return false;
    }
  },

  setOnboardingComplete: () => {
    const client = get().client;
    if (client) {
      set({ client: { ...client, hasCompletedOnboarding: true } });
    }
  },

  logout: () => {
    clearAuthToken();
    set({ client: null, isAuthenticated: false });
  },
}));
