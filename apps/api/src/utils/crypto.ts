import crypto from 'crypto';

/**
 * Hash a value for use as a cache key (never store plaintext tokens).
 * Uses SHA-256 to produce a deterministic, fixed-length hex string.
 *
 * @param value - The plaintext value to hash (e.g., an API key or access token)
 * @returns A 64-character hex string (SHA-256 digest)
 */
export function hashForCache(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex');
}
