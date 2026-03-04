/**
 * Mock data utilities
 */

/**
 * Check if we should use mock data (API not configured)
 * This is true when NEXT_PUBLIC_API_URL is not set, empty, or undefined
 */
export function shouldUseMockData(): boolean {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL;
  // Use mock data if API_URL is not set, empty string, or undefined
  return !apiUrl || apiUrl.trim() === '' || apiUrl === 'undefined';
}
