/**
 * Usage Pattern Analyzer
 *
 * Analyzes LLM API usage patterns to identify optimization opportunities,
 * detect anomalies, and generate actionable insights.
 */

import { z } from 'zod';
import { CostCalculator, UsageRecord } from './cost-calculator.js';
import logger from '../utils/logger.js';

/**
 * Time bucket for aggregation
 */
export type TimeBucket = 'hour' | 'day' | 'week' | 'month';

/**
 * Usage pattern types that can be detected
 */
export type PatternType =
  | 'high_cost_model_overuse'
  | 'low_utilization'
  | 'burst_traffic'
  | 'consistent_high_output'
  | 'inefficient_retries'
  | 'cost_spike'
  | 'model_mismatch';

/**
 * Detected usage pattern
 */
export interface DetectedPattern {
  type: PatternType;
  severity: 'low' | 'medium' | 'high';
  description: string;
  evidence: Record<string, unknown>;
  recommendation: string;
  potentialSavings?: number;
  affectedModel?: string;
  timeRange?: { start: Date; end: Date };
}

/**
 * Usage statistics by model
 */
export interface ModelStats {
  model: string;
  requestCount: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCost: number;
  averageInputTokens: number;
  averageOutputTokens: number;
  averageLatency?: number;
  errorRate: number;
  peakHour?: number;
}

/**
 * Time-series usage data point
 */
export interface UsageDataPoint {
  timestamp: Date;
  requestCount: number;
  totalTokens: number;
  totalCost: number;
  models: string[];
}

/**
 * Analysis result
 */
export interface AnalysisResult {
  period: { start: Date; end: Date };
  totalRequests: number;
  totalCost: number;
  totalTokens: number;
  modelStats: ModelStats[];
  patterns: DetectedPattern[];
  timeSeries: UsageDataPoint[];
  recommendations: string[];
}

/**
 * Usage Pattern Analyzer Class
 */
export class UsageAnalyzer {
  private costCalculator: CostCalculator;

  // Thresholds for pattern detection
  private thresholds = {
    highCostModelOverusePercent: 30, // 30%+ of requests on premium models
    lowUtilizationTokens: 100,       // Average < 100 tokens per request
    burstTrafficMultiplier: 3,       // 3x normal traffic
    highOutputRatio: 5,              // Output 5x+ input
    errorRateThreshold: 0.1,         // 10%+ error rate
    costSpikeMultiplier: 2,          // 2x average cost
  };

  constructor(costCalculator?: CostCalculator) {
    this.costCalculator = costCalculator || new CostCalculator();
  }

  /**
   * Analyze usage records and generate insights
   */
  analyze(
    records: UsageRecord[],
    options: {
      timeBucket?: TimeBucket;
      detectPatterns?: boolean;
    } = {}
  ): AnalysisResult {
    const { timeBucket = 'day', detectPatterns = true } = options;

    if (records.length === 0) {
      return this.emptyResult();
    }

    // Sort by timestamp
    const sorted = [...records].sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    const period = {
      start: new Date(sorted[0]!.timestamp),
      end: new Date(sorted[sorted.length - 1]!.timestamp),
    };

    // Calculate model statistics
    const modelStats = this.calculateModelStats(records);

    // Generate time series
    const timeSeries = this.generateTimeSeries(records, timeBucket);

    // Calculate totals
    const totalRequests = records.length;
    const totalCost = modelStats.reduce((sum, s) => sum + s.totalCost, 0);
    const totalTokens = modelStats.reduce(
      (sum, s) => sum + s.totalInputTokens + s.totalOutputTokens,
      0
    );

    // Detect patterns
    const patterns = detectPatterns
      ? this.detectPatterns(records, modelStats, timeSeries)
      : [];

    // Generate recommendations
    const recommendations = this.generateRecommendations(patterns, modelStats);

    return {
      period,
      totalRequests,
      totalCost,
      totalTokens,
      modelStats,
      patterns,
      timeSeries,
      recommendations,
    };
  }

  /**
   * Calculate statistics per model
   */
  private calculateModelStats(records: UsageRecord[]): ModelStats[] {
    const statsByModel = new Map<string, {
      requests: UsageRecord[];
      errors: number;
    }>();

    for (const record of records) {
      const entry = statsByModel.get(record.model) || { requests: [], errors: 0 };
      entry.requests.push(record);
      if ((record.metadata as any)?.status === 'error') {
        entry.errors++;
      }
      statsByModel.set(record.model, entry);
    }

    return Array.from(statsByModel.entries()).map(([model, { requests, errors }]) => {
      const costs = requests.map(r => this.costCalculator.calculateCost(r));
      const totalCost = costs.reduce((sum, c) => sum + c.totalCost, 0);
      const totalInput = requests.reduce((sum, r) => sum + r.inputTokens, 0);
      const totalOutput = requests.reduce((sum, r) => sum + r.outputTokens, 0);

      // Find peak hour
      const hourCounts = new Map<number, number>();
      for (const r of requests) {
        const hour = new Date(r.timestamp).getHours();
        hourCounts.set(hour, (hourCounts.get(hour) || 0) + 1);
      }
      let peakHour: number | undefined;
      let maxCount = 0;
      for (const [hour, count] of hourCounts) {
        if (count > maxCount) {
          maxCount = count;
          peakHour = hour;
        }
      }

      return {
        model,
        requestCount: requests.length,
        totalInputTokens: totalInput,
        totalOutputTokens: totalOutput,
        totalCost,
        averageInputTokens: totalInput / requests.length,
        averageOutputTokens: totalOutput / requests.length,
        errorRate: errors / requests.length,
        peakHour,
      };
    }).sort((a, b) => b.totalCost - a.totalCost);
  }

