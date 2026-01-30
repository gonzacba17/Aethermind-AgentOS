/**
 * Auto-Optimization Module
 *
 * Provides intelligent cost optimization for LLM API usage:
 * - Cost calculation and projections
 * - Usage pattern analysis
 * - Intelligent model routing
 * - Actionable recommendations
 */

// Cost Calculator
export {
  CostCalculator,
  costCalculator,
  MODEL_PRICING_DB,
  type ModelPricing,
  type UsageRecord,
  type CostBreakdown,
  type CostProjection,
} from './cost-calculator.js';

// Usage Analyzer
export {
  UsageAnalyzer,
  usageAnalyzer,
  type TimeBucket,
  type PatternType,
  type DetectedPattern,
  type ModelStats,
  type UsageDataPoint,
  type AnalysisResult,
} from './analyzer.js';

// Model Router
export {
  ModelRouter,
  modelRouter,
  RoutingRuleSchema,
  type TaskComplexity,
  type RoutingStrategy,
  type RoutingRule,
  type RoutingContext,
  type RoutingDecision,
} from './router.js';

// Optimization Engine
export {
  OptimizationEngine,
  optimizationEngine,
  type OptimizationRecommendation,
  type OptimizationReport,
  type OptimizationConfig,
} from './engine.js';
