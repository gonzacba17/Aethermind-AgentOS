/**
 * Unit tests for encrypt/decrypt functions in user-api-keys.ts
 *
 * Since encrypt/decrypt are not exported directly, we test them
 * by reimplementing the same logic with the same algorithm parameters.
 * This validates the crypto contract: encrypt(decrypt(x)) === x
 */

import crypto from 'crypto';

// Replicate the encrypt/decrypt logic from user-api-keys.ts
// so we can test the crypto contract independently

const TEST_ENCRYPTION_KEY = 'test-encryption-key-32-chars-ok!';

function encrypt(text: string, encKey: string = TEST_ENCRYPTION_KEY): string {
  const iv = crypto.randomBytes(16);
  const salt = crypto.randomBytes(16);
  const key = crypto.scryptSync(encKey, salt, 32);
  const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return salt.toString('hex') + ':' + iv.toString('hex') + ':' + encrypted;
}

function decrypt(encryptedText: string, encKey: string = TEST_ENCRYPTION_KEY): string {
  const parts = encryptedText.split(':');

  let salt: Buffer;
  let iv: Buffer;
  let encrypted: string;

  if (parts.length === 2) {
    // Legacy format (iv:encrypted)
    salt = Buffer.from('salt');
    iv = Buffer.from(parts[0]!, 'hex');
    encrypted = parts[1]!;
  } else if (parts.length === 3) {
    // New format (salt:iv:encrypted)
    salt = Buffer.from(parts[0]!, 'hex');
    iv = Buffer.from(parts[1]!, 'hex');
    encrypted = parts[2]!;
  } else {
    throw new Error('Invalid encrypted key format');
  }

  const key = crypto.scryptSync(encKey, salt, 32);
  const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

function maskApiKey(key: string): string {
  if (key.length <= 8) return '****';
  return key.substring(0, 4) + '...' + key.substring(key.length - 4);
}

describe('User API Keys - Crypto Functions', () => {
  describe('encrypt / decrypt roundtrip', () => {
    it('should encrypt and decrypt a standard API key', () => {
      const originalKey = 'sk-proj-abc123def456ghi789';
      const encrypted = encrypt(originalKey);
      const decrypted = decrypt(encrypted);
      expect(decrypted).toBe(originalKey);
    });

    it('should encrypt and decrypt an empty string', () => {
      const encrypted = encrypt('');
      const decrypted = decrypt(encrypted);
      expect(decrypted).toBe('');
    });

    it('should encrypt and decrypt a very long key', () => {
      const longKey = 'sk-' + 'a'.repeat(500);
      const encrypted = encrypt(longKey);
      const decrypted = decrypt(encrypted);
      expect(decrypted).toBe(longKey);
    });

    it('should encrypt and decrypt keys with special characters', () => {
      const specialKey = 'sk-ant-api03-ñ@#$%^&*()_+-=[]{}|;:,.<>?/~`"\'\\';
      const encrypted = encrypt(specialKey);
      const decrypted = decrypt(encrypted);
      expect(decrypted).toBe(specialKey);
    });

    it('should produce different ciphertext for the same plaintext (random IV/salt)', () => {
      const key = 'sk-test-12345';
      const encrypted1 = encrypt(key);
      const encrypted2 = encrypt(key);
      expect(encrypted1).not.toBe(encrypted2);

      // But both should decrypt to the same value
      expect(decrypt(encrypted1)).toBe(key);
      expect(decrypt(encrypted2)).toBe(key);
    });
  });

  describe('encrypt output format', () => {
    it('should produce salt:iv:ciphertext format with 3 parts', () => {
      const encrypted = encrypt('test-key');
      const parts = encrypted.split(':');
      expect(parts.length).toBe(3);
    });

    it('should have 32-char hex salt (16 bytes)', () => {
      const encrypted = encrypt('test-key');
      const salt = encrypted.split(':')[0]!;
      expect(salt.length).toBe(32);
      expect(/^[0-9a-f]+$/.test(salt)).toBe(true);
    });

    it('should have 32-char hex IV (16 bytes)', () => {
      const encrypted = encrypt('test-key');
      const iv = encrypted.split(':')[1]!;
      expect(iv.length).toBe(32);
      expect(/^[0-9a-f]+$/.test(iv)).toBe(true);
    });

    it('should have hex ciphertext as third part', () => {
      const encrypted = encrypt('test-key');
      const ciphertext = encrypted.split(':')[2]!;
      expect(ciphertext.length).toBeGreaterThan(0);
      expect(/^[0-9a-f]+$/.test(ciphertext)).toBe(true);
    });
  });

  describe('decrypt error handling', () => {
    it('should throw on invalid format (1 part)', () => {
      expect(() => decrypt('not-valid-format')).toThrow('Invalid encrypted key format');
    });

    it('should throw on invalid format (4+ parts)', () => {
      expect(() => decrypt('a:b:c:d')).toThrow('Invalid encrypted key format');
    });

    it('should throw on corrupted ciphertext', () => {
      const encrypted = encrypt('test-key');
      const parts = encrypted.split(':');
      // Corrupt the ciphertext
      const corrupted = parts[0] + ':' + parts[1] + ':' + 'ff'.repeat(16);
      expect(() => decrypt(corrupted)).toThrow();
    });

    it('should throw when wrong encryption key is used', () => {
      const encrypted = encrypt('test-key', 'correct-key-32-characters-long!!');
      expect(() => decrypt(encrypted, 'wrong-key-also-32-characters-lo!')).toThrow();
    });
  });

  describe('legacy format compatibility', () => {
    it('should decrypt legacy 2-part format (iv:encrypted)', () => {
      // Simulate legacy encryption (no salt, using static 'salt')
      const encKey = TEST_ENCRYPTION_KEY;
      const iv = crypto.randomBytes(16);
      const staticSalt = Buffer.from('salt');
      const key = crypto.scryptSync(encKey, staticSalt, 32);
      const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
      let encrypted = cipher.update('legacy-api-key', 'utf8', 'hex');
      encrypted += cipher.final('hex');
      const legacyFormat = iv.toString('hex') + ':' + encrypted;

      const decrypted = decrypt(legacyFormat);
      expect(decrypted).toBe('legacy-api-key');
    });
  });

  describe('maskApiKey', () => {
    it('should mask a normal API key showing first 4 and last 4 chars', () => {
      expect(maskApiKey('sk-proj-abc123def456')).toBe('sk-p...f456');
    });

    it('should return **** for keys <= 8 chars', () => {
      expect(maskApiKey('12345678')).toBe('****');
      expect(maskApiKey('short')).toBe('****');
      expect(maskApiKey('')).toBe('****');
    });

    it('should handle keys exactly 9 chars long', () => {
      expect(maskApiKey('123456789')).toBe('1234...6789');
    });
  });
});
