import { API_BASE_URL } from '@/lib/config';

export const apiConfig = {
  baseURL: API_BASE_URL,
  timeout: 10000,
};

export async function fetchWithConfig(endpoint: string, options?: RequestInit) {
  const url = `${apiConfig.baseURL}${endpoint}`;
  
  const defaultOptions: RequestInit = {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  };

  const response = await fetch(url, defaultOptions);
  
  if (!response.ok) {
    throw new Error(`API Error: ${response.status} ${response.statusText}`);
  }
  
  return response.json();
}
