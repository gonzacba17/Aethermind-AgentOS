import { API_BASE_URL } from '@/lib/config';
import { getToken } from '@/lib/auth-utils';

/**
 * Error codes for API responses
 */
export type ApiErrorCode = 
  | 'NETWORK_ERROR'    // No internet / failed to connect
  | 'AUTH_ERROR'       // 401 - Token invalid/expired
  | 'TEMP_USER_ERROR'  // 400 - User is temporary
  | 'VALIDATION_ERROR' // 400 - Bad request data
  | 'NOT_FOUND'        // 404 - Resource not found
  | 'SERVER_ERROR'     // 500+ - Backend issue
  | 'TIMEOUT'          // Request took too long
  | 'UNKNOWN';         // Catch-all

export interface ApiError {
  message: string;
  statusCode: number;
  code: ApiErrorCode;
  retryable: boolean;
  originalError?: unknown;
}

/**
 * API request options with timeout support
 */
export interface ApiRequestOptions extends RequestInit {
  timeout?: number; // Timeout in milliseconds
}

const DEFAULT_TIMEOUT = 15000; // 15 seconds

/**
 * Classify error based on status code and message
 */
function classifyError(statusCode: number, message: string): { code: ApiErrorCode; retryable: boolean } {
  // Network errors (status 0)
  if (statusCode === 0) {
    return { code: 'NETWORK_ERROR', retryable: true };
  }
  
  // Auth errors
  if (statusCode === 401) {
    return { code: 'AUTH_ERROR', retryable: false };
  }
  
  // Validation / bad request
  if (statusCode === 400) {
    // Check if it's a temporary user error
    const lowerMessage = message.toLowerCase();
    if (lowerMessage.includes('temp') || lowerMessage.includes('temporary')) {
      return { code: 'TEMP_USER_ERROR', retryable: false };
    }
    return { code: 'VALIDATION_ERROR', retryable: false };
  }
  
  // Not found
  if (statusCode === 404) {
    return { code: 'NOT_FOUND', retryable: false };
  }
  
  // Server errors
  if (statusCode >= 500) {
    return { code: 'SERVER_ERROR', retryable: true };
  }
  
  return { code: 'UNKNOWN', retryable: true };
}

/**
 * Create a standardized API error
 */
function createApiError(
  message: string,
  statusCode: number,
  originalError?: unknown
): ApiError {
  const { code, retryable } = classifyError(statusCode, message);
  return {
    message,
    statusCode,
    code,
    retryable,
    originalError,
  };
}

export class ApiClient {
  async request<T>(
    endpoint: string,
    options: ApiRequestOptions = {}
  ): Promise<T> {
    const token = getToken();
    const timeout = options.timeout ?? DEFAULT_TIMEOUT;
    
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string> || {}),
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    // Create abort controller for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      // Log in development
      if (process.env.NODE_ENV === 'development') {
        console.log(`[API] ${options.method || 'GET'} ${endpoint}`, { 
          hasToken: !!token,
          timeout 
        });
      }

      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        ...options,
        headers,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      // Try to parse JSON, but handle empty responses
      let data: unknown;
      const contentType = response.headers.get('content-type');
      if (contentType?.includes('application/json')) {
        data = await response.json();
      } else {
        data = { message: await response.text() || 'No response body' };
      }

      if (!response.ok) {
        const errorMessage = (data as { message?: string; error?: string })?.message 
          || (data as { message?: string; error?: string })?.error 
          || 'Something went wrong';
        
        // Log error in development
        if (process.env.NODE_ENV === 'development') {
          console.error(`[API] Error ${response.status}:`, data);
        }

        throw createApiError(errorMessage, response.status, data);
      }

      // Log success in development
      if (process.env.NODE_ENV === 'development') {
        console.log(`[API] Success:`, data);
      }

      return data as T;
    } catch (error) {
      clearTimeout(timeoutId);

      // Handle abort (timeout)
      if (error instanceof DOMException && error.name === 'AbortError') {
        throw createApiError(
          'La solicitud tardó demasiado. Intenta nuevamente.',
          0,
          error
        );
      }

      // Re-throw if already an ApiError
      if ((error as ApiError).code) {
        throw error;
      }

      // Network or unknown error
      throw createApiError(
        'Error de conexión. Verifica tu internet e intenta nuevamente.',
        0,
        error
      );
    }
  }

  async get<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: 'GET' });
  }

  async post<T>(endpoint: string, body?: unknown): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  async put<T>(endpoint: string, body?: unknown): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'PUT',
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  async delete<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: 'DELETE' });
  }

  async patch<T>(endpoint: string, body?: unknown): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'PATCH',
      body: body ? JSON.stringify(body) : undefined,
    });
  }
}

export const apiClient = new ApiClient();
