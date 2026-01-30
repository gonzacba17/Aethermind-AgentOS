/**
 * Auto-Optimization Engine
 *
 * Main orchestrator for cost optimization features.
 * Combines cost calculation, usage analysis, and intelligent routing
 * to provide actionable optimization recommendations.
 */

import { z } from 'zod';
import {
  CostCalculator,
  UsageRecord,
  CostProjection,
  costCalculator,
} from './cost-calculator.js';
import {
  UsageAnalyzer,
  AnalysisResult,
  DetectedPattern,
  usageAnalyzer,
} from './analyzer.js';
import {
  ModelRouter,
  RoutingContext,
  RoutingDecision,
  RoutingRule,
  modelRouter,
} from './router.js';
import { db, pool } from '../db/index.js';
import logger from '../utils/logger.js';

/**
 * Optimization recommendation
 */
export interface OptimizationRecommendation {
  id: string;
  type: 'model_switch' | 'prompt_optimization' | 'batching' | 'caching' | 'budget_alert';
  priority: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  currentCost: number;
  projectedSavings: number;
  implementation: string;
  affectedModels: string[];
  confidence: number;
  evidence: Record<string, unknown>;
}

/**
 * Optimization report
 */
export interface OptimizationReport {
  generatedAt: Date;
  period: { start: Date; end: Date };
  summary: {
    totalCost: number;
    totalRequests: number;
    averageCostPerRequest: number;
    topModel: string;
    topModelCost: number;
  };
  projections: CostProjection;
  analysis: AnalysisResult;
  recommendations: OptimizationRecommendation[];
  potentialTotalSavings: number;
}

/**
 * Optimization configuration
 */
export interface OptimizationConfig {
  enableAutoRouting: boolean;
  enableCostAlerts: boolean;
  costAlertThreshold: number;
  analysisLookbackDays: number;
  recommendationMinSavings: number;
}

const DEFAULT_CONFIG: OptimizationConfig = {
  enableAutoRouting: true,
  enableCostAlerts: true,
  costAlertThreshold: 100, // $100/day
  analysisLookbackDays: 30,
  recommendationMinSavings: 5, // $5 minimum to recommend
};

/**
 * Auto-Optimization Engine Class
 */
export class OptimizationEngine {
  private costCalculator: CostCalculator;
  private analyzer: UsageAnalyzer;
  private router: ModelRouter;
  private config: OptimizationConfig;

