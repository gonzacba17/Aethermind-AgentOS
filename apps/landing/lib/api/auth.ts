import { apiClient } from './client';
import { API_BASE_URL } from '@/lib/config';
import { saveToken, removeToken } from '@/lib/auth-utils';

export interface User {
  id: string;
  name: string;
  email: string;
  apiKey?: string; // API key for SDK integration
  hasCompletedOnboarding?: boolean;
  plan?: 'free' | 'pro' | 'enterprise';
  subscription?: {
    status: 'trialing' | 'active' | 'past_due' | 'canceled' | 'inactive';
    plan: string;
    trial_end?: string | Date; // ISO date string or Date object
  };
}

export interface AuthResponse {
  token: string;
  user: User;
}

export interface SignupData {
  name: string;
  email: string;
  password: string;
}

export interface LoginData {
  email: string;
  password: string;
}

export const authAPI = {
  /**
   * Register a new user
   */
  async signup(data: SignupData): Promise<AuthResponse> {
    const response = await apiClient.post<AuthResponse>('/auth/signup', data);
    if (response.token) {
      saveToken(response.token, true); // Remember user by default on signup
      localStorage.setItem('user', JSON.stringify(response.user));
    }
    return response;
  },

  /**
   * Login existing user
   */
  async login(data: LoginData, rememberMe = false): Promise<AuthResponse> {
    const response = await apiClient.post<AuthResponse>('/auth/login', data);
    if (response.token) {
      saveToken(response.token, rememberMe);
      localStorage.setItem('user', JSON.stringify(response.user));
    }
    return response;
  },

  /**
   * Get current authenticated user
   */
  async getCurrentUser(): Promise<User> {
    return apiClient.get<User>('/auth/me');
  },

  /**
   * Logout user
   */
  logout() {
    if (typeof window !== 'undefined') {
      removeToken();
      localStorage.removeItem('user');
    }
  },

  /**
   * Initiate Google OAuth
   */
  loginWithGoogle() {
    const callbackUrl = `${window.location.origin}/auth/callback`;
    window.location.href = `${API_BASE_URL}/auth/google?redirect=${encodeURIComponent(callbackUrl)}`;
  },

  /**
   * Initiate GitHub OAuth
   */
  loginWithGitHub() {
    const callbackUrl = `${window.location.origin}/auth/callback`;
    window.location.href = `${API_BASE_URL}/auth/github?redirect=${encodeURIComponent(callbackUrl)}`;
  },

  /**
   * Check if user has active membership
   */
  hasActiveMembership(user: User): boolean {
    // Check if plan is not free
    if (user.plan && user.plan !== 'free') {
      return true;
    }

    // Check subscription status
    if (user.subscription && user.subscription.status === 'active') {
      return true;
    }

    return false;
  },

  /**
   * Request password reset email
   */
  async forgotPassword(email: string): Promise<{ message: string }> {
    return apiClient.post<{ message: string }>('/auth/forgot-password', { email });
  },

  /**
   * Reset password with token
   */
  async resetPassword(token: string, password: string): Promise<{ message: string }> {
    return apiClient.post<{ message: string }>('/auth/reset-password', { token, password });
  },

  /**
   * Verify email with token
   */
  async verifyEmail(token: string): Promise<{ message: string; user?: User }> {
    return apiClient.post<{ message: string; user?: User }>('/auth/verify-email', { token });
  },

  /**
   * Update onboarding progress
   */
  async updateOnboarding(step: string, completed = false): Promise<{ success: boolean }> {
    return apiClient.patch<{ success: boolean }>('/auth/onboarding', { step, completed });
  },
};
