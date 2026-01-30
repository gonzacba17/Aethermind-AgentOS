/**
 * Pattern Detection and Anomaly Detection
 *
 * Uses statistical methods to detect unusual patterns,
 * anomalies, and trends in usage data.
 */

import { z } from 'zod';
import {
  FeatureExtractor,
  TimeWindowFeatures,
  FeatureVector,
  SeasonalPattern,
  featureExtractor,
} from './features.js';
import logger from '../utils/logger.js';

/**
 * Anomaly types
 */
export type AnomalyType =
  | 'cost_spike'
  | 'cost_drop'
  | 'usage_surge'
  | 'usage_drop'
  | 'latency_spike'
  | 'error_rate_spike'
  | 'unusual_model_usage'
  | 'off_hours_activity'
  | 'trend_break';

/**
 * Severity levels
 */
export type AnomalySeverity = 'low' | 'medium' | 'high' | 'critical';

/**
 * Detected anomaly
 */
export interface DetectedAnomaly {
  id: string;
  type: AnomalyType;
  severity: AnomalySeverity;
  timestamp: Date;
  windowStart: Date;
  windowEnd: Date;
  description: string;
  observedValue: number;
  expectedValue: number;
  deviation: number; // Standard deviations from mean
  confidence: number; // 0-1
  metadata: Record<string, unknown>;
}

/**
 * Trend analysis result
 */
export interface TrendAnalysis {
  direction: 'increasing' | 'decreasing' | 'stable' | 'volatile';
  slope: number;
  r2: number; // R-squared (goodness of fit)
  forecast: number[];
  confidence: number;
}

/**
 * Pattern analysis result
 */
export interface PatternAnalysisResult {
  period: { start: Date; end: Date };
  anomalies: DetectedAnomaly[];
  costTrend: TrendAnalysis;
  usageTrend: TrendAnalysis;
  seasonalPattern: SeasonalPattern;
  statistics: {
    meanCost: number;
    stdCost: number;
    meanRequests: number;
    stdRequests: number;
    meanLatency: number;
    stdLatency: number;
    baselineErrorRate: number;
  };
  alerts: PatternAlert[];
}

/**
 * Pattern-based alert
 */
export interface PatternAlert {
  id: string;
  type: 'anomaly' | 'trend' | 'threshold' | 'seasonal';
  severity: AnomalySeverity;
  title: string;
  message: string;
  timestamp: Date;
  relatedAnomalies: string[];
  suggestedAction: string;
}

/**
 * Pattern Detector Configuration
 */
export interface PatternDetectorConfig {
  // Anomaly detection thresholds (in standard deviations)
  costSpikeThreshold: number;
  costDropThreshold: number;
  usageSpikeThreshold: number;
  usageDropThreshold: number;
  latencySpikeThreshold: number;
  errorRateSpikeThreshold: number;

  // Minimum data points for analysis
  minDataPoints: number;

  // Confidence threshold for reporting
  minConfidence: number;

  // Moving average window for baseline
  movingAverageWindow: number;

  // Enable specific detectors
  enableSeasonalAnalysis: boolean;
  enableTrendAnalysis: boolean;
  enableAnomalyDetection: boolean;
}

const DEFAULT_CONFIG: PatternDetectorConfig = {
  costSpikeThreshold: 2.5, // 2.5 std devs
  costDropThreshold: 2.0,
  usageSpikeThreshold: 2.5,
  usageDropThreshold: 2.0,
  latencySpikeThreshold: 3.0,
  errorRateSpikeThreshold: 3.0,
  minDataPoints: 10,
  minConfidence: 0.7,
  movingAverageWindow: 7, // 7 periods
  enableSeasonalAnalysis: true,
  enableTrendAnalysis: true,
  enableAnomalyDetection: true,
};

/**
 * Pattern Detector Class
 */
export class PatternDetector {
  private config: PatternDetectorConfig;
  private featureExtractor: FeatureExtractor;
  private anomalyCounter = 0;