  constructor(
    config: Partial<OptimizationConfig> = {},
    costCalculator?: CostCalculator,
    analyzer?: UsageAnalyzer,
    router?: ModelRouter
  ) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.costCalculator = costCalculator || new CostCalculator();
    this.analyzer = analyzer || new UsageAnalyzer(this.costCalculator);
    this.router = router || new ModelRouter(this.costCalculator);
  }

  /**
   * Generate comprehensive optimization report
   */
  async generateReport(
    organizationId: string,
    options: {
      startDate?: Date;
      endDate?: Date;
      includeRecommendations?: boolean;
    } = {}
  ): Promise<OptimizationReport> {
    const endDate = options.endDate || new Date();
    const startDate = options.startDate || new Date(
      endDate.getTime() - this.config.analysisLookbackDays * 24 * 60 * 60 * 1000
    );

    // Fetch usage data
    const usageRecords = await this.fetchUsageRecords(organizationId, startDate, endDate);

    // Run analysis
    const analysis = this.analyzer.analyze(usageRecords, { detectPatterns: true });

    // Generate projections
    const projections = this.costCalculator.projectCosts(usageRecords, this.config.analysisLookbackDays);

    // Generate recommendations
    const recommendations = options.includeRecommendations !== false
      ? this.generateRecommendations(analysis, usageRecords)
      : [];

    // Calculate potential savings
    const potentialTotalSavings = recommendations.reduce(
      (sum, r) => sum + r.projectedSavings,
      0
    );

    // Build summary
    const topModel = analysis.modelStats[0];

    return {
      generatedAt: new Date(),
      period: { start: startDate, end: endDate },
      summary: {
        totalCost: analysis.totalCost,
        totalRequests: analysis.totalRequests,
        averageCostPerRequest: analysis.totalRequests > 0
          ? analysis.totalCost / analysis.totalRequests
          : 0,
        topModel: topModel?.model || 'N/A',
        topModelCost: topModel?.totalCost || 0,
      },
      projections,
      analysis,
      recommendations,
      potentialTotalSavings,
    };
  }

  /**
   * Route a request to optimal model
   */
  routeRequest(context: RoutingContext): RoutingDecision {
    if (!this.config.enableAutoRouting) {
      throw new Error('Auto-routing is disabled');
    }

    return this.router.route(context);
  }

  /**
   * Get cost estimate for a request
   */
  estimateCost(
    model: string,
    inputTokens: number,
    outputTokens: number
  ): {
    cost: number;
    breakdown: { input: number; output: number };
  } {
    const result = this.costCalculator.calculateCost({
      model,
      inputTokens,
      outputTokens,
      timestamp: new Date(),
    });

    return {
      cost: result.totalCost,
      breakdown: {
        input: result.inputCost,
        output: result.outputCost,
      },
    };
  }

  /**
   * Find cheaper alternatives for a model
   */
  findAlternatives(
    currentModel: string,
    usages: UsageRecord[],
    options: {
      maxAlternatives?: number;
      minSavingsPercent?: number;
    } = {}
  ): Array<{
    model: string;
    currentCost: number;
    projectedCost: number;
    savingsPercent: number;
    feasible: boolean;
    warnings: string[];
  }> {
    const { maxAlternatives = 3, minSavingsPercent = 10 } = options;

    const allModels = this.costCalculator.getAvailableModels();
    const alternatives: Array<{
      model: string;
      currentCost: number;
      projectedCost: number;
      savingsPercent: number;
      feasible: boolean;
      warnings: string[];
    }> = [];

    for (const { model } of allModels) {
      if (model === currentModel) continue;

      const savings = this.costCalculator.calculatePotentialSavings(usages, model);

      if (savings.savingsPercentage >= minSavingsPercent) {
        alternatives.push({
          model,
          currentCost: savings.currentCost,
          projectedCost: savings.projectedCost,
          savingsPercent: savings.savingsPercentage,
          feasible: savings.feasible,
          warnings: savings.warnings,
        });
      }
    }

    // Sort by savings percentage (descending)
    alternatives.sort((a, b) => b.savingsPercent - a.savingsPercent);

    return alternatives.slice(0, maxAlternatives);
  }

  /**
   * Add routing rule
   */
  addRoutingRule(rule: RoutingRule): void {
    this.router.addRule(rule);
  }

  /**
   * Remove routing rule
   */
  removeRoutingRule(ruleId: string): boolean {
    return this.router.removeRule(ruleId);
  }

  /**
   * Get all routing rules
   */
  getRoutingRules(): RoutingRule[] {
    return this.router.getRules();
  }

  /**
   * Update model performance data
   */
  recordModelPerformance(
    model: string,
    latency: number,
    success: boolean,
    quality?: number
  ): void {
    this.router.updatePerformanceData(model, latency, success, quality);
  }

  /**
   * Get optimization configuration
   */
  getConfig(): OptimizationConfig {
    return { ...this.config };
  }

  /**
   * Update optimization configuration
   */
  updateConfig(updates: Partial<OptimizationConfig>): void {
    this.config = { ...this.config, ...updates };
  }

  /**
   * Generate recommendations from analysis
   */
  private generateRecommendations(
    analysis: AnalysisResult,
    usages: UsageRecord[]
  ): OptimizationRecommendation[] {
    const recommendations: OptimizationRecommendation[] = [];
    let recId = 0;

    // Convert detected patterns to recommendations
    for (const pattern of analysis.patterns) {
      const rec = this.patternToRecommendation(pattern, `rec-${++recId}`);
      if (rec && rec.projectedSavings >= this.config.recommendationMinSavings) {
        recommendations.push(rec);
      }
    }

    // Add model switch recommendations
    for (const stat of analysis.modelStats) {
      if (stat.totalCost > 10) { // Only for models with significant usage
        const modelUsages = usages.filter(u => u.model === stat.model);
        const alternatives = this.findAlternatives(stat.model, modelUsages, {
          maxAlternatives: 1,
          minSavingsPercent: 20,
        });

        for (const alt of alternatives) {
          if (alt.feasible && alt.savingsPercent >= 20) {
            recommendations.push({
              id: `rec-${++recId}`,
              type: 'model_switch',
              priority: alt.savingsPercent > 40 ? 'high' : 'medium',
              title: `Switch from ${stat.model} to ${alt.model}`,
              description: `Switching to ${alt.model} could save ${alt.savingsPercent.toFixed(1)}% on this model's usage`,
              currentCost: alt.currentCost,
              projectedSavings: alt.currentCost - alt.projectedCost,
              implementation: `Update API calls to use "${alt.model}" instead of "${stat.model}"`,
              affectedModels: [stat.model, alt.model],
              confidence: 0.8,
              evidence: {
                currentModel: stat.model,
                newModel: alt.model,
                savingsPercent: alt.savingsPercent,
              },
            });
          }
        }
      }
    }

    // Add budget alert if projected costs are high
    if (analysis.modelStats.length > 0) {
      const dailyProjection = this.costCalculator.projectCosts(usages, 7).daily;
      if (dailyProjection > this.config.costAlertThreshold) {
        recommendations.push({
          id: `rec-${++recId}`,
          type: 'budget_alert',
          priority: 'critical',
          title: 'Projected costs exceed threshold',
          description: `Daily costs are projected at $${dailyProjection.toFixed(2)}, exceeding the $${this.config.costAlertThreshold} threshold`,
          currentCost: dailyProjection,
          projectedSavings: 0,
          implementation: 'Review usage patterns and consider implementing cost controls',
          affectedModels: analysis.modelStats.map(s => s.model),
          confidence: 0.9,
          evidence: {
            dailyProjection,
            threshold: this.config.costAlertThreshold,
          },
        });
      }
    }

    // Sort by priority and projected savings
    const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    recommendations.sort((a, b) => {
      const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
      if (priorityDiff !== 0) return priorityDiff;
      return b.projectedSavings - a.projectedSavings;
    });

    return recommendations;
  }

  /**
   * Convert a detected pattern to a recommendation
   */
  private patternToRecommendation(
    pattern: DetectedPattern,
    id: string
  ): OptimizationRecommendation | null {
    switch (pattern.type) {
      case 'high_cost_model_overuse':
        return {
          id,
          type: 'model_switch',
          priority: pattern.severity === 'high' ? 'high' : 'medium',
          title: 'Reduce premium model usage',
          description: pattern.description,
          currentCost: (pattern.potentialSavings || 0) * 2, // Estimate current cost
          projectedSavings: pattern.potentialSavings || 0,
          implementation: pattern.recommendation,
          affectedModels: (pattern.evidence.premiumModels as string[]) || [],
          confidence: 0.7,
          evidence: pattern.evidence,
        };

      case 'consistent_high_output':
        return {
          id,
          type: 'prompt_optimization',
          priority: 'medium',
          title: 'Optimize response length',
          description: pattern.description,
          currentCost: (pattern.potentialSavings || 0) * 5,
          projectedSavings: pattern.potentialSavings || 0,
          implementation: pattern.recommendation,
          affectedModels: pattern.affectedModel ? [pattern.affectedModel] : [],
          confidence: 0.6,
          evidence: pattern.evidence,
        };

      case 'cost_spike':
        return {
          id,
          type: 'budget_alert',
          priority: 'high',
          title: 'Cost spikes detected',
          description: pattern.description,
          currentCost: 0,
          projectedSavings: 0,
          implementation: pattern.recommendation,
          affectedModels: [],
          confidence: 0.9,
          evidence: pattern.evidence,
        };

      case 'low_utilization':
        return {
          id,
          type: 'batching',
          priority: 'low',
          title: 'Consider request batching',
          description: pattern.description,
          currentCost: 0,
          projectedSavings: 0,
          implementation: pattern.recommendation,
          affectedModels: pattern.affectedModel ? [pattern.affectedModel] : [],
          confidence: 0.5,
          evidence: pattern.evidence,
        };

      default:
        return null;
    }
  }

  /**
   * Fetch usage records from database
   */
  private async fetchUsageRecords(
    organizationId: string,
    startDate: Date,
    endDate: Date
  ): Promise<UsageRecord[]> {
    try {
      // Query the events table for usage data
      // This assumes there's an events table with the necessary fields
      const result = await pool.query(`
        SELECT
          model,
          prompt_tokens as "inputTokens",
          completion_tokens as "outputTokens",
          timestamp,
          request_id as "requestId",
          status
        FROM events
        WHERE org_id = $1
          AND timestamp >= $2
          AND timestamp <= $3
        ORDER BY timestamp DESC
        LIMIT 10000
      `, [organizationId, startDate, endDate]);

      return result.rows.map((row: Record<string, unknown>) => ({
        model: String(row.model || 'unknown'),
        inputTokens: Number(row.inputTokens) || 0,
        outputTokens: Number(row.outputTokens) || 0,
        timestamp: new Date(row.timestamp as string | number | Date),
        requestId: row.requestId as string | undefined,
        metadata: { status: row.status as string | undefined },
      }));
    } catch (error) {
      logger.warn('Failed to fetch usage records, using empty data', {
        error: (error as Error).message,
        organizationId,
      });
      return [];
    }
  }
}

// Export singleton instance
export const optimizationEngine = new OptimizationEngine();
