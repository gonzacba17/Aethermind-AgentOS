/**
 * Cost Forecaster
 *
 * Predicts future costs using time-series analysis,
 * seasonal patterns, and trend extrapolation.
 */

import { z } from 'zod';
import {
  FeatureExtractor,
  TimeWindowFeatures,
  SeasonalPattern,
  RawUsageRecord,
  featureExtractor,
} from './features.js';
import {
  PatternDetector,
  TrendAnalysis,
  PatternAnalysisResult,
  patternDetector,
} from './patterns.js';
import logger from '../utils/logger.js';

/**
 * Forecast point
 */
export interface ForecastPoint {
  timestamp: Date;
  predictedCost: number;
  predictedRequests: number;
  confidence: number;
  lowerBound: number;
  upperBound: number;
}

/**
 * Forecast result
 */
export interface ForecastResult {
  generatedAt: Date;
  organizationId: string;
  horizon: {
    start: Date;
    end: Date;
    periodCount: number;
    periodType: 'hour' | 'day' | 'week';
  };
  forecasts: ForecastPoint[];
  summary: {
    totalPredictedCost: number;
    averageDailyCost: number;
    peakCost: number;
    peakDate: Date;
    trend: 'increasing' | 'decreasing' | 'stable' | 'volatile';
    trendConfidence: number;
  };
  methodology: {
    model: string;
    dataPointsUsed: number;
    seasonalAdjustment: boolean;
    trendAdjustment: boolean;
  };
  warnings: string[];
}

/**
 * Budget projection
 */
export interface BudgetProjection {
  budgetId: string;
  budgetName: string;
  budgetLimit: number;
  currentSpend: number;
  projectedSpend: number;
  projectedOverage: number;
  exceedsProbability: number;
  estimatedExceedDate: Date | null;
  daysUntilExceed: number | null;
  recommendation: string;
}

/**
 * Forecaster Configuration
 */
export interface ForecasterConfig {
  // Forecast parameters
  defaultHorizonDays: number;
  maxHorizonDays: number;
  minDataPointsForForecast: number;

  // Model parameters
  exponentialSmoothingAlpha: number;
  seasonalWeight: number;
  trendWeight: number;

  // Confidence intervals
  confidenceLevel: number; // e.g., 0.95 for 95%

  // Seasonal adjustment
  useHourlySeasonality: boolean;
  useDailySeasonality: boolean;
}

const DEFAULT_CONFIG: ForecasterConfig = {
  defaultHorizonDays: 7,
  maxHorizonDays: 30,
  minDataPointsForForecast: 24, // At least 24 hours of data
  exponentialSmoothingAlpha: 0.3,
  seasonalWeight: 0.2,
  trendWeight: 0.3,
  confidenceLevel: 0.95,
  useHourlySeasonality: true,
  useDailySeasonality: true,
};

/**
 * Cost Forecaster Class
 */
export class CostForecaster {
  private config: ForecasterConfig;
  private featureExtractor: FeatureExtractor;
  private patternDetector: PatternDetector;