  /**
   * Generate time series data
   */
  private generateTimeSeries(
    records: UsageRecord[],
    bucket: TimeBucket
  ): UsageDataPoint[] {
    const buckets = new Map<string, {
      requests: UsageRecord[];
      timestamp: Date;
    }>();

    for (const record of records) {
      const date = new Date(record.timestamp);
      const key = this.getBucketKey(date, bucket);

      const entry = buckets.get(key) || {
        requests: [],
        timestamp: this.getBucketTimestamp(date, bucket),
      };
      entry.requests.push(record);
      buckets.set(key, entry);
    }

    return Array.from(buckets.values())
      .map(({ requests, timestamp }) => ({
        timestamp,
        requestCount: requests.length,
        totalTokens: requests.reduce(
          (sum, r) => sum + r.inputTokens + r.outputTokens,
          0
        ),
        totalCost: requests.reduce((sum, r) => {
          const cost = this.costCalculator.calculateCost(r);
          return sum + cost.totalCost;
        }, 0),
        models: [...new Set(requests.map(r => r.model))],
      }))
      .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  }

  /**
   * Detect usage patterns
   */
  private detectPatterns(
    records: UsageRecord[],
    modelStats: ModelStats[],
    timeSeries: UsageDataPoint[]
  ): DetectedPattern[] {
    const patterns: DetectedPattern[] = [];

    // Pattern 1: High-cost model overuse
    const premiumModels = modelStats.filter(
      s => this.costCalculator.getModelPricing(s.model)?.tier === 'premium'
    );
    const premiumPercent = (premiumModels.reduce((s, m) => s + m.requestCount, 0) / records.length) * 100;

    if (premiumPercent > this.thresholds.highCostModelOverusePercent) {
      const cheaperAlternatives = this.costCalculator.getAvailableModels()
        .filter(m => m.pricing.tier === 'budget' || m.pricing.tier === 'standard');

      patterns.push({
        type: 'high_cost_model_overuse',
        severity: premiumPercent > 50 ? 'high' : 'medium',
        description: `${premiumPercent.toFixed(1)}% of requests use premium models`,
        evidence: {
          premiumPercent,
          premiumModels: premiumModels.map(m => m.model),
        },
        recommendation: `Consider using ${cheaperAlternatives[0]?.model || 'cheaper models'} for routine tasks`,
        potentialSavings: premiumModels.reduce((s, m) => s + m.totalCost, 0) * 0.5,
      });
    }

    // Pattern 2: Low token utilization
    for (const stat of modelStats) {
      if (stat.averageInputTokens < this.thresholds.lowUtilizationTokens) {
        patterns.push({
          type: 'low_utilization',
          severity: 'low',
          description: `Model ${stat.model} has low average input (${stat.averageInputTokens.toFixed(0)} tokens)`,
          evidence: {
            averageTokens: stat.averageInputTokens,
            requestCount: stat.requestCount,
          },
          recommendation: 'Consider batching requests or using a smaller model',
          affectedModel: stat.model,
        });
      }
    }

    // Pattern 3: Burst traffic detection
    if (timeSeries.length > 3) {
      const avgRequests = timeSeries.reduce((s, t) => s + t.requestCount, 0) / timeSeries.length;
      const bursts = timeSeries.filter(
        t => t.requestCount > avgRequests * this.thresholds.burstTrafficMultiplier
      );

      for (const burst of bursts) {
        patterns.push({
          type: 'burst_traffic',
          severity: burst.requestCount > avgRequests * 5 ? 'high' : 'medium',
          description: `Traffic spike detected: ${burst.requestCount} requests (${(burst.requestCount / avgRequests).toFixed(1)}x average)`,
          evidence: {
            burstRequests: burst.requestCount,
            averageRequests: avgRequests,
            timestamp: burst.timestamp,
          },
          recommendation: 'Consider implementing request queuing or rate limiting',
          timeRange: { start: burst.timestamp, end: burst.timestamp },
        });
      }
    }

    // Pattern 4: High output ratio (might indicate verbose responses)
    for (const stat of modelStats) {
      const outputRatio = stat.averageOutputTokens / stat.averageInputTokens;
      if (outputRatio > this.thresholds.highOutputRatio && stat.requestCount > 10) {
        patterns.push({
          type: 'consistent_high_output',
          severity: 'medium',
          description: `Model ${stat.model} has high output ratio (${outputRatio.toFixed(1)}x input)`,
          evidence: {
            outputRatio,
            averageOutput: stat.averageOutputTokens,
          },
          recommendation: 'Consider adding max_tokens limit or optimizing prompts for conciseness',
          affectedModel: stat.model,
          potentialSavings: stat.totalCost * 0.2,
        });
      }
    }

    // Pattern 5: High error rate
    for (const stat of modelStats) {
      if (stat.errorRate > this.thresholds.errorRateThreshold && stat.requestCount > 5) {
        patterns.push({
          type: 'inefficient_retries',
          severity: stat.errorRate > 0.25 ? 'high' : 'medium',
          description: `Model ${stat.model} has ${(stat.errorRate * 100).toFixed(1)}% error rate`,
          evidence: {
            errorRate: stat.errorRate,
            totalRequests: stat.requestCount,
          },
          recommendation: 'Review error handling and retry logic',
          affectedModel: stat.model,
        });
      }
    }

    // Pattern 6: Cost spikes
    if (timeSeries.length > 5) {
      const avgCost = timeSeries.reduce((s, t) => s + t.totalCost, 0) / timeSeries.length;
      const spikes = timeSeries.filter(
        t => t.totalCost > avgCost * this.thresholds.costSpikeMultiplier
      );

      if (spikes.length > 0) {
        patterns.push({
          type: 'cost_spike',
          severity: 'high',
          description: `${spikes.length} cost spike(s) detected (>${(this.thresholds.costSpikeMultiplier * 100).toFixed(0)}% of average)`,
          evidence: {
            spikePeriods: spikes.map(s => ({
              timestamp: s.timestamp,
              cost: s.totalCost,
            })),
            averageCost: avgCost,
          },
          recommendation: 'Investigate unusual activity during spike periods',
        });
      }
    }

    return patterns;
  }

