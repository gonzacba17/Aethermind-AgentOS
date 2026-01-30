/**
 * Cost Calculator Service
 *
 * Provides detailed cost analysis and projections for LLM API usage.
 * Supports OpenAI, Anthropic, and local models with configurable pricing.
 */

import { z } from 'zod';

/**
 * Model pricing per 1K tokens (USD)
 */
export interface ModelPricing {
  inputPer1k: number;
  outputPer1k: number;
  provider: 'openai' | 'anthropic' | 'local';
  tier: 'budget' | 'standard' | 'premium';
  contextWindow: number;
  capabilities: string[];
}

/**
 * Comprehensive model pricing database (January 2026)
 */
export const MODEL_PRICING_DB: Record<string, ModelPricing> = {
  // OpenAI Models
  'gpt-4o': {
    inputPer1k: 0.0025,
    outputPer1k: 0.01,
    provider: 'openai',
    tier: 'standard',
    contextWindow: 128000,
    capabilities: ['vision', 'function_calling', 'json_mode'],
  },
  'gpt-4o-mini': {
    inputPer1k: 0.00015,
    outputPer1k: 0.0006,
    provider: 'openai',
    tier: 'budget',
    contextWindow: 128000,
    capabilities: ['vision', 'function_calling', 'json_mode'],
  },
  'gpt-4-turbo': {
    inputPer1k: 0.01,
    outputPer1k: 0.03,
    provider: 'openai',
    tier: 'premium',
    contextWindow: 128000,
    capabilities: ['vision', 'function_calling', 'json_mode'],
  },
  'gpt-3.5-turbo': {
    inputPer1k: 0.0005,
    outputPer1k: 0.0015,
    provider: 'openai',
    tier: 'budget',
    contextWindow: 16385,
    capabilities: ['function_calling', 'json_mode'],
  },
  'o1-preview': {
    inputPer1k: 0.015,
    outputPer1k: 0.06,
    provider: 'openai',
    tier: 'premium',
    contextWindow: 128000,
    capabilities: ['reasoning'],
  },
  'o1-mini': {
    inputPer1k: 0.003,
    outputPer1k: 0.012,
    provider: 'openai',
    tier: 'standard',
    contextWindow: 128000,
    capabilities: ['reasoning'],
  },

  // Anthropic Models
  'claude-3-5-sonnet-latest': {
    inputPer1k: 0.003,
    outputPer1k: 0.015,
    provider: 'anthropic',
    tier: 'standard',
    contextWindow: 200000,
    capabilities: ['vision', 'function_calling'],
  },
  'claude-3-opus-latest': {
    inputPer1k: 0.015,
    outputPer1k: 0.075,
    provider: 'anthropic',
    tier: 'premium',
    contextWindow: 200000,
    capabilities: ['vision', 'function_calling'],
  },
  'claude-3-haiku-latest': {
    inputPer1k: 0.00025,
    outputPer1k: 0.00125,
    provider: 'anthropic',
    tier: 'budget',
    contextWindow: 200000,
    capabilities: ['vision', 'function_calling'],
  },

  // Local Models (no cost)
  'llama3': {
    inputPer1k: 0,
    outputPer1k: 0,
    provider: 'local',
    tier: 'budget',
    contextWindow: 8192,
    capabilities: [],
  },
};

/**
 * Usage record for cost calculation
 */
