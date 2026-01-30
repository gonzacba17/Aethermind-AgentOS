/**
 * ML Module - Predictive Cost Forecasting
 *
 * This module provides machine learning capabilities for:
 * - Feature extraction from usage data
 * - Pattern and anomaly detection
 * - Cost forecasting
 * - Predictive alerting
 */

// Feature extraction
export {
  FeatureExtractor,
  featureExtractor,
  type RawUsageRecord,
  type TimeWindowFeatures,
  type FeatureVector,
  type SeasonalPattern,
  type FeatureExtractorConfig,
} from './features.js';

// Pattern detection
export {
  PatternDetector,
  patternDetector,
  type AnomalyType,
  type AnomalySeverity,
  type DetectedAnomaly,
  type TrendAnalysis,
  type PatternAnalysisResult,
  type PatternAlert,
  type PatternDetectorConfig,
} from './patterns.js';

// Cost forecasting
export {
  CostForecaster,
  costForecaster,
  type ForecastPoint,
  type ForecastResult,
  type BudgetProjection,
  type ForecasterConfig,
} from './forecaster.js';

// Predictive alerts
export {
  PredictiveAlertService,
  predictiveAlertService,
  type PredictiveAlertType,
  type AlertPriority,
  type DeliveryChannel,
  type PredictiveAlert,
  type AlertRule,
  type AlertCondition,
  type AlertAction,
  type AlertSummary,
  type PredictiveAlertConfig,
} from './alerts.js';