  /**
   * Generate actionable recommendations
   */
  private generateRecommendations(
    patterns: DetectedPattern[],
    modelStats: ModelStats[]
  ): string[] {
    const recommendations: string[] = [];

    // Add pattern-specific recommendations
    for (const pattern of patterns) {
      if (pattern.potentialSavings && pattern.potentialSavings > 10) {
        recommendations.push(
          `[${pattern.severity.toUpperCase()}] ${pattern.recommendation} - Potential savings: $${pattern.potentialSavings.toFixed(2)}`
        );
      } else {
        recommendations.push(`[${pattern.severity.toUpperCase()}] ${pattern.recommendation}`);
      }
    }

    // Add model-specific recommendations
    const topCostModel = modelStats[0];
    if (topCostModel && modelStats.length > 1) {
      const costPercentage = (topCostModel.totalCost / modelStats.reduce((s, m) => s + m.totalCost, 0)) * 100;
      if (costPercentage > 60) {
        recommendations.push(
          `Consider diversifying model usage - ${topCostModel.model} accounts for ${costPercentage.toFixed(1)}% of costs`
        );
      }
    }

    return recommendations;
  }

  /**
   * Get bucket key for time series grouping
   */
  private getBucketKey(date: Date, bucket: TimeBucket): string {
    const d = new Date(date);
    switch (bucket) {
      case 'hour':
        return `${d.toISOString().split(':')[0]!}`;
      case 'day':
        return d.toISOString().split('T')[0]!;
      case 'week':
        const weekStart = new Date(d);
        weekStart.setDate(d.getDate() - d.getDay());
        return weekStart.toISOString().split('T')[0]!;
      case 'month':
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    }
  }

  /**
   * Get bucket timestamp
   */
  private getBucketTimestamp(date: Date, bucket: TimeBucket): Date {
    const d = new Date(date);
    switch (bucket) {
      case 'hour':
        d.setMinutes(0, 0, 0);
        return d;
      case 'day':
        d.setHours(0, 0, 0, 0);
        return d;
      case 'week':
        d.setDate(d.getDate() - d.getDay());
        d.setHours(0, 0, 0, 0);
        return d;
      case 'month':
        d.setDate(1);
        d.setHours(0, 0, 0, 0);
        return d;
    }
  }

  /**
   * Return empty result
   */
  private emptyResult(): AnalysisResult {
    return {
      period: { start: new Date(), end: new Date() },
      totalRequests: 0,
      totalCost: 0,
      totalTokens: 0,
      modelStats: [],
      patterns: [],
      timeSeries: [],
      recommendations: [],
    };
  }
}

// Export singleton instance
export const usageAnalyzer = new UsageAnalyzer();
