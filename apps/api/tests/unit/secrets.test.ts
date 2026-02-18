/**
 * Unit tests for secrets.ts validation
 * Verifies that missing SESSION_SECRET throws in production
 */

import { jest, describe, test, expect, beforeEach, afterEach } from '@jest/globals';

// Mock the logger to avoid side effects
jest.mock('../../src/utils/logger', () => ({
  default: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  }
}));

describe('Secrets Validation', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    // Clean env for each test
    jest.resetModules();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  test('throws in production when SESSION_SECRET is not set', async () => {
    process.env.NODE_ENV = 'production';
    process.env.JWT_SECRET = 'test-jwt-secret-min-32-chars-long-for-security';
    process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
    process.env.API_KEY_HASH = '$2a$10$somefakehashedkey1234567890';
    delete process.env.SESSION_SECRET;

    // Re-import for fresh module
    const { validateSecrets } = await import('../../src/config/secrets');
    
    expect(() => validateSecrets()).toThrow(/SESSION_SECRET/);
  });

  test('does NOT throw in development when SESSION_SECRET is not set', async () => {
    process.env.NODE_ENV = 'test';
    process.env.JWT_SECRET = 'test-jwt-secret-min-32-chars-long-for-security';
    delete process.env.SESSION_SECRET;

    const { validateSecrets } = await import('../../src/config/secrets');

    // Should not throw about SESSION_SECRET in non-production
    let threwAboutSession = false;
    try {
      validateSecrets();
    } catch (error: any) {
      if (error.message.includes('SESSION_SECRET')) {
        threwAboutSession = true;
      }
    }
    expect(threwAboutSession).toBe(false);
  });

  test('accepts valid production config with SESSION_SECRET set', async () => {
    process.env.NODE_ENV = 'production';
    process.env.JWT_SECRET = 'prod-jwt-secret-min-32-chars-long-for-security!!';
    process.env.SESSION_SECRET = 'separate-session-secret-min-32-chars-long!!!!!';
    process.env.DATABASE_URL = 'postgresql://user:pass@host:5432/db';
    process.env.API_KEY_HASH = '$2a$10$somefakehashedkey1234567890';

    const { validateSecrets } = await import('../../src/config/secrets');

    // Should not throw about SESSION_SECRET
    let threwAboutSession = false;
    try {
      const secrets = validateSecrets();
      expect(secrets.SESSION_SECRET).toBe('separate-session-secret-min-32-chars-long!!!!!');
    } catch (error: any) {
      if (error.message.includes('SESSION_SECRET')) {
        threwAboutSession = true;
      }
    }
    expect(threwAboutSession).toBe(false);
  });
});
