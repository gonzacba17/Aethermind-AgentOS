/**
 * Tests for RoutingAutoTuner evaluation logic.
 * Verifies suggestion generation without database access.
 */
import { evaluateRoutingPair, type RoutingPairStats } from '../RoutingAutoTuner.js';

describe('RoutingAutoTuner', () => {
  const baseStats: RoutingPairStats = {
    originalModel: 'gpt-4o',
    routedModel: 'gpt-4o-mini',
    totalRated: 50,
    goodCount: 40,
    badCount: 3,
    totalCount: 200,
    totalCost: 100,
    avgCostSaved: 0.05,
  };

  // ============================================
  // Case 1: Routing with bad quality → suggest revert
  // ============================================
  describe('routing with bad quality', () => {
    it('suggests reverting when > 10% of rated responses are bad', () => {
      const result = evaluateRoutingPair({
        ...baseStats,
        totalRated: 50,
        badCount: 8, // 16% bad
        goodCount: 42,
      });

      expect(result.suggestion).toBe('revert_routing');
      expect(result.badRatio).toBeGreaterThan(0.10);
      expect(result.reason).toContain('gpt-4o');
      expect(result.reason).toContain('gpt-4o-mini');
    });

    it('suggests reverting at exactly 11% bad ratio', () => {
      const result = evaluateRoutingPair({
        ...baseStats,
        totalRated: 100,
        badCount: 11,
        goodCount: 89,
        totalCount: 500,
      });

      expect(result.suggestion).toBe('revert_routing');
    });

    it('suggests reverting with high bad ratio (50%)', () => {
      const result = evaluateRoutingPair({
        ...baseStats,
        totalRated: 40,
        badCount: 20,
        goodCount: 20,
        totalCount: 200,
      });

      expect(result.suggestion).toBe('revert_routing');
      expect(result.badRatio).toBe(0.5);
    });
  });

  // ============================================
  // Case 2: Successful routing → suggest extending
  // ============================================
  describe('successful routing (extensible)', () => {
    it('suggests extending when > 90% good and saves > $10/month', () => {
      const result = evaluateRoutingPair({
        ...baseStats,
        totalRated: 100,
        goodCount: 95, // 95% good
        badCount: 2,
        totalCount: 500,
        totalCost: 200, // $200 in 14 days → ~$428/month
      });

      expect(result.suggestion).toBe('extend_routing');
      expect(result.goodRatio).toBeGreaterThan(0.90);
      expect(result.monthlySavings).toBeGreaterThan(10);
      expect(result.estimatedSavingsUsd).toBeDefined();
    });

    it('does not suggest extending if savings < $10/month', () => {
      const result = evaluateRoutingPair({
        ...baseStats,
        totalRated: 50,
        goodCount: 48, // 96% good
        badCount: 0,
        totalCount: 200,
        totalCost: 3, // $3 in 14 days → ~$6.43/month — below threshold
      });

      expect(result.suggestion).toBe('no_change');
    });
  });

  // ============================================
  // Case 3: No change needed
  // ============================================
  describe('acceptable performance', () => {
    it('suggests no change when bad ratio is acceptable and good ratio is moderate', () => {
      const result = evaluateRoutingPair({
        ...baseStats,
        totalRated: 50,
        badCount: 3, // 6% bad
        goodCount: 30, // 60% good
        totalCount: 200,
        totalCost: 50,
      });

      expect(result.suggestion).toBe('no_change');
    });

    it('suggests no change at exactly 10% bad ratio', () => {
      const result = evaluateRoutingPair({
        ...baseStats,
        totalRated: 100,
        badCount: 10, // exactly 10%
        goodCount: 90,
        totalCount: 500,
      });

      expect(result.suggestion).toBe('no_change');
    });
  });

  // ============================================
  // Case 4: Insufficient ratings → no suggestion
  // ============================================
  describe('insufficient data', () => {
    it('suggests no change when fewer than 10 rated responses', () => {
      const result = evaluateRoutingPair({
        ...baseStats,
        totalRated: 5,
        badCount: 3, // 60% bad — but too few samples
        goodCount: 2,
      });

      expect(result.suggestion).toBe('no_change');
      expect(result.reason).toContain('Insufficient');
    });

    it('suggests no change when rated ratio is below 10%', () => {
      const result = evaluateRoutingPair({
        ...baseStats,
        totalRated: 15, // > 10 rated
        badCount: 10,
        goodCount: 5,
        totalCount: 500, // but 15/500 = 3% rated ratio
      });

      expect(result.suggestion).toBe('no_change');
      expect(result.reason).toContain('Insufficient');
    });
  });

  // ============================================
  // Case 5: Majority null qualityRating → no spurious suggestions
  // ============================================
  describe('majority null qualityRating', () => {
    it('does not generate suggestions when most ratings are null', () => {
      const result = evaluateRoutingPair({
        ...baseStats,
        totalRated: 8, // below MIN_RATED_FOR_SUGGESTION
        badCount: 5,
        goodCount: 3,
        totalCount: 1000, // vast majority unrated
      });

      expect(result.suggestion).toBe('no_change');
    });

    it('handles zero rated responses gracefully', () => {
      const result = evaluateRoutingPair({
        ...baseStats,
        totalRated: 0,
        badCount: 0,
        goodCount: 0,
        totalCount: 100,
      });

      expect(result.suggestion).toBe('no_change');
    });
  });
});
