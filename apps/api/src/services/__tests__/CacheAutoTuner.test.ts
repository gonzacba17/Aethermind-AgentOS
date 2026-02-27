/**
 * Tests for CacheAutoTuner evaluation logic.
 * Verifies suggestion generation without database access.
 */
import { evaluateCacheTuning } from '../CacheAutoTuner.js';

describe('CacheAutoTuner', () => {
  const baseInput = {
    hitRate: 0.25,
    badCacheRatings: 0,
    ratedCacheResponses: 50,
    currentThreshold: 0.90,
    hasEnoughRatings: true,
    avgCostPerRequest: 0.05,
    totalRequests: 1000,
    cacheHits: 250,
  };

  // ============================================
  // Case 1: Low hit rate → suggest lowering threshold
  // ============================================
  describe('low hit rate with near-misses', () => {
    it('suggests lowering threshold when hit rate < 10%', () => {
      const result = evaluateCacheTuning({
        ...baseInput,
        hitRate: 0.05,
        cacheHits: 50,
      });

      expect(result.suggestion).toBe('lower_threshold');
      expect(result.suggestedThreshold).toBe(0.85);
      expect(result.estimatedSavingsUsd).toBeDefined();
      expect(result.reason).toContain('5.0%');
    });

    it('suggests lowering threshold when hit rate is 0%', () => {
      const result = evaluateCacheTuning({
        ...baseInput,
        hitRate: 0,
        cacheHits: 0,
      });

      expect(result.suggestion).toBe('lower_threshold');
      expect(result.suggestedThreshold).toBe(0.85);
    });

    it('suggests lowering at exactly 9.9% hit rate', () => {
      const result = evaluateCacheTuning({
        ...baseInput,
        hitRate: 0.099,
        cacheHits: 99,
      });

      expect(result.suggestion).toBe('lower_threshold');
    });
  });

  // ============================================
  // Case 2: High hit rate with bad quality → suggest raising threshold
  // ============================================
  describe('high hit rate with bad quality ratings', () => {
    it('suggests raising threshold when > 5% of rated cache responses are bad', () => {
      const result = evaluateCacheTuning({
        ...baseInput,
        hitRate: 0.50,
        cacheHits: 500,
        ratedCacheResponses: 100,
        badCacheRatings: 8, // 8% bad
        hasEnoughRatings: true,
      });

      expect(result.suggestion).toBe('raise_threshold');
      expect(result.suggestedThreshold).toBe(0.95);
      expect(result.reason).toContain('8.0%');
    });

    it('suggests raising at high bad ratio (20%)', () => {
      const result = evaluateCacheTuning({
        ...baseInput,
        hitRate: 0.45,
        cacheHits: 450,
        ratedCacheResponses: 50,
        badCacheRatings: 10, // 20% bad
        hasEnoughRatings: true,
      });

      expect(result.suggestion).toBe('raise_threshold');
    });
  });

  // ============================================
  // Case 3: Stable — no change needed
  // ============================================
  describe('stable performance', () => {
    it('suggests no change when hit rate is 20-40% and quality is good', () => {
      const result = evaluateCacheTuning({
        ...baseInput,
        hitRate: 0.25,
        badCacheRatings: 1,
        ratedCacheResponses: 100,
        hasEnoughRatings: true,
      });

      expect(result.suggestion).toBe('no_change');
    });

    it('suggests no change at exactly 10% hit rate', () => {
      const result = evaluateCacheTuning({
        ...baseInput,
        hitRate: 0.10,
        cacheHits: 100,
      });

      expect(result.suggestion).toBe('no_change');
    });

    it('suggests no change when hit rate is high but bad ratio is low', () => {
      const result = evaluateCacheTuning({
        ...baseInput,
        hitRate: 0.50,
        cacheHits: 500,
        ratedCacheResponses: 100,
        badCacheRatings: 2, // 2% bad - below 5% threshold
        hasEnoughRatings: true,
      });

      expect(result.suggestion).toBe('no_change');
    });
  });

  // ============================================
  // Case 4: Majority of qualityRating is null → no spurious suggestions
  // ============================================
  describe('majority null qualityRating', () => {
    it('does not suggest raising threshold when ratings are mostly null', () => {
      const result = evaluateCacheTuning({
        ...baseInput,
        hitRate: 0.50,
        cacheHits: 500,
        ratedCacheResponses: 3, // very few rated
        badCacheRatings: 2,     // 66% bad of rated — but ratings are too sparse
        hasEnoughRatings: false, // < 10% have ratings
      });

      // Should not suggest raising based on sparse data
      expect(result.suggestion).toBe('no_change');
    });

    it('does not suggest any quality-based change when hasEnoughRatings is false', () => {
      const result = evaluateCacheTuning({
        ...baseInput,
        hitRate: 0.45, // high hit rate
        cacheHits: 450,
        ratedCacheResponses: 5,
        badCacheRatings: 4, // 80% bad — but sparse
        hasEnoughRatings: false,
      });

      expect(result.suggestion).toBe('no_change');
    });

    it('still suggests lowering threshold even without ratings (low hit rate)', () => {
      const result = evaluateCacheTuning({
        ...baseInput,
        hitRate: 0.03,
        cacheHits: 30,
        hasEnoughRatings: false,
      });

      // Low hit rate suggestion doesn't depend on quality ratings
      expect(result.suggestion).toBe('lower_threshold');
    });
  });
});
