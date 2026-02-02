import { ApiError } from './client';
import { getToken, saveToken, removeToken } from '@/lib/auth-utils';
import { config } from '@/lib/config';

/**
 * User plan types
 */
export type PlanType = 'free' | 'pro' | 'enterprise';

/**
 * User interface with conversion support
 */
export interface User {
  id: string;
  email: string;
  name?: string;
  plan?: PlanType;
  usageCount?: number;
  usageLimit?: number;
  // Conversion-related fields from backend
  isTemporaryUser?: boolean;
  wasConverted?: boolean;
  newToken?: string;
}

/**
 * Response from plan update
 */
export interface PlanUpdateResponse {
  success: boolean;
  user: {
    id: string;
    email: string;
    plan: PlanType;
  };
  message?: string;
  newToken?: string; // Backend may return new token after plan update
}

/**
 * Validation result before plan update
 */
export interface UserValidationResult {
  valid: boolean;
  reason?: 'NO_TOKEN' | 'INVALID_TOKEN' | 'TEMP_USER' | 'ALREADY_HAS_PLAN' | 'API_ERROR' | 'CONVERSION_FAILED';
  user?: User;
  message?: string;
  wasConverted?: boolean;
}

/**
 * Error messages in Spanish for user-facing display
 */
export const ERROR_MESSAGES: Record<string, string> = {
  // Authentication errors
  NO_TOKEN: 'No has iniciado sesión. Por favor inicia sesión para continuar.',
  INVALID_TOKEN: 'Tu sesión ha expirado. Por favor inicia sesión nuevamente.',
  
  // User state errors
  TEMP_USER: 'Tu cuenta es temporal. Recarga la página para completar el registro con Google.',
  TEMP_USER_CONVERSION_FAILED: 'No se pudo completar tu registro. Por favor intenta iniciar sesión nuevamente.',
  ALREADY_FREE: 'Ya tienes el plan Free activo.',
  ALREADY_PRO: 'Ya tienes el plan Pro activo.',
  
  // Network/Server errors
  NETWORK_ERROR: 'Error de conexión. Verifica tu internet e intenta nuevamente.',
  SERVER_ERROR: 'Error del servidor. Intenta nuevamente en unos minutos.',
  TIMEOUT: 'La solicitud tardó demasiado. Intenta nuevamente.',
  
  // Generic
  UNKNOWN: 'Ocurrió un error inesperado. Intenta nuevamente.',
};

/**
 * Get user-friendly error message based on error code or message
 */
export function getErrorMessage(error: ApiError | Error | unknown): string {
  if (!error) return ERROR_MESSAGES.UNKNOWN;
  
  // Handle ApiError with code
  if ((error as ApiError).code) {
    const apiError = error as ApiError;
    switch (apiError.code) {
      case 'AUTH_ERROR':
        return ERROR_MESSAGES.INVALID_TOKEN;
      case 'TEMP_USER_ERROR':
        return ERROR_MESSAGES.TEMP_USER;
      case 'NETWORK_ERROR':
        return ERROR_MESSAGES.NETWORK_ERROR;
      case 'SERVER_ERROR':
        return ERROR_MESSAGES.SERVER_ERROR;
      case 'TIMEOUT':
        return ERROR_MESSAGES.TIMEOUT;
      default:
        return apiError.message || ERROR_MESSAGES.UNKNOWN;
    }
  }
  
  // Handle regular Error
  if (error instanceof Error) {
    return error.message || ERROR_MESSAGES.UNKNOWN;
  }
  
  return ERROR_MESSAGES.UNKNOWN;
}

/**
 * Check if a user ID indicates a temporary user
 */
export function isTemporaryUser(userId: string): boolean {
  if (!userId) return false;
  return userId.startsWith('temp-') || userId.startsWith('tmp-');
}

/**
 * Clear session data (useful when landing page has no logout button)
 */
export function clearSession(): void {
  console.log('[userAPI] Clearing session');
  removeToken();
  // Clear any cached user data
  if (typeof window !== 'undefined') {
    localStorage.removeItem('user');
    sessionStorage.removeItem('user');
  }
}

/**
 * Update token in storage (used after automatic conversion)
 */
function updateStoredToken(newToken: string): void {
  console.log('[userAPI] Updating stored token after conversion');
  // Use saveToken with rememberMe=true for converted users
  saveToken(newToken, true);
}

/**
 * Get current user with automatic conversion handling
 * If backend converts a temporary user, automatically updates the token
 */
