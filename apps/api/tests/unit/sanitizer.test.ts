import { sanitizeLog, sanitizeObject } from '../../src/utils/sanitizer';

describe('Sanitizer', () => {
  describe('sanitizeLog', () => {
    it('masks API keys', () => {
      const result = sanitizeLog('key: sk-1234567890123456789012345');
      expect(result).toContain('***REDACTED***');
    });

    it('masks Bearer tokens', () => {
      const result = sanitizeLog('Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9');
      expect(result).toContain('***REDACTED***');
    });

    it('masks passwords', () => {
      const result = sanitizeLog('password=mysecretpass123');
      expect(result).toContain('***REDACTED***');
    });

    it('masks JWT tokens', () => {
      const jwt = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';
      const result = sanitizeLog(jwt);
      expect(result).toContain('***REDACTED***');
    });

    it('does not modify non-sensitive content', () => {
      const message = 'This is a normal log message';
      const result = sanitizeLog(message);
      expect(result).toBe(message);
    });

    it('handles empty strings', () => {
      const result = sanitizeLog('');
      expect(result).toBe('');
    });

    it('handles non-string input', () => {
      const result = sanitizeLog(null as any);
      expect(result).toBe(null);
    });
  });

  describe('sanitizeObject', () => {
    it('masks apiKey in objects', () => {
      const obj = { apiKey: 'sk-test123456789012345678901234' };
      const clean = sanitizeObject(obj);
      expect(clean.apiKey).toBe('***REDACTED***');
    });

    it('sanitizes nested objects', () => {
      const obj = {
        config: {
          apiKey: 'sk-test123456789012345678901234',
          settings: {
            password: 'secretpass',
            normal: 'value',
          },
        },
      };
      const clean = sanitizeObject(obj);
      expect(clean.config.apiKey).toBe('***REDACTED***');
      expect(clean.config.settings.password).toBe('***REDACTED***');
      expect(clean.config.settings.normal).toBe('value');
    });

    it('does not modify original object', () => {
      const orig = { apiKey: 'sk-test', normal: 'data' };
      const clean = sanitizeObject(orig);
      expect(orig.apiKey).toBe('sk-test');
      expect(clean.apiKey).toBe('***REDACTED***');
    });

    it('handles arrays', () => {
      const obj = {
        items: [
          { apiKey: 'sk-123456789012345678901234' },
          { password: 'secret', name: 'test' },
        ],
      };
      const clean = sanitizeObject(obj);
      expect(clean.items[0].apiKey).toBe('***REDACTED***');
      expect(clean.items[1].password).toBe('***REDACTED***');
      expect(clean.items[1].name).toBe('test');
    });

    it('handles various sensitive key formats', () => {
      const obj = {
        api_key: 'key1',
        apikey: 'key2',
        authorization: 'bearer token',
        secret: 'secret',
        privateKey: 'private',
        normal: 'public',
      };
      const clean = sanitizeObject(obj);
      expect(clean.api_key).toBe('***REDACTED***');
      expect(clean.apikey).toBe('***REDACTED***');
      expect(clean.authorization).toBe('***REDACTED***');
      expect(clean.secret).toBe('***REDACTED***');
      expect(clean.privateKey).toBe('***REDACTED***');
      expect(clean.normal).toBe('public');
    });

    it('handles null and undefined values', () => {
      const result = sanitizeObject(null);
      expect(result).toBe(null);
    });

    it('handles primitive values', () => {
      expect(sanitizeObject(42)).toBe(42);
      expect(sanitizeObject('test')).toBe('test');
      expect(sanitizeObject(true)).toBe(true);
    });
  });
});
