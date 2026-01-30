/**
 * Feature Extraction for ML-based Cost Forecasting
 *
 * Extracts and transforms usage data into features suitable for
 * time-series forecasting and anomaly detection.
 */

import { z } from 'zod';
import logger from '../utils/logger.js';

/**
 * Raw usage record from telemetry
 */
export interface RawUsageRecord {
  timestamp: Date;
  model: string;
  provider: string;
  inputTokens: number;
  outputTokens: number;
  cost: number;
  latency: number;
  status: 'success' | 'error';
  organizationId: string;
  agentId?: string;
  workflowId?: string;
}

/**
 * Extracted features for a time window
 */
export interface TimeWindowFeatures {
  windowStart: Date;
  windowEnd: Date;

  // Volume features
  requestCount: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCost: number;

  // Statistical features
  avgCostPerRequest: number;
  avgTokensPerRequest: number;
  avgLatency: number;
  errorRate: number;

  // Model distribution features
  modelDistribution: Map<string, number>;
  topModel: string;
  topModelPercent: number;
  uniqueModels: number;

  // Temporal features
  hourOfDay: number;
  dayOfWeek: number;
  isWeekend: boolean;
  isBusinessHours: boolean;

  // Trend features
  requestTrend: number; // -1 to 1 (decreasing to increasing)
  costTrend: number;

  // Variability features
  costVariance: number;
  requestVariance: number;

  // Agent/workflow features
  uniqueAgents: number;
  uniqueWorkflows: number;
}

/**
 * Feature vector for ML models
 */
export interface FeatureVector {
  timestamp: Date;
  features: number[];
  featureNames: string[];
  metadata: Record<string, unknown>;
}

/**
 * Seasonal component
 */
export interface SeasonalPattern {
  hourly: number[]; // 24 values
  daily: number[]; // 7 values
  weekly: number[]; // 52 values (optional)
}

/**
 * Feature Extractor Configuration
 */
export interface FeatureExtractorConfig {
  windowSizeMinutes: number;
  slidingWindowStep: number;
  minRecordsPerWindow: number;
  businessHoursStart: number;
  businessHoursEnd: number;
  seasonalAnalysisEnabled: boolean;
}

const DEFAULT_CONFIG: FeatureExtractorConfig = {
  windowSizeMinutes: 60, // 1 hour windows
  slidingWindowStep: 60, // No overlap by default
  minRecordsPerWindow: 1,
  businessHoursStart: 9,
  businessHoursEnd: 17,
  seasonalAnalysisEnabled: true,
};

/**
 * Feature Extractor Class
 */
export class FeatureExtractor {
  private config: FeatureExtractorConfig;

