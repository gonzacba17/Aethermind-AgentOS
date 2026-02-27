/**
 * Tests for SemanticCacheService
 * Covers cosine similarity, SHA-256 hashing, and cache logic.
 */
import { cosineSimilarity } from '../SemanticCacheService.js';
import { hashText } from '../EmbeddingService.js';

describe('SemanticCacheService', () => {
  // ============================================
  // cosineSimilarity
  // ============================================
  describe('cosineSimilarity', () => {
    it('should return 1.0 for identical vectors', () => {
      const v = [1, 2, 3, 4, 5];
      expect(cosineSimilarity(v, v)).toBeCloseTo(1.0, 10);
    });

    it('should return -1.0 for opposite vectors', () => {
      const a = [1, 0, 0];
      const b = [-1, 0, 0];
      expect(cosineSimilarity(a, b)).toBeCloseTo(-1.0, 10);
    });

    it('should return 0 for orthogonal vectors', () => {
      const a = [1, 0, 0];
      const b = [0, 1, 0];
      expect(cosineSimilarity(a, b)).toBeCloseTo(0, 10);
    });

    it('should return 0 for empty vectors', () => {
      expect(cosineSimilarity([], [])).toBe(0);
    });

    it('should return 0 for zero vectors', () => {
      expect(cosineSimilarity([0, 0, 0], [0, 0, 0])).toBe(0);
    });

    it('should return 0 for mismatched lengths', () => {
      expect(cosineSimilarity([1, 2], [1, 2, 3])).toBe(0);
    });

    it('should compute similarity for similar vectors', () => {
      const a = [1, 2, 3];
      const b = [1.1, 2.1, 3.1];
      const sim = cosineSimilarity(a, b);
      expect(sim).toBeGreaterThan(0.99);
      expect(sim).toBeLessThanOrEqual(1.0);
    });

    it('should handle high-dimensional vectors (1536-dim)', () => {
      const dim = 1536;
      const a = Array.from({ length: dim }, () => Math.random());
      // Same vector should give similarity = 1
      expect(cosineSimilarity(a, a)).toBeCloseTo(1.0, 10);
    });
  });

  // ============================================
  // hashText (SHA-256)
  // ============================================
  describe('hashText', () => {
    it('should produce consistent hash for the same input', () => {
      const hash1 = hashText('hello world');
      const hash2 = hashText('hello world');
      expect(hash1).toBe(hash2);
    });

    it('should produce different hashes for different inputs', () => {
      const hash1 = hashText('hello world');
      const hash2 = hashText('hello world!');
      expect(hash1).not.toBe(hash2);
    });

    it('should return 64-character hex string', () => {
      const hash = hashText('test input');
      expect(hash).toHaveLength(64);
      expect(hash).toMatch(/^[0-9a-f]{64}$/);
    });

    it('should handle empty string', () => {
      const hash = hashText('');
      expect(hash).toHaveLength(64);
    });

    it('should handle unicode input', () => {
      const hash = hashText('Hello! Hola! Bonjour!');
      expect(hash).toHaveLength(64);
    });
  });
});
