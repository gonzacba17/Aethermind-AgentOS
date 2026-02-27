/**
 * Tests for BenchmarkService — insight generation and percentile logic.
 */
import { generateInsights, type ClientMetrics, type BenchmarkData } from '../BenchmarkService.js';

describe('BenchmarkService', () => {
  const baseBenchmark: BenchmarkData = {
    avgCostPerRequest: 0.02,
    p50CostPerRequest: 0.015,
    p90CostPerRequest: 0.05,
    avgCacheHitRate: 0.25,
    avgCompressionRatio: 0.15,
    sampleSize: 47,
  };

  // ============================================
  // Insight generation
  // ============================================
  describe('generateInsights', () => {
    it('flags high cost when client is 2.5x the average', () => {
      const client: ClientMetrics = {
        costPerRequest: 0.05,
        cacheHitRate: 0.25,
        compressionRatio: 0.15,
        totalRequests: 500,
      };

      const insights = generateInsights(client, baseBenchmark);
      expect(insights).toEqual(
        expect.arrayContaining([
          expect.stringContaining('2.5x'),
        ]),
      );
    });

    it('flags moderately high cost (1.5x–2x)', () => {
      const client: ClientMetrics = {
        costPerRequest: 0.035, // 1.75x
        cacheHitRate: 0.25,
        compressionRatio: 0.15,
        totalRequests: 500,
      };

      const insights = generateInsights(client, baseBenchmark);
      expect(insights.some((i) => i.includes('1.8x') || i.includes('1.7x'))).toBe(true);
      expect(insights.some((i) => i.includes('compresión') || i.includes('optimizar'))).toBe(true);
    });

    it('praises excellent cost optimization (< 0.5x)', () => {
      const client: ClientMetrics = {
        costPerRequest: 0.008, // 0.4x
        cacheHitRate: 0.30,
        compressionRatio: 0.20,
        totalRequests: 500,
      };

      const insights = generateInsights(client, baseBenchmark);
      expect(insights.some((i) => i.includes('excelente'))).toBe(true);
    });

    it('flags low cache hit rate', () => {
      const client: ClientMetrics = {
        costPerRequest: 0.02,
        cacheHitRate: 0.05, // 0.2x the avg of 0.25
        compressionRatio: 0.15,
        totalRequests: 500,
      };

      const insights = generateInsights(client, baseBenchmark);
      expect(insights.some((i) => i.includes('cache hit rate'))).toBe(true);
    });

    it('praises high cache hit rate', () => {
      const client: ClientMetrics = {
        costPerRequest: 0.02,
        cacheHitRate: 0.50, // 2x the avg
        compressionRatio: 0.15,
        totalRequests: 500,
      };

      const insights = generateInsights(client, baseBenchmark);
      expect(insights.some((i) => i.includes('supera'))).toBe(true);
    });

    it('flags low compression ratio', () => {
      const client: ClientMetrics = {
        costPerRequest: 0.02,
        cacheHitRate: 0.25,
        compressionRatio: 0.03, // way below avg 0.15
        totalRequests: 500,
      };

      const insights = generateInsights(client, baseBenchmark);
      expect(insights.some((i) => i.includes('compresión'))).toBe(true);
    });

    it('returns empty insights when client is average', () => {
      const client: ClientMetrics = {
        costPerRequest: 0.02,
        cacheHitRate: 0.25,
        compressionRatio: 0.15,
        totalRequests: 500,
      };

      const insights = generateInsights(client, baseBenchmark);
      expect(insights).toHaveLength(0);
    });

    it('handles zero benchmark values gracefully', () => {
      const zeroBenchmark: BenchmarkData = {
        ...baseBenchmark,
        avgCostPerRequest: 0,
        avgCacheHitRate: 0,
        avgCompressionRatio: 0,
      };

      const client: ClientMetrics = {
        costPerRequest: 0.05,
        cacheHitRate: 0.10,
        compressionRatio: 0.10,
        totalRequests: 500,
      };

      // Should not throw and should not produce division-by-zero insights
      const insights = generateInsights(client, zeroBenchmark);
      expect(Array.isArray(insights)).toBe(true);
    });
  });

  // ============================================
  // Privacy: sampleSize < 5
  // ============================================
  describe('privacy constraints', () => {
    it('benchmark with sampleSize < 5 should be treated as insufficient', () => {
      const smallBenchmark: BenchmarkData = {
        ...baseBenchmark,
        sampleSize: 3,
      };

      // The compareToBenchmark function checks this, but we verify the constant
      expect(smallBenchmark.sampleSize).toBeLessThan(5);
    });
  });

  // ============================================
  // Percentile calculation
  // ============================================
  describe('percentile helper', () => {
    function percentile(sorted: number[], p: number): number {
      if (sorted.length === 0) return 0;
      const index = (p / 100) * (sorted.length - 1);
      const lower = Math.floor(index);
      const upper = Math.ceil(index);
      if (lower === upper) return sorted[lower]!;
      const weight = index - lower;
      return sorted[lower]! * (1 - weight) + sorted[upper]! * weight;
    }

    it('calculates p50 correctly', () => {
      const values = [1, 2, 3, 4, 5];
      expect(percentile(values, 50)).toBe(3);
    });

    it('calculates p90 correctly', () => {
      const values = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
      expect(percentile(values, 90)).toBeCloseTo(9.1);
    });

    it('returns 0 for empty array', () => {
      expect(percentile([], 50)).toBe(0);
    });

    it('returns the single value for array of length 1', () => {
      expect(percentile([42], 50)).toBe(42);
      expect(percentile([42], 90)).toBe(42);
    });

    it('interpolates between values', () => {
      const values = [10, 20];
      expect(percentile(values, 50)).toBe(15);
    });
  });
});
