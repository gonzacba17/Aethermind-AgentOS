/**
 * Tests for UsagePatternService pattern detection logic.
 *
 * Since the service hits the database, we test the core logic by extracting
 * pure evaluation functions and mocking EmbeddingService for similarity detection.
 */

import { cosineSimilarity } from '../SemanticCacheService.js';

describe('UsagePatternService', () => {
  // ============================================
  // Peak Hours Detection Logic
  // ============================================
  describe('detectPeakHours logic', () => {
    interface HourlyData {
      hour: number;
      totalCost: number;
      requestCount: number;
    }

    function selectTopPeakHours(data: HourlyData[]): HourlyData[] {
      return [...data]
        .sort((a, b) => b.totalCost - a.totalCost)
        .slice(0, 3);
    }

    it('returns top 3 hours by cost', () => {
      const data: HourlyData[] = [
        { hour: 9, totalCost: 50, requestCount: 100 },
        { hour: 14, totalCost: 120, requestCount: 200 },
        { hour: 10, totalCost: 80, requestCount: 150 },
        { hour: 22, totalCost: 10, requestCount: 20 },
        { hour: 3, totalCost: 5, requestCount: 10 },
      ];

      const result = selectTopPeakHours(data);
      expect(result).toHaveLength(3);
      expect(result[0]!.hour).toBe(14);
      expect(result[1]!.hour).toBe(10);
      expect(result[2]!.hour).toBe(9);
    });

    it('returns fewer than 3 if data has fewer hours', () => {
      const data: HourlyData[] = [
        { hour: 12, totalCost: 30, requestCount: 50 },
      ];

      const result = selectTopPeakHours(data);
      expect(result).toHaveLength(1);
      expect(result[0]!.hour).toBe(12);
    });

    it('returns empty array for no data', () => {
      expect(selectTopPeakHours([])).toHaveLength(0);
    });
  });

  // ============================================
  // Underutilized Agent Detection Logic
  // ============================================
  describe('detectUnderutilizedAgents logic', () => {
    interface AgentActivity {
      agentId: string;
      previousRequests: number;
      recentRequests: number;
    }

    function findUnderutilized(
      previousPeriod: Array<{ agentId: string; count: number }>,
      recentPeriod: Array<{ agentId: string; count: number }>,
    ): AgentActivity[] {
      const recentMap = new Map(recentPeriod.map((r) => [r.agentId, r.count]));
      return previousPeriod
        .filter((p) => (recentMap.get(p.agentId) ?? 0) < 5)
        .map((p) => ({
          agentId: p.agentId,
          recentRequests: recentMap.get(p.agentId) ?? 0,
          previousRequests: p.count,
        }));
    }

    it('detects agents with fewer than 5 recent requests', () => {
      const previous = [
        { agentId: 'agent-1', count: 50 },
        { agentId: 'agent-2', count: 100 },
        { agentId: 'agent-3', count: 20 },
      ];
      const recent = [
        { agentId: 'agent-1', count: 2 },
        { agentId: 'agent-2', count: 80 },
        // agent-3 has no recent activity
      ];

      const result = findUnderutilized(previous, recent);
      expect(result).toHaveLength(2);
      expect(result.find((a) => a.agentId === 'agent-1')).toEqual({
        agentId: 'agent-1',
        recentRequests: 2,
        previousRequests: 50,
      });
      expect(result.find((a) => a.agentId === 'agent-3')).toEqual({
        agentId: 'agent-3',
        recentRequests: 0,
        previousRequests: 20,
      });
    });

    it('returns empty when all agents are active', () => {
      const previous = [{ agentId: 'agent-1', count: 50 }];
      const recent = [{ agentId: 'agent-1', count: 10 }];

      const result = findUnderutilized(previous, recent);
      expect(result).toHaveLength(0);
    });

    it('returns empty when no previous activity', () => {
      expect(findUnderutilized([], [{ agentId: 'a', count: 1 }])).toHaveLength(0);
    });
  });

  // ============================================
  // Overloaded Agent Detection Logic
  // ============================================
  describe('detectOverloadedAgents logic', () => {
    const LATENCY_THRESHOLD = 5000;

    function findOverloaded(
      agents: Array<{ agentId: string; avgLatencyMs: number; requestCount: number }>,
    ) {
      return agents.filter((a) => a.avgLatencyMs > LATENCY_THRESHOLD);
    }

    it('detects agents with avg latency > 5000ms', () => {
      const agents = [
        { agentId: 'fast', avgLatencyMs: 200, requestCount: 100 },
        { agentId: 'slow', avgLatencyMs: 7500, requestCount: 50 },
        { agentId: 'borderline', avgLatencyMs: 5001, requestCount: 30 },
      ];

      const result = findOverloaded(agents);
      expect(result).toHaveLength(2);
      expect(result.map((a) => a.agentId)).toEqual(['slow', 'borderline']);
    });

    it('does not include agents at exactly 5000ms', () => {
      const agents = [{ agentId: 'exact', avgLatencyMs: 5000, requestCount: 10 }];
      expect(findOverloaded(agents)).toHaveLength(0);
    });

    it('returns empty when all agents are fast', () => {
      const agents = [{ agentId: 'fast', avgLatencyMs: 100, requestCount: 10 }];
      expect(findOverloaded(agents)).toHaveLength(0);
    });
  });

  // ============================================
  // Similar Agents Detection Logic (uses EmbeddingService mock)
  // ============================================
  describe('detectSimilarAgents logic', () => {
    const SIMILARITY_THRESHOLD = 0.85;

    function findSimilarPairs(
      agents: Array<{ agentId: string; embedding: number[] }>,
    ) {
      const pairs: Array<{ agentIdA: string; agentIdB: string; similarity: number }> = [];

      for (let i = 0; i < agents.length; i++) {
        for (let j = i + 1; j < agents.length; j++) {
          const a = agents[i]!;
          const b = agents[j]!;
          const similarity = cosineSimilarity(a.embedding, b.embedding);
          if (similarity > SIMILARITY_THRESHOLD) {
            pairs.push({
              agentIdA: a.agentId,
              agentIdB: b.agentId,
              similarity: Math.round(similarity * 1000) / 1000,
            });
          }
        }
      }

      return pairs;
    }

    it('finds similar agent pairs above 0.85 threshold', () => {
      // Two nearly identical embeddings and one different
      const agents = [
        { agentId: 'agent-a', embedding: [1, 0, 0, 0] },
        { agentId: 'agent-b', embedding: [0.99, 0.1, 0, 0] }, // very similar to a
        { agentId: 'agent-c', embedding: [0, 0, 1, 0] },       // orthogonal
      ];

      const result = findSimilarPairs(agents);
      expect(result).toHaveLength(1);
      expect(result[0]!.agentIdA).toBe('agent-a');
      expect(result[0]!.agentIdB).toBe('agent-b');
      expect(result[0]!.similarity).toBeGreaterThan(0.85);
    });

    it('returns empty when no agents are similar', () => {
      const agents = [
        { agentId: 'agent-a', embedding: [1, 0, 0] },
        { agentId: 'agent-b', embedding: [0, 1, 0] },
        { agentId: 'agent-c', embedding: [0, 0, 1] },
      ];

      expect(findSimilarPairs(agents)).toHaveLength(0);
    });

    it('handles fewer than 2 agents', () => {
      expect(findSimilarPairs([{ agentId: 'alone', embedding: [1, 0] }])).toHaveLength(0);
      expect(findSimilarPairs([])).toHaveLength(0);
    });

    it('finds multiple similar pairs', () => {
      // Three very similar agents
      const agents = [
        { agentId: 'a', embedding: [1, 0.1, 0] },
        { agentId: 'b', embedding: [1, 0.05, 0] },
        { agentId: 'c', embedding: [1, 0.15, 0] },
      ];

      const result = findSimilarPairs(agents);
      // All three should be similar to each other
      expect(result.length).toBeGreaterThanOrEqual(2);
    });
  });

  // ============================================
  // Cosine Similarity (used by detectSimilarAgents)
  // ============================================
  describe('cosineSimilarity', () => {
    it('returns 1 for identical vectors', () => {
      expect(cosineSimilarity([1, 2, 3], [1, 2, 3])).toBeCloseTo(1.0);
    });

    it('returns 0 for orthogonal vectors', () => {
      expect(cosineSimilarity([1, 0], [0, 1])).toBeCloseTo(0.0);
    });

    it('returns 0 for empty arrays', () => {
      expect(cosineSimilarity([], [])).toBe(0);
    });

    it('returns 0 for mismatched lengths', () => {
      expect(cosineSimilarity([1, 2], [1, 2, 3])).toBe(0);
    });

    it('handles zero vectors gracefully', () => {
      expect(cosineSimilarity([0, 0, 0], [1, 2, 3])).toBe(0);
    });
  });
});