  constructor(
    config: Partial<PatternDetectorConfig> = {},
    extractor?: FeatureExtractor
  ) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.featureExtractor = extractor || featureExtractor;
  }

  /**
   * Analyze features for patterns and anomalies
   */
  analyze(features: TimeWindowFeatures[]): PatternAnalysisResult {
    if (features.length < this.config.minDataPoints) {
      return this.emptyResult(features);
    }

    // Calculate statistics
    const statistics = this.calculateStatistics(features);

    // Detect anomalies
    const anomalies = this.config.enableAnomalyDetection
      ? this.detectAnomalies(features, statistics)
      : [];

    // Analyze trends
    const costTrend = this.config.enableTrendAnalysis
      ? this.analyzeTrend(features.map(f => f.totalCost))
      : this.emptyTrend();
    const usageTrend = this.config.enableTrendAnalysis
      ? this.analyzeTrend(features.map(f => f.requestCount))
      : this.emptyTrend();

    // Extract seasonal patterns
    const seasonalPattern = this.config.enableSeasonalAnalysis
      ? this.featureExtractor.extractSeasonalPatterns(features)
      : { hourly: [], daily: [], weekly: [] };

    // Generate alerts
    const alerts = this.generateAlerts(anomalies, costTrend, usageTrend);

    const firstFeature = features[0];
    const lastFeature = features[features.length - 1];

    return {
      period: {
        start: firstFeature?.windowStart ?? new Date(),
        end: lastFeature?.windowEnd ?? new Date(),
      },
      anomalies,
      costTrend,
      usageTrend,
      seasonalPattern,
      statistics,
      alerts,
    };
  }

  /**
   * Calculate baseline statistics
   */
  private calculateStatistics(features: TimeWindowFeatures[]): PatternAnalysisResult['statistics'] {
    const costs = features.map(f => f.totalCost);
    const requests = features.map(f => f.requestCount);
    const latencies = features.map(f => f.avgLatency);
    const errorRates = features.map(f => f.errorRate);

    return {
      meanCost: this.mean(costs),
      stdCost: this.std(costs),
      meanRequests: this.mean(requests),
      stdRequests: this.std(requests),
      meanLatency: this.mean(latencies),
      stdLatency: this.std(latencies),
      baselineErrorRate: this.mean(errorRates),
    };
  }

  /**
   * Detect anomalies in features
   */
  private detectAnomalies(
    features: TimeWindowFeatures[],
    stats: PatternAnalysisResult['statistics']
  ): DetectedAnomaly[] {
    const anomalies: DetectedAnomaly[] = [];

    // Calculate moving averages for adaptive baseline
    const movingAvgCost = this.movingAverage(
      features.map(f => f.totalCost),
      this.config.movingAverageWindow
    );
    const movingAvgRequests = this.movingAverage(
      features.map(f => f.requestCount),
      this.config.movingAverageWindow
    );

    for (let i = 0; i < features.length; i++) {
      const f = features[i]!;
      const baselineCost = movingAvgCost[i] ?? stats.meanCost;
      const baselineRequests = movingAvgRequests[i] ?? stats.meanRequests;

      // Cost spike detection
      if (stats.stdCost > 0) {
        const costDeviation = (f.totalCost - baselineCost) / stats.stdCost;
        if (costDeviation > this.config.costSpikeThreshold) {
          anomalies.push(this.createAnomaly(
            'cost_spike',
            this.getSeverity(costDeviation, 2.5, 3.5, 4.5),
            f.windowStart,
            f.windowStart,
            f.windowEnd,
            `Cost spike detected: $${f.totalCost.toFixed(2)} (${costDeviation.toFixed(1)} std devs above normal)`,
            f.totalCost,
            baselineCost,
            costDeviation,
            this.deviationToConfidence(costDeviation),
            { baselineCost }
          ));
        } else if (costDeviation < -this.config.costDropThreshold) {
          anomalies.push(this.createAnomaly(
            'cost_drop',
            this.getSeverity(Math.abs(costDeviation), 2, 3, 4),
            f.windowStart,
            f.windowStart,
            f.windowEnd,
            `Unusual cost drop: $${f.totalCost.toFixed(2)} (${Math.abs(costDeviation).toFixed(1)} std devs below normal)`,
            f.totalCost,
            baselineCost,
            costDeviation,
            this.deviationToConfidence(Math.abs(costDeviation)),
            { baselineCost }
          ));
        }
      }

      // Usage surge detection
      if (stats.stdRequests > 0) {
        const requestDeviation = (f.requestCount - baselineRequests) / stats.stdRequests;
        if (requestDeviation > this.config.usageSpikeThreshold) {
          anomalies.push(this.createAnomaly(
            'usage_surge',
            this.getSeverity(requestDeviation, 2.5, 3.5, 4.5),
            f.windowStart,
            f.windowStart,
            f.windowEnd,
            `Usage surge: ${f.requestCount} requests (${requestDeviation.toFixed(1)} std devs above normal)`,
            f.requestCount,
            baselineRequests,
            requestDeviation,
            this.deviationToConfidence(requestDeviation),
            { baselineRequests }
          ));
        } else if (requestDeviation < -this.config.usageDropThreshold) {
          anomalies.push(this.createAnomaly(
            'usage_drop',
            this.getSeverity(Math.abs(requestDeviation), 2, 3, 4),
            f.windowStart,
            f.windowStart,
            f.windowEnd,
            `Unusual usage drop: ${f.requestCount} requests (${Math.abs(requestDeviation).toFixed(1)} std devs below normal)`,
            f.requestCount,
            baselineRequests,
            requestDeviation,
            this.deviationToConfidence(Math.abs(requestDeviation)),
            { baselineRequests }
          ));
        }
      }

      // Latency spike detection
      if (stats.stdLatency > 0) {
        const latencyDeviation = (f.avgLatency - stats.meanLatency) / stats.stdLatency;
        if (latencyDeviation > this.config.latencySpikeThreshold) {
          anomalies.push(this.createAnomaly(
            'latency_spike',
            this.getSeverity(latencyDeviation, 3, 4, 5),
            f.windowStart,
            f.windowStart,
            f.windowEnd,
            `Latency spike: ${f.avgLatency.toFixed(0)}ms (${latencyDeviation.toFixed(1)} std devs above normal)`,
            f.avgLatency,
            stats.meanLatency,
            latencyDeviation,
            this.deviationToConfidence(latencyDeviation),
            { meanLatency: stats.meanLatency }
          ));
        }
      }

      // Error rate spike detection
      if (f.errorRate > 0 && stats.baselineErrorRate > 0) {
        const errorRateRatio = f.errorRate / stats.baselineErrorRate;
        if (errorRateRatio > 2 && f.errorRate > 0.05) { // At least 2x baseline and > 5%
          anomalies.push(this.createAnomaly(
            'error_rate_spike',
            this.getSeverity(errorRateRatio, 2, 3, 5),
            f.windowStart,
            f.windowStart,
            f.windowEnd,
            `Error rate spike: ${(f.errorRate * 100).toFixed(1)}% (${errorRateRatio.toFixed(1)}x baseline)`,
            f.errorRate,
            stats.baselineErrorRate,
            errorRateRatio,
            Math.min(0.95, errorRateRatio / 5),
            { baselineErrorRate: stats.baselineErrorRate }
          ));
        }
      }

      // Off-hours activity detection (significant cost outside business hours)
      if (!f.isBusinessHours && f.totalCost > stats.meanCost * 1.5) {
        anomalies.push(this.createAnomaly(
          'off_hours_activity',
          'low',
          f.windowStart,
          f.windowStart,
          f.windowEnd,
          `Unusual off-hours activity: $${f.totalCost.toFixed(2)} at ${f.hourOfDay}:00`,
          f.totalCost,
          stats.meanCost,
          (f.totalCost - stats.meanCost) / (stats.stdCost || 1),
          0.7,
          { hourOfDay: f.hourOfDay, isWeekend: f.isWeekend }
        ));
      }
    }

    // Filter by confidence
    return anomalies.filter(a => a.confidence >= this.config.minConfidence);
  }

  /**
   * Analyze trend using linear regression
   */
  private analyzeTrend(values: number[]): TrendAnalysis {
    if (values.length < 3) {
      return this.emptyTrend();
    }

    // Simple linear regression
    const n = values.length;
    const x = values.map((_, i) => i);
    const sumX = x.reduce((a, b) => a + b, 0);
    const sumY = values.reduce((a, b) => a + b, 0);
    const sumXY = x.reduce((sum, xi, i) => sum + xi * values[i]!, 0);
    const sumX2 = x.reduce((sum, xi) => sum + xi * xi, 0);

    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;

    // Calculate R-squared
    const meanY = sumY / n;
    const ssTotal = values.reduce((sum, y) => sum + Math.pow(y - meanY, 2), 0);
    const ssResidual = values.reduce((sum, y, i) => {
      const predicted = intercept + slope * i;
      return sum + Math.pow(y - predicted, 2);
    }, 0);
    const r2 = ssTotal > 0 ? 1 - (ssResidual / ssTotal) : 0;

    // Determine direction
    let direction: TrendAnalysis['direction'];
    const normalizedSlope = slope / (meanY || 1);

    if (r2 < 0.3) {
      direction = 'volatile';
    } else if (normalizedSlope > 0.05) {
      direction = 'increasing';
    } else if (normalizedSlope < -0.05) {
      direction = 'decreasing';
    } else {
      direction = 'stable';
    }

    // Generate forecast for next 7 periods
    const forecast: number[] = [];
    for (let i = 1; i <= 7; i++) {
      forecast.push(Math.max(0, intercept + slope * (n + i - 1)));
    }

    return {
      direction,
      slope,
      r2,
      forecast,
      confidence: Math.min(0.95, r2 + 0.1),
    };
  }

  /**
   * Generate alerts based on analysis
   */
  private generateAlerts(
    anomalies: DetectedAnomaly[],
    costTrend: TrendAnalysis,
    usageTrend: TrendAnalysis
  ): PatternAlert[] {
    const alerts: PatternAlert[] = [];
    let alertCounter = 0;

    // Critical anomaly alerts
    const criticalAnomalies = anomalies.filter(a => a.severity === 'critical');
    if (criticalAnomalies.length > 0) {
      alerts.push({
        id: `alert-${++alertCounter}`,
        type: 'anomaly',
        severity: 'critical',
        title: 'Critical Anomalies Detected',
        message: `${criticalAnomalies.length} critical anomaly(s) detected in recent usage`,
        timestamp: new Date(),
        relatedAnomalies: criticalAnomalies.map(a => a.id),
        suggestedAction: 'Investigate immediately. Check for unauthorized access or system issues.',
      });
    }

    // High anomaly cluster alert
    const highAnomalies = anomalies.filter(a => a.severity === 'high');
    if (highAnomalies.length >= 3) {
      alerts.push({
        id: `alert-${++alertCounter}`,
        type: 'anomaly',
        severity: 'high',
        title: 'Multiple High-Severity Anomalies',
        message: `${highAnomalies.length} high-severity anomalies detected, suggesting a systematic issue`,
        timestamp: new Date(),
        relatedAnomalies: highAnomalies.map(a => a.id),
        suggestedAction: 'Review recent changes to agents or workflows. Consider implementing rate limits.',
      });
    }

    // Cost trend alert
    if (costTrend.direction === 'increasing' && costTrend.confidence > 0.7) {
      const forecast0 = costTrend.forecast[0] ?? 0;
      const forecast6 = costTrend.forecast[6] ?? 0;
      const percentIncrease = costTrend.slope > 0 && forecast6 > forecast0 && forecast0 > 0
        ? ((forecast6 - forecast0) / forecast0) * 100
        : 0;

      if (percentIncrease > 20) {
        alerts.push({
          id: `alert-${++alertCounter}`,
          type: 'trend',
          severity: percentIncrease > 50 ? 'high' : 'medium',
          title: 'Rising Cost Trend',
          message: `Costs are projected to increase ${percentIncrease.toFixed(0)}% over the next week`,
          timestamp: new Date(),
          relatedAnomalies: [],
          suggestedAction: 'Review budget limits and consider implementing cost optimization strategies.',
        });
      }
    }

    // Usage drop alert (potential service issue)
    if (usageTrend.direction === 'decreasing' && usageTrend.confidence > 0.8) {
      alerts.push({
        id: `alert-${++alertCounter}`,
        type: 'trend',
        severity: 'medium',
        title: 'Declining Usage Trend',
        message: 'Usage has been steadily declining. This may indicate service issues or reduced demand.',
        timestamp: new Date(),
        relatedAnomalies: [],
        suggestedAction: 'Verify service health and check if any integrations have been affected.',
      });
    }

    // Volatile pattern alert
    if (costTrend.direction === 'volatile' && usageTrend.direction === 'volatile') {
      alerts.push({
        id: `alert-${++alertCounter}`,
        type: 'anomaly',
        severity: 'medium',
        title: 'Volatile Usage Pattern',
        message: 'Both cost and usage patterns are highly volatile, making forecasting difficult.',
        timestamp: new Date(),
        relatedAnomalies: [],
        suggestedAction: 'Investigate sources of variability. Consider implementing usage smoothing.',
      });
    }

    return alerts;
  }

  /**
   * Create anomaly object
   */
  private createAnomaly(
    type: AnomalyType,
    severity: AnomalySeverity,
    timestamp: Date,
    windowStart: Date,
    windowEnd: Date,
    description: string,
    observedValue: number,
    expectedValue: number,
    deviation: number,
    confidence: number,
    metadata: Record<string, unknown>
  ): DetectedAnomaly {
    return {
      id: `anomaly-${++this.anomalyCounter}`,
      type,
      severity,
      timestamp,
      windowStart,
      windowEnd,
      description,
      observedValue,
      expectedValue,
      deviation,
      confidence,
      metadata,
    };
  }

  /**
   * Get severity based on deviation thresholds
   */
  private getSeverity(
    value: number,
    mediumThreshold: number,
    highThreshold: number,
    criticalThreshold: number
  ): AnomalySeverity {
    if (value >= criticalThreshold) return 'critical';
    if (value >= highThreshold) return 'high';
    if (value >= mediumThreshold) return 'medium';
    return 'low';
  }

  /**
   * Convert deviation to confidence score
   */
  private deviationToConfidence(deviation: number): number {
    // Higher deviation = higher confidence (with diminishing returns)
    return Math.min(0.99, 0.5 + Math.tanh(deviation / 3) * 0.49);
  }

  /**
   * Calculate mean
   */
  private mean(values: number[]): number {
    if (values.length === 0) return 0;
    return values.reduce((a, b) => a + b, 0) / values.length;
  }

  /**
   * Calculate standard deviation
   */
  private std(values: number[]): number {
    if (values.length === 0) return 0;
    const m = this.mean(values);
    const variance = values.reduce((sum, v) => sum + Math.pow(v - m, 2), 0) / values.length;
    return Math.sqrt(variance);
  }

  /**
   * Calculate moving average
   */
  private movingAverage(values: number[], window: number): number[] {
    const result: number[] = [];
    for (let i = 0; i < values.length; i++) {
      const start = Math.max(0, i - window + 1);
      const slice = values.slice(start, i + 1);
      result.push(this.mean(slice));
    }
    return result;
  }

  /**
   * Empty result for insufficient data
   */
  private emptyResult(features: TimeWindowFeatures[]): PatternAnalysisResult {
    return {
      period: {
        start: features.length > 0 ? features[0]!.windowStart : new Date(),
        end: features.length > 0 ? features[features.length - 1]!.windowEnd : new Date(),
      },
      anomalies: [],
      costTrend: this.emptyTrend(),
      usageTrend: this.emptyTrend(),
      seasonalPattern: { hourly: [], daily: [], weekly: [] },
      statistics: {
        meanCost: 0,
        stdCost: 0,
        meanRequests: 0,
        stdRequests: 0,
        meanLatency: 0,
        stdLatency: 0,
        baselineErrorRate: 0,
      },
      alerts: [],
    };
  }

  /**
   * Empty trend result
   */
  private emptyTrend(): TrendAnalysis {
    return {
      direction: 'stable',
      slope: 0,
      r2: 0,
      forecast: [],
      confidence: 0,
    };
  }

  /**
   * Get configuration
   */
  getConfig(): PatternDetectorConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  updateConfig(updates: Partial<PatternDetectorConfig>): void {
    this.config = { ...this.config, ...updates };
  }
}

// Export singleton instance
export const patternDetector = new PatternDetector();