export async function getCurrentUser(): Promise<User> {
  console.log('[userAPI] Fetching current user...');
  
  const token = getToken();
  if (!token) {
    console.log('[userAPI] No token found');
    throw {
      code: 'AUTH_ERROR',
      message: ERROR_MESSAGES.NO_TOKEN,
    };
  }
  
  try {
    const response = await fetch(`${config.apiUrl}/auth/me`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });
    
    if (!response.ok) {
      console.error('[userAPI] Failed to fetch user, status:', response.status);
      
      if (response.status === 401) {
        // Clear invalid session
        clearSession();
        throw {
          code: 'AUTH_ERROR',
          message: ERROR_MESSAGES.INVALID_TOKEN,
        };
      }
      
      throw {
        code: 'SERVER_ERROR',
        message: ERROR_MESSAGES.SERVER_ERROR,
      };
    }
    
    const user: User = await response.json();
    console.log('[userAPI] User fetched:', { 
      id: user.id, 
      email: user.email, 
      plan: user.plan,
      isTemporaryUser: user.isTemporaryUser,
      wasConverted: user.wasConverted,
      hasNewToken: !!user.newToken
    });
    
    // 🔥 Handle automatic conversion from backend
    if (user.wasConverted && user.newToken) {
      console.log('[userAPI] ✅ User was auto-converted by backend, updating token');
      
      try {
        updateStoredToken(user.newToken);
        console.log('[userAPI] Token updated successfully after conversion');
      } catch (tokenError) {
        console.error('[userAPI] Failed to update token after conversion:', tokenError);
        // Don't fail the request, just log the error
      }
    }
    
    // Check if user is still temporary after conversion attempt
    if (user.isTemporaryUser === true && !user.wasConverted) {
      console.warn('[userAPI] ⚠️ User is still temporary after conversion attempt');
      throw {
        code: 'TEMP_USER_ERROR',
        message: ERROR_MESSAGES.TEMP_USER,
      };
    }
    
    // Also check by ID prefix (fallback)
    if (isTemporaryUser(user.id) && !user.wasConverted) {
      console.warn('[userAPI] ⚠️ User ID indicates temporary user:', user.id);
      throw {
        code: 'TEMP_USER_ERROR',
        message: ERROR_MESSAGES.TEMP_USER,
      };
    }
    
    return user;
    
  } catch (error: unknown) {
    // Re-throw if already a structured error
    if (error && typeof error === 'object' && 'code' in error) {
      throw error;
    }
    
    console.error('[userAPI] Unexpected error fetching user:', error);
    throw {
      code: 'NETWORK_ERROR',
      message: ERROR_MESSAGES.NETWORK_ERROR,
    };
  }
}

/**
 * User API functions
 */
export const userAPI = {
  /**
   * Validate user before allowing plan update
   * Checks: token exists, token valid, user not temporary (with auto-conversion support)
   */
  async validateForPlanUpdate(targetPlan: PlanType = 'free'): Promise<UserValidationResult> {
    console.log('[userAPI] Validating user for plan update:', targetPlan);
    
    // 1. Check if token exists
    const token = getToken();
    if (!token) {
      console.log('[userAPI] No token found');
      return {
        valid: false,
        reason: 'NO_TOKEN',
        message: ERROR_MESSAGES.NO_TOKEN,
      };
    }
    
    try {
      // 2. Fetch current user (this handles auto-conversion)
      let user: User;
      try {
        user = await getCurrentUser();
      } catch (error: unknown) {
        // Handle specific error codes
        if (error && typeof error === 'object' && 'code' in error) {
          const typedError = error as { code: string; message: string };
          
          if (typedError.code === 'TEMP_USER_ERROR') {
            console.log('[userAPI] User is temporary and could not be converted');
            return {
              valid: false,
              reason: 'TEMP_USER',
              message: typedError.message,
            };
          }
          
          if (typedError.code === 'AUTH_ERROR') {
            console.log('[userAPI] Authentication error');
            return {
              valid: false,
              reason: 'INVALID_TOKEN',
              message: typedError.message,
            };
          }
        }
        
        throw error;
      }
      
      console.log('[userAPI] User validated:', { 
        id: user.id, 
        email: user.email, 
        plan: user.plan,
        wasConverted: user.wasConverted 
      });
      
      // 3. Check if user already has the target plan
      if (user.plan === targetPlan) {
        console.log('[userAPI] User already has plan:', targetPlan);
        const planName = targetPlan.charAt(0).toUpperCase() + targetPlan.slice(1);
        return {
          valid: false,
          reason: 'ALREADY_HAS_PLAN',
          user,
          message: `Ya tienes el plan ${planName} activo.`,
        };
      }
      
      // All checks passed
      console.log('[userAPI] ✅ Validation passed', user.wasConverted ? '(user was auto-converted)' : '');
      return {
        valid: true,
        user,
        wasConverted: user.wasConverted,
      };
      
    } catch (error) {
      console.error('[userAPI] Validation error:', error);
      return {
        valid: false,
        reason: 'API_ERROR',
        message: getErrorMessage(error),
      };
    }
  },
  
  /**
   * Update user's plan
   */
  async updatePlan(plan: PlanType): Promise<PlanUpdateResponse> {
    console.log('[userAPI] Updating plan to:', plan);
    
    const token = getToken();
    if (!token) {
      throw new Error(ERROR_MESSAGES.NO_TOKEN);
    }
    
    const response = await fetch(`${config.apiUrl}/auth/update-plan`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ plan }),
    });
    
    const data = await response.json().catch(() => ({}));
    
    if (!response.ok) {
      console.error('[userAPI] Update plan failed:', response.status, data);
      
      // Handle 401 - clear session
      if (response.status === 401) {
        clearSession();
        throw new Error(ERROR_MESSAGES.INVALID_TOKEN);
      }
      
      // Create appropriate error message
      let message = data.message || data.error || ERROR_MESSAGES.UNKNOWN;
      
      if (response.status === 400) {
        // Check for temporary user error in response
        const lowerMessage = (data.message || data.error || '').toLowerCase();
        if (lowerMessage.includes('temp') || lowerMessage.includes('temporary')) {
          message = ERROR_MESSAGES.TEMP_USER;
        }
      } else if (response.status >= 500) {
        message = ERROR_MESSAGES.SERVER_ERROR;
      }
      
      throw new Error(message);
    }
    
    // Handle new token in response (backend may issue new token after plan update)
    if (data.newToken) {
      console.log('[userAPI] Received new token after plan update, updating storage');
      try {
        updateStoredToken(data.newToken);
      } catch (tokenError) {
        console.error('[userAPI] Failed to update token after plan update:', tokenError);
      }
    }
    
    console.log('[userAPI] ✅ Plan updated successfully:', data);
    return data as PlanUpdateResponse;
  },
  
  /**
   * Get current user (exposed for external use)
   */
  getCurrentUser,
  
  /**
   * Clear session (exposed for external use)
   */
  clearSession,
};