export const UsageRecordSchema = z.object({
  model: z.string(),
  inputTokens: z.number().int().nonnegative(),
  outputTokens: z.number().int().nonnegative(),
  timestamp: z.date().or(z.string().datetime()),
  requestId: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export type UsageRecord = z.infer<typeof UsageRecordSchema>;

/**
 * Cost breakdown result
 */
export interface CostBreakdown {
  inputCost: number;
  outputCost: number;
  totalCost: number;
  currency: 'USD';
  model: string;
  pricing: ModelPricing | null;
}

/**
 * Cost projection result
 */
export interface CostProjection {
  daily: number;
  weekly: number;
  monthly: number;
  yearly: number;
  basedOnDays: number;
  averageDailyCost: number;
  trend: 'increasing' | 'decreasing' | 'stable';
  trendPercentage: number;
}

/**
 * Cost Calculator Class
 */
export class CostCalculator {
  private pricingDb: Record<string, ModelPricing>;

  constructor(customPricing?: Record<string, ModelPricing>) {
    this.pricingDb = { ...MODEL_PRICING_DB, ...customPricing };
  }

  /**
   * Calculate cost for a single usage record
   */
  calculateCost(usage: UsageRecord): CostBreakdown {
    const pricing = this.getModelPricing(usage.model);

    if (!pricing) {
      // Unknown model - use default expensive pricing as safety
      const defaultPricing = MODEL_PRICING_DB['gpt-4-turbo']!;
      return this.computeCost(usage, defaultPricing, usage.model);
    }

    return this.computeCost(usage, pricing, usage.model);
  }

  /**
   * Calculate total cost for multiple usage records
   */
  calculateTotalCost(usages: UsageRecord[]): {
    total: number;
    byModel: Record<string, number>;
    byProvider: Record<string, number>;
    breakdown: CostBreakdown[];
  } {
    const breakdown = usages.map(u => this.calculateCost(u));
    const byModel: Record<string, number> = {};
    const byProvider: Record<string, number> = {};

    for (const cost of breakdown) {
      byModel[cost.model] = (byModel[cost.model] || 0) + cost.totalCost;
      const provider = cost.pricing?.provider || 'unknown';
      byProvider[provider] = (byProvider[provider] || 0) + cost.totalCost;
    }

    return {
      total: breakdown.reduce((sum, c) => sum + c.totalCost, 0),
      byModel,
      byProvider,
      breakdown,
    };
  }

  /**
   * Project future costs based on historical usage
   */
  projectCosts(usages: UsageRecord[], lookbackDays: number = 30): CostProjection {
    if (usages.length === 0) {
      return {
        daily: 0,
        weekly: 0,
        monthly: 0,
        yearly: 0,
        basedOnDays: 0,
        averageDailyCost: 0,
        trend: 'stable',
        trendPercentage: 0,
      };
    }

    // Calculate costs by day
    const costsByDay = new Map<string, number>();
    const now = new Date();
    const cutoff = new Date(now.getTime() - lookbackDays * 24 * 60 * 60 * 1000);

    for (const usage of usages) {
      const date = new Date(usage.timestamp);
      if (date < cutoff) continue;

      const dayKey = date.toISOString().split('T')[0]!;
      const cost = this.calculateCost(usage).totalCost;
      costsByDay.set(dayKey, (costsByDay.get(dayKey) ?? 0) + cost);
    }

    const dailyCosts = Array.from(costsByDay.values());
    const daysWithData = dailyCosts.length;

    if (daysWithData === 0) {
      return {
        daily: 0,
        weekly: 0,
        monthly: 0,
        yearly: 0,
        basedOnDays: 0,
        averageDailyCost: 0,
        trend: 'stable',
        trendPercentage: 0,
      };
    }

    const averageDailyCost = dailyCosts.reduce((a, b) => a + b, 0) / daysWithData;

    // Calculate trend (compare first half vs second half)
    const midpoint = Math.floor(dailyCosts.length / 2);
    const firstHalf = dailyCosts.slice(0, midpoint);
    const secondHalf = dailyCosts.slice(midpoint);

    const firstAvg = firstHalf.length > 0
      ? firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length
      : 0;
    const secondAvg = secondHalf.length > 0
      ? secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length
      : 0;

    let trend: 'increasing' | 'decreasing' | 'stable' = 'stable';
    let trendPercentage = 0;

    if (firstAvg > 0) {
      trendPercentage = ((secondAvg - firstAvg) / firstAvg) * 100;
      if (trendPercentage > 10) trend = 'increasing';
      else if (trendPercentage < -10) trend = 'decreasing';
    }

    return {
      daily: averageDailyCost,
      weekly: averageDailyCost * 7,
      monthly: averageDailyCost * 30,
      yearly: averageDailyCost * 365,
      basedOnDays: daysWithData,
      averageDailyCost,
      trend,
      trendPercentage,
    };
  }

  /**
   * Get potential savings by switching models
   */
  calculatePotentialSavings(
    usages: UsageRecord[],
    targetModel: string
  ): {
    currentCost: number;
    projectedCost: number;
    savings: number;
    savingsPercentage: number;
    feasible: boolean;
    warnings: string[];
  } {
    const warnings: string[] = [];
    const targetPricing = this.getModelPricing(targetModel);

    if (!targetPricing) {
      return {
        currentCost: 0,
        projectedCost: 0,
        savings: 0,
        savingsPercentage: 0,
        feasible: false,
        warnings: [`Unknown target model: ${targetModel}`],
      };
    }

    let currentCost = 0;
    let projectedCost = 0;

    for (const usage of usages) {
      const currentBreakdown = this.calculateCost(usage);
      currentCost += currentBreakdown.totalCost;

      // Check if target model can handle this usage
      const currentPricing = this.getModelPricing(usage.model);
      if (currentPricing) {
        // Check context window
        if (usage.inputTokens > targetPricing.contextWindow) {
          warnings.push(`Some requests exceed ${targetModel} context window`);
        }

        // Check capabilities
        for (const cap of currentPricing.capabilities) {
          if (!targetPricing.capabilities.includes(cap)) {
            warnings.push(`${targetModel} lacks capability: ${cap}`);
          }
        }
      }

      // Calculate projected cost with target model
      const projected = this.computeCost(
        { ...usage, model: targetModel },
        targetPricing,
        targetModel
      );
      projectedCost += projected.totalCost;
    }

    const savings = currentCost - projectedCost;
    const savingsPercentage = currentCost > 0 ? (savings / currentCost) * 100 : 0;

    return {
      currentCost,
      projectedCost,
      savings,
      savingsPercentage,
      feasible: warnings.length === 0,
      warnings: [...new Set(warnings)], // Deduplicate warnings
    };
  }

  /**
   * Get model pricing information
   */
  getModelPricing(model: string): ModelPricing | null {
    // Direct match
    if (this.pricingDb[model]) {
      return this.pricingDb[model];
    }

    // Try to match by prefix
    for (const [key, pricing] of Object.entries(this.pricingDb)) {
      if (model.startsWith(key.replace('-latest', ''))) {
        return pricing;
      }
    }

    return null;
  }

  /**
   * Get all available models
   */
  getAvailableModels(): Array<{ model: string; pricing: ModelPricing }> {
    return Object.entries(this.pricingDb).map(([model, pricing]) => ({
      model,
      pricing,
    }));
  }

  /**
   * Get cheapest model for a given set of requirements
   */
  getCheapestModel(requirements: {
    minContextWindow?: number;
    requiredCapabilities?: string[];
    provider?: 'openai' | 'anthropic' | 'local';
  }): { model: string; pricing: ModelPricing } | null {
    const candidates = this.getAvailableModels().filter(({ pricing }) => {
      if (requirements.minContextWindow && pricing.contextWindow < requirements.minContextWindow) {
        return false;
      }
      if (requirements.requiredCapabilities) {
        for (const cap of requirements.requiredCapabilities) {
          if (!pricing.capabilities.includes(cap)) {
            return false;
          }
        }
      }
      if (requirements.provider && pricing.provider !== requirements.provider) {
        return false;
      }
      return true;
    });

    if (candidates.length === 0) return null;

    // Sort by total cost (input + output weighted equally)
    candidates.sort((a, b) => {
      const aCost = a.pricing.inputPer1k + a.pricing.outputPer1k;
      const bCost = b.pricing.inputPer1k + b.pricing.outputPer1k;
      return aCost - bCost;
    });

    return candidates[0] ?? null;
  }

  /**
   * Compute cost from pricing
   */
  private computeCost(
    usage: UsageRecord,
    pricing: ModelPricing,
    model: string
  ): CostBreakdown {
    const inputCost = (usage.inputTokens / 1000) * pricing.inputPer1k;
    const outputCost = (usage.outputTokens / 1000) * pricing.outputPer1k;

    return {
      inputCost,
      outputCost,
      totalCost: inputCost + outputCost,
      currency: 'USD',
      model,
      pricing,
    };
  }
}

// Export singleton instance
export const costCalculator = new CostCalculator();