  constructor(config: Partial<FeatureExtractorConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Extract features from raw usage records
   */
  extractFeatures(records: RawUsageRecord[]): TimeWindowFeatures[] {
    if (records.length === 0) {
      return [];
    }

    // Sort by timestamp
    const sorted = [...records].sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    if (sorted.length === 0) {
      return [];
    }

    const startTime = new Date(sorted[0]!.timestamp).getTime();
    const endTime = new Date(sorted[sorted.length - 1]!.timestamp).getTime();
    const windowMs = this.config.windowSizeMinutes * 60 * 1000;
    const stepMs = this.config.slidingWindowStep * 60 * 1000;

    const features: TimeWindowFeatures[] = [];
    let windowStart = startTime;

    while (windowStart <= endTime) {
      const windowEnd = windowStart + windowMs;
      const windowRecords = sorted.filter(r => {
        const ts = new Date(r.timestamp).getTime();
        return ts >= windowStart && ts < windowEnd;
      });

      if (windowRecords.length >= this.config.minRecordsPerWindow) {
        const windowFeatures = this.extractWindowFeatures(
          windowRecords,
          new Date(windowStart),
          new Date(windowEnd),
          features.length > 0 ? features[features.length - 1]! : null
        );
        features.push(windowFeatures);
      }

      windowStart += stepMs;
    }

    return features;
  }

  /**
   * Extract features for a single time window
   */
  private extractWindowFeatures(
    records: RawUsageRecord[],
    windowStart: Date,
    windowEnd: Date,
    previousWindow: TimeWindowFeatures | null
  ): TimeWindowFeatures {
    // Volume features
    const requestCount = records.length;
    const totalInputTokens = records.reduce((sum, r) => sum + r.inputTokens, 0);
    const totalOutputTokens = records.reduce((sum, r) => sum + r.outputTokens, 0);
    const totalCost = records.reduce((sum, r) => sum + r.cost, 0);

    // Statistical features
    const avgCostPerRequest = requestCount > 0 ? totalCost / requestCount : 0;
    const avgTokensPerRequest = requestCount > 0
      ? (totalInputTokens + totalOutputTokens) / requestCount
      : 0;
    const avgLatency = requestCount > 0
      ? records.reduce((sum, r) => sum + r.latency, 0) / requestCount
      : 0;
    const errorCount = records.filter(r => r.status === 'error').length;
    const errorRate = requestCount > 0 ? errorCount / requestCount : 0;

    // Model distribution
    const modelDistribution = new Map<string, number>();
    for (const r of records) {
      modelDistribution.set(r.model, (modelDistribution.get(r.model) || 0) + 1);
    }

    let topModel = '';
    let topModelCount = 0;
    for (const [model, count] of modelDistribution) {
      if (count > topModelCount) {
        topModel = model;
        topModelCount = count;
      }
    }
    const topModelPercent = requestCount > 0 ? topModelCount / requestCount : 0;

    // Temporal features
    const midWindowTime = new Date((windowStart.getTime() + windowEnd.getTime()) / 2);
    const hourOfDay = midWindowTime.getHours();
    const dayOfWeek = midWindowTime.getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    const isBusinessHours =
      hourOfDay >= this.config.businessHoursStart &&
      hourOfDay < this.config.businessHoursEnd &&
      !isWeekend;

    // Trend features (compared to previous window)
    let requestTrend = 0;
    let costTrend = 0;
    if (previousWindow) {
      const prevRequests = previousWindow.requestCount || 1;
      const prevCost = previousWindow.totalCost || 0.001;
      requestTrend = Math.tanh((requestCount - prevRequests) / prevRequests);
      costTrend = Math.tanh((totalCost - prevCost) / (prevCost + 0.001));
    }

    // Variability features
    const costs = records.map(r => r.cost);
    const costVariance = this.calculateVariance(costs);
    const requestsPerMinute = this.calculateRequestsPerMinute(records, windowStart, windowEnd);
    const requestVariance = this.calculateVariance(requestsPerMinute);

    // Agent/workflow features
    const uniqueAgents = new Set(records.filter(r => r.agentId).map(r => r.agentId)).size;
    const uniqueWorkflows = new Set(records.filter(r => r.workflowId).map(r => r.workflowId)).size;

    return {
      windowStart,
      windowEnd,
      requestCount,
      totalInputTokens,
      totalOutputTokens,
      totalCost,
      avgCostPerRequest,
      avgTokensPerRequest,
      avgLatency,
      errorRate,
      modelDistribution,
      topModel,
      topModelPercent,
      uniqueModels: modelDistribution.size,
      hourOfDay,
      dayOfWeek,
      isWeekend,
      isBusinessHours,
      requestTrend,
      costTrend,
      costVariance,
      requestVariance,
      uniqueAgents,
      uniqueWorkflows,
    };
  }

  /**
   * Convert features to a numeric vector for ML models
   */
  toFeatureVector(features: TimeWindowFeatures): FeatureVector {
    const featureNames = [
      'requestCount',
      'totalInputTokens',
      'totalOutputTokens',
      'totalCost',
      'avgCostPerRequest',
      'avgTokensPerRequest',
      'avgLatency',
      'errorRate',
      'topModelPercent',
      'uniqueModels',
      'hourOfDay_sin',
      'hourOfDay_cos',
      'dayOfWeek_sin',
      'dayOfWeek_cos',
      'isWeekend',
      'isBusinessHours',
      'requestTrend',
      'costTrend',
      'costVariance',
      'requestVariance',
      'uniqueAgents',
      'uniqueWorkflows',
    ];

    // Encode cyclical features using sin/cos
    const hourRad = (features.hourOfDay / 24) * 2 * Math.PI;
    const dayRad = (features.dayOfWeek / 7) * 2 * Math.PI;

    const featureValues = [
      features.requestCount,
      features.totalInputTokens,
      features.totalOutputTokens,
      features.totalCost,
      features.avgCostPerRequest,
      features.avgTokensPerRequest,
      features.avgLatency,
      features.errorRate,
      features.topModelPercent,
      features.uniqueModels,
      Math.sin(hourRad),
      Math.cos(hourRad),
      Math.sin(dayRad),
      Math.cos(dayRad),
      features.isWeekend ? 1 : 0,
      features.isBusinessHours ? 1 : 0,
      features.requestTrend,
      features.costTrend,
      features.costVariance,
      features.requestVariance,
      features.uniqueAgents,
      features.uniqueWorkflows,
    ];

    return {
      timestamp: features.windowStart,
      features: featureValues,
      featureNames,
      metadata: {
        windowEnd: features.windowEnd,
        topModel: features.topModel,
      },
    };
  }

  /**
   * Extract seasonal patterns from historical data
   */
  extractSeasonalPatterns(features: TimeWindowFeatures[]): SeasonalPattern {
    const hourly = new Array(24).fill(0);
    const hourlyCounts = new Array(24).fill(0);
    const daily = new Array(7).fill(0);
    const dailyCounts = new Array(7).fill(0);

    for (const f of features) {
      hourly[f.hourOfDay] += f.totalCost;
      hourlyCounts[f.hourOfDay]++;
      daily[f.dayOfWeek] += f.totalCost;
      dailyCounts[f.dayOfWeek]++;
    }

    // Normalize to get average patterns
    for (let i = 0; i < 24; i++) {
      hourly[i] = hourlyCounts[i] > 0 ? hourly[i] / hourlyCounts[i] : 0;
    }
    for (let i = 0; i < 7; i++) {
      daily[i] = dailyCounts[i] > 0 ? daily[i] / dailyCounts[i] : 0;
    }

    // Normalize to percentages (sum to 1)
    const hourlySum = hourly.reduce((a, b) => a + b, 0) || 1;
    const dailySum = daily.reduce((a, b) => a + b, 0) || 1;

    return {
      hourly: hourly.map(v => v / hourlySum),
      daily: daily.map(v => v / dailySum),
      weekly: [], // Could be added with more historical data
    };
  }

  /**
   * Normalize features for ML model input
   */
  normalizeFeatures(
    features: TimeWindowFeatures[],
    stats?: { means: number[]; stds: number[] }
  ): { normalized: FeatureVector[]; stats: { means: number[]; stds: number[] } } {
    const vectors = features.map(f => this.toFeatureVector(f));

    if (vectors.length === 0) {
      return {
        normalized: [],
        stats: { means: [], stds: [] }
      };
    }

    const numFeatures = vectors[0]!.features.length;

    // Calculate or use provided stats
    let means: number[];
    let stds: number[];

    if (stats) {
      means = stats.means;
      stds = stats.stds;
    } else {
      means = new Array(numFeatures).fill(0) as number[];
      stds = new Array(numFeatures).fill(0) as number[];

      // Calculate means
      for (const v of vectors) {
        for (let i = 0; i < numFeatures; i++) {
          means[i] = (means[i] ?? 0) + (v.features[i] ?? 0);
        }
      }
      for (let i = 0; i < numFeatures; i++) {
        means[i] = (means[i] ?? 0) / vectors.length;
      }

      // Calculate standard deviations
      for (const v of vectors) {
        for (let i = 0; i < numFeatures; i++) {
          stds[i] = (stds[i] ?? 0) + Math.pow((v.features[i] ?? 0) - (means[i] ?? 0), 2);
        }
      }
      for (let i = 0; i < numFeatures; i++) {
        stds[i] = Math.sqrt((stds[i] ?? 0) / vectors.length) || 1; // Avoid division by zero
      }
    }

    // Normalize
    const normalized = vectors.map(v => ({
      ...v,
      features: v.features.map((f, i) => (f - (means[i] ?? 0)) / (stds[i] ?? 1)),
    }));

    return { normalized, stats: { means, stds } };
  }

  /**
   * Calculate variance of an array
   */
  private calculateVariance(values: number[]): number {
    if (values.length === 0) return 0;
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const squaredDiffs = values.map(v => Math.pow(v - mean, 2));
    return squaredDiffs.reduce((a, b) => a + b, 0) / values.length;
  }

  /**
   * Calculate requests per minute within a window
   */
  private calculateRequestsPerMinute(
    records: RawUsageRecord[],
    windowStart: Date,
    windowEnd: Date
  ): number[] {
    const durationMs = windowEnd.getTime() - windowStart.getTime();
    const numMinutes = Math.ceil(durationMs / 60000);
    const requestsPerMinute = new Array(numMinutes).fill(0);

    for (const r of records) {
      const minuteIndex = Math.floor(
        (new Date(r.timestamp).getTime() - windowStart.getTime()) / 60000
      );
      if (minuteIndex >= 0 && minuteIndex < numMinutes) {
        requestsPerMinute[minuteIndex]++;
      }
    }

    return requestsPerMinute;
  }

  /**
   * Get configuration
   */
  getConfig(): FeatureExtractorConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  updateConfig(updates: Partial<FeatureExtractorConfig>): void {
    this.config = { ...this.config, ...updates };
  }
}

// Export singleton instance
export const featureExtractor = new FeatureExtractor();