  constructor(
    config: Partial<ForecasterConfig> = {},
    extractor?: FeatureExtractor,
    detector?: PatternDetector
  ) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.featureExtractor = extractor || featureExtractor;
    this.patternDetector = detector || patternDetector;
  }

  /**
   * Generate cost forecast
   */
  async forecast(
    organizationId: string,
    historicalData: RawUsageRecord[],
    options: {
      horizonDays?: number;
      periodType?: 'hour' | 'day' | 'week';
    } = {}
  ): Promise<ForecastResult> {
    const horizonDays = Math.min(
      options.horizonDays || this.config.defaultHorizonDays,
      this.config.maxHorizonDays
    );
    const periodType = options.periodType || 'day';

    const warnings: string[] = [];

    // Extract features
    const features = this.featureExtractor.extractFeatures(historicalData);

    if (features.length < this.config.minDataPointsForForecast) {
      warnings.push(
        `Insufficient data: ${features.length} data points (minimum ${this.config.minDataPointsForForecast} required). Forecast accuracy may be low.`
      );
    }

    // Analyze patterns
    const analysis = this.patternDetector.analyze(features);

    // Extract seasonal patterns
    const seasonalPattern = this.featureExtractor.extractSeasonalPatterns(features);

    // Generate forecasts
    const forecasts = this.generateForecasts(
      features,
      analysis,
      seasonalPattern,
      horizonDays,
      periodType
    );

    // Calculate summary
    const summary = this.calculateSummary(forecasts, analysis);

    return {
      generatedAt: new Date(),
      organizationId,
      horizon: {
        start: forecasts[0]?.timestamp || new Date(),
        end: forecasts[forecasts.length - 1]?.timestamp || new Date(),
        periodCount: forecasts.length,
        periodType,
      },
      forecasts,
      summary,
      methodology: {
        model: 'Exponential Smoothing with Seasonal Decomposition',
        dataPointsUsed: features.length,
        seasonalAdjustment: this.config.useHourlySeasonality || this.config.useDailySeasonality,
        trendAdjustment: true,
      },
      warnings,
    };
  }

  /**
   * Project budget usage
   */
  async projectBudget(
    budgetId: string,
    budgetName: string,
    budgetLimit: number,
    currentSpend: number,
    periodEndDate: Date,
    historicalData: RawUsageRecord[]
  ): Promise<BudgetProjection> {
    // Calculate days remaining in budget period
    const now = new Date();
    const daysRemaining = Math.max(
      0,
      Math.ceil((periodEndDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    );

    // Extract recent daily costs
    const features = this.featureExtractor.extractFeatures(historicalData);
    const recentCosts = features.slice(-7).map(f => f.totalCost);
    const avgDailyCost = recentCosts.length > 0
      ? recentCosts.reduce((a, b) => a + b, 0) / recentCosts.length
      : 0;

    // Project spend for remaining period
    const projectedAdditionalSpend = avgDailyCost * daysRemaining;
    const projectedSpend = currentSpend + projectedAdditionalSpend;
    const projectedOverage = Math.max(0, projectedSpend - budgetLimit);

    // Calculate probability of exceeding budget
    const costVariance = this.calculateVariance(recentCosts);
    const stdDev = Math.sqrt(costVariance);
    const remainingBudget = budgetLimit - currentSpend;
    const zScore = stdDev > 0
      ? (remainingBudget - projectedAdditionalSpend) / (stdDev * Math.sqrt(daysRemaining))
      : 0;
    const exceedsProbability = 1 - this.normalCDF(zScore);

    // Estimate exceed date
    let estimatedExceedDate: Date | null = null;
    let daysUntilExceed: number | null = null;

    if (avgDailyCost > 0 && remainingBudget > 0) {
      daysUntilExceed = Math.ceil(remainingBudget / avgDailyCost);
      if (daysUntilExceed <= daysRemaining) {
        estimatedExceedDate = new Date(now.getTime() + daysUntilExceed * 24 * 60 * 60 * 1000);
      }
    }

    // Generate recommendation
    let recommendation: string;
    if (projectedOverage > 0) {
      const percentOver = (projectedOverage / budgetLimit) * 100;
      if (percentOver > 50) {
        recommendation = `CRITICAL: Budget projected to exceed by ${percentOver.toFixed(0)}%. Consider implementing hard limits or cost optimization immediately.`;
      } else if (percentOver > 20) {
        recommendation = `WARNING: Budget projected to exceed by ${percentOver.toFixed(0)}%. Review high-cost models and implement rate limiting.`;
      } else {
        recommendation = `NOTICE: Budget may be exceeded by ${percentOver.toFixed(0)}%. Monitor spending closely.`;
      }
    } else {
      const utilization = (projectedSpend / budgetLimit) * 100;
      if (utilization > 90) {
        recommendation = `Budget utilization projected at ${utilization.toFixed(0)}%. Consider increasing limit or optimizing costs.`;
      } else {
        recommendation = `Budget on track. Projected utilization: ${utilization.toFixed(0)}%`;
      }
    }

    return {
      budgetId,
      budgetName,
      budgetLimit,
      currentSpend,
      projectedSpend,
      projectedOverage,
      exceedsProbability,
      estimatedExceedDate,
      daysUntilExceed,
      recommendation,
    };
  }

  /**
   * Generate forecast points
   */
  private generateForecasts(
    features: TimeWindowFeatures[],
    analysis: PatternAnalysisResult,
    seasonal: SeasonalPattern,
    horizonDays: number,
    periodType: 'hour' | 'day' | 'week'
  ): ForecastPoint[] {
    const forecasts: ForecastPoint[] = [];

    if (features.length === 0) {
      return forecasts;
    }

    // Calculate baseline from recent data
    const recentFeatures = features.slice(-Math.min(30, features.length));
    const baseCost = this.mean(recentFeatures.map(f => f.totalCost));
    const baseRequests = this.mean(recentFeatures.map(f => f.requestCount));
    const costStd = this.std(recentFeatures.map(f => f.totalCost));
    const requestsStd = this.std(recentFeatures.map(f => f.requestCount));

    // Get trend components
    const costTrend = analysis.costTrend;
    const usageTrend = analysis.usageTrend;

    // Generate forecast periods
    const periodsToForecast = this.getPeriodCount(horizonDays, periodType);
    const lastFeature = features[features.length - 1];
    if (!lastFeature) {
      return [];
    }
    const lastTimestamp = lastFeature.windowEnd;

    for (let i = 0; i < periodsToForecast; i++) {
      const timestamp = this.getNextPeriod(lastTimestamp, i + 1, periodType);

      // Calculate trend adjustment
      const trendAdjustment = this.config.trendWeight * costTrend.slope * (i + 1);

      // Calculate seasonal adjustment
      const seasonalAdjustment = this.getSeasonalAdjustment(
        timestamp,
        seasonal,
        baseCost
      );

      // Combine forecasts using exponential smoothing weights
      const baseWeight = 1 - this.config.trendWeight - this.config.seasonalWeight;
      let predictedCost = (baseCost * baseWeight) +
        (baseCost + trendAdjustment) * this.config.trendWeight +
        seasonalAdjustment * this.config.seasonalWeight;

      // Ensure non-negative
      predictedCost = Math.max(0, predictedCost);

      // Similar calculation for requests
      const requestTrendAdjustment = this.config.trendWeight * usageTrend.slope * (i + 1);
      let predictedRequests = Math.max(0, baseRequests + requestTrendAdjustment);

      // Calculate confidence (decreases with horizon)
      const timeDecay = Math.exp(-0.05 * i);
      const dataConfidence = Math.min(1, features.length / this.config.minDataPointsForForecast);
      const confidence = timeDecay * dataConfidence * (costTrend.confidence || 0.5);

      // Calculate confidence intervals
      const zScore = this.getZScore(this.config.confidenceLevel);
      const uncertainty = costStd * Math.sqrt(1 + i / 10) * zScore;
      const lowerBound = Math.max(0, predictedCost - uncertainty);
      const upperBound = predictedCost + uncertainty;

      forecasts.push({
        timestamp,
        predictedCost,
        predictedRequests,
        confidence,
        lowerBound,
        upperBound,
      });
    }

    return forecasts;
  }

  /**
   * Calculate forecast summary
   */
  private calculateSummary(
    forecasts: ForecastPoint[],
    analysis: PatternAnalysisResult
  ): ForecastResult['summary'] {
    if (forecasts.length === 0) {
      return {
        totalPredictedCost: 0,
        averageDailyCost: 0,
        peakCost: 0,
        peakDate: new Date(),
        trend: 'stable',
        trendConfidence: 0,
      };
    }

    const totalPredictedCost = forecasts.reduce((sum, f) => sum + f.predictedCost, 0);
    const averageDailyCost = forecasts.length > 0 ? totalPredictedCost / forecasts.length : 0;

    let peakCost = 0;
    let peakDate = forecasts[0]?.timestamp ?? new Date();
    for (const f of forecasts) {
      if (f.predictedCost > peakCost) {
        peakCost = f.predictedCost;
        peakDate = f.timestamp;
      }
    }

    return {
      totalPredictedCost,
      averageDailyCost,
      peakCost,
      peakDate,
      trend: analysis.costTrend.direction,
      trendConfidence: analysis.costTrend.confidence,
    };
  }

  /**
   * Get seasonal adjustment for a given timestamp
   */
  private getSeasonalAdjustment(
    timestamp: Date,
    seasonal: SeasonalPattern,
    baseCost: number
  ): number {
    let adjustment = baseCost;

    if (this.config.useHourlySeasonality && seasonal.hourly.length === 24) {
      const hourFactor = seasonal.hourly[timestamp.getHours()] ?? (1/24);
      adjustment *= 1 + (hourFactor - 1/24) * 24; // Normalize around 1
    }

    if (this.config.useDailySeasonality && seasonal.daily.length === 7) {
      const dayFactor = seasonal.daily[timestamp.getDay()] ?? (1/7);
      adjustment *= 1 + (dayFactor - 1/7) * 7; // Normalize around 1
    }

    return adjustment;
  }

  /**
   * Get number of periods for forecast horizon
   */
  private getPeriodCount(horizonDays: number, periodType: 'hour' | 'day' | 'week'): number {
    switch (periodType) {
      case 'hour':
        return horizonDays * 24;
      case 'day':
        return horizonDays;
      case 'week':
        return Math.ceil(horizonDays / 7);
    }
  }

  /**
   * Get next period timestamp
   */
  private getNextPeriod(base: Date, offset: number, periodType: 'hour' | 'day' | 'week'): Date {
    const result = new Date(base);
    switch (periodType) {
      case 'hour':
        result.setHours(result.getHours() + offset);
        break;
      case 'day':
        result.setDate(result.getDate() + offset);
        break;
      case 'week':
        result.setDate(result.getDate() + offset * 7);
        break;
    }
    return result;
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
   * Calculate variance
   */
  private calculateVariance(values: number[]): number {
    if (values.length === 0) return 0;
    const m = this.mean(values);
    return values.reduce((sum, v) => sum + Math.pow(v - m, 2), 0) / values.length;
  }

  /**
   * Get Z-score for confidence level
   */
  private getZScore(confidenceLevel: number): number {
    // Approximation using inverse error function
    // For common confidence levels:
    // 0.90 -> 1.645
    // 0.95 -> 1.96
    // 0.99 -> 2.576
    const p = (1 + confidenceLevel) / 2;
    const a = [
      -3.969683028665376e1,
      2.209460984245205e2,
      -2.759285104469687e2,
      1.383577518672690e2,
      -3.066479806614716e1,
      2.506628277459239e0,
    ];
    const b = [
      -5.447609879822406e1,
      1.615858368580409e2,
      -1.556989798598866e2,
      6.680131188771972e1,
      -1.328068155288572e1,
    ];
    const c = [
      -7.784894002430293e-3,
      -3.223964580411365e-1,
      -2.400758277161838e0,
      -2.549732539343734e0,
      4.374664141464968e0,
      2.938163982698783e0,
    ];
    const d = [
      7.784695709041462e-3,
      3.224671290700398e-1,
      2.445134137142996e0,
      3.754408661907416e0,
    ];

    const q = p - 0.5;
    let r: number;
    let x: number;

    if (Math.abs(q) <= 0.425) {
      r = 0.180625 - q * q;
      x = q * (((((((a[0]! * r + a[1]!) * r + a[2]!) * r + a[3]!) * r + a[4]!) * r + a[5]!) * r + 1) /
        ((((((b[0]! * r + b[1]!) * r + b[2]!) * r + b[3]!) * r + b[4]!) * r + 1)));
    } else {
      r = q < 0 ? p : 1 - p;
      r = Math.sqrt(-Math.log(r));

      if (r <= 5) {
        r = r - 1.6;
        x = (((((((c[0]! * r + c[1]!) * r + c[2]!) * r + c[3]!) * r + c[4]!) * r + c[5]!) * r + 1) /
          ((((d[0]! * r + d[1]!) * r + d[2]!) * r + d[3]!) * r + 1));
      } else {
        r = r - 5;
        x = (((((((c[0]! * r + c[1]!) * r + c[2]!) * r + c[3]!) * r + c[4]!) * r + c[5]!) * r + 1) /
          ((((d[0]! * r + d[1]!) * r + d[2]!) * r + d[3]!) * r + 1));
      }

      if (q < 0) {
        x = -x;
      }
    }

    return x;
  }

  /**
   * Standard normal CDF approximation
   */
  private normalCDF(z: number): number {
    const a1 = 0.254829592;
    const a2 = -0.284496736;
    const a3 = 1.421413741;
    const a4 = -1.453152027;
    const a5 = 1.061405429;
    const p = 0.3275911;

    const sign = z < 0 ? -1 : 1;
    z = Math.abs(z) / Math.sqrt(2);

    const t = 1.0 / (1.0 + p * z);
    const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-z * z);

    return 0.5 * (1.0 + sign * y);
  }

  /**
   * Get configuration
   */
  getConfig(): ForecasterConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  updateConfig(updates: Partial<ForecasterConfig>): void {
    this.config = { ...this.config, ...updates };
  }
}

// Export singleton instance
export const costForecaster = new CostForecaster();
