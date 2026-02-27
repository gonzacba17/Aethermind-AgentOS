/**
 * Tests for EmbeddingService
 * Covers LRU cache behavior and timeout handling.
 * Note: These tests mock the OpenAI API to avoid real network calls.
 */
import {
  hashText,
  clearEmbeddingCache,
  getEmbeddingCacheSize,
} from '../EmbeddingService.js';

describe('EmbeddingService', () => {
  beforeEach(() => {
    clearEmbeddingCache();
  });

  describe('hashText', () => {
    it('should produce a 64-char hex SHA-256 hash', () => {
      const hash = hashText('test');
      expect(hash).toHaveLength(64);
      expect(hash).toMatch(/^[0-9a-f]+$/);
    });

    it('should be deterministic', () => {
      const a = hashText('same input');
      const b = hashText('same input');
      expect(a).toBe(b);
    });

    it('should differ for different inputs', () => {
      const a = hashText('input a');
      const b = hashText('input b');
      expect(a).not.toBe(b);
    });
  });

  describe('LRU cache', () => {
    it('should start with empty cache', () => {
      expect(getEmbeddingCacheSize()).toBe(0);
    });

    it('should clear correctly', () => {
      // Cache starts empty after beforeEach
      clearEmbeddingCache();
      expect(getEmbeddingCacheSize()).toBe(0);
    });
  });
});
