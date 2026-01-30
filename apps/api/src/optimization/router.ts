/**
 * Intelligent Model Router
 *
 * Routes requests to the optimal model based on:
 * - Task complexity analysis
 * - Cost/quality tradeoffs
 * - Historical performance data
 * - User-defined rules
 */

import { z } from 'zod';
import { CostCalculator, MODEL_PRICING_DB, ModelPricing } from './cost-calculator.js';
import logger from '../utils/logger.js';

/**
 * Request classification result
 */
export type TaskComplexity = 'simple' | 'moderate' | 'complex' | 'reasoning';

/**
 * Routing strategy
 */
export type RoutingStrategy = 'cost_optimized' | 'quality_optimized' | 'balanced' | 'custom';

/**
 * Routing rule for custom strategies
 */
export const RoutingRuleSchema = z.object({
  id: z.string(),
  name: z.string(),
  priority: z.number().int().min(0).max(100),
  condition: z.object({
    field: z.enum(['model', 'tokens', 'prompt_length', 'task_type', 'time_of_day']),
    operator: z.enum(['equals', 'contains', 'greater_than', 'less_than', 'in']),
    value: z.union([z.string(), z.number(), z.array(z.string())]),
  }),
  action: z.object({
    type: z.enum(['route_to_model', 'adjust_params', 'reject']),
    model: z.string().optional(),
    params: z.record(z.unknown()).optional(),
    reason: z.string().optional(),
  }),
  enabled: z.boolean().default(true),
});

export type RoutingRule = z.infer<typeof RoutingRuleSchema>;

/**
 * Routing request context
 */
export interface RoutingContext {
  prompt: string;
  maxTokens?: number;
  preferredProvider?: 'openai' | 'anthropic' | 'local';
  requiredCapabilities?: string[];
  budgetLimit?: number;
  qualityPriority?: number; // 0-100, 100 = highest quality
  latencyPriority?: number; // 0-100, 100 = fastest response
  taskType?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Routing decision
 */
export interface RoutingDecision {
  selectedModel: string;
  reasoning: string;
  alternatives: Array<{
    model: string;
    reason: string;
    estimatedCost: number;
  }>;
  estimatedCost: number;
  confidence: number; // 0-1
  appliedRules: string[];
  parameters?: Record<string, unknown>;
}

/**
 * Model performance data
 */
interface ModelPerformance {
  model: string;
  averageLatency: number;
  successRate: number;
  averageQuality: number; // 0-1 based on user feedback
  sampleSize: number;
}

/**
 * Intelligent Model Router
 */
export class ModelRouter {
  private costCalculator: CostCalculator;
  private customRules: RoutingRule[] = [];
  private performanceData: Map<string, ModelPerformance> = new Map();
  private defaultStrategy: RoutingStrategy = 'balanced';

  // Complexity keywords for classification
  private complexityIndicators = {
    simple: [
      'translate', 'summarize', 'extract', 'list', 'define',
      'format', 'convert', 'classify', 'categorize', 'identify'
    ],
    moderate: [
      'explain', 'compare', 'analyze', 'describe', 'elaborate',
      'write', 'create', 'generate', 'draft', 'compose'
    ],
    complex: [
      'design', 'architect', 'optimize', 'debug', 'refactor',
      'implement', 'develop', 'build', 'integrate', 'migrate'
    ],
    reasoning: [
      'prove', 'deduce', 'infer', 'derive', 'calculate',
      'solve', 'reason', 'logic', 'mathematical', 'theorem'
    ],
  };

  // Model recommendations by complexity
  private modelRecommendations: Record<TaskComplexity, string[]> = {
    simple: ['gpt-4o-mini', 'claude-3-haiku-latest', 'gpt-3.5-turbo'],
    moderate: ['gpt-4o', 'claude-3-5-sonnet-latest'],
    complex: ['gpt-4-turbo', 'claude-3-opus-latest', 'gpt-4o'],
    reasoning: ['o1-preview', 'o1-mini', 'claude-3-opus-latest'],
  };

  constructor(costCalculator?: CostCalculator) {
    this.costCalculator = costCalculator || new CostCalculator();
  }

  /**
   * Route a request to the optimal model
   */
  route(context: RoutingContext): RoutingDecision {
    const appliedRules: string[] = [];
    let parameters: Record<string, unknown> | undefined;

    // 1. Check custom rules first
    const ruleResult = this.applyCustomRules(context);
    if (ruleResult) {
      appliedRules.push(...ruleResult.appliedRules);
      if (ruleResult.decision) {
        return ruleResult.decision;
      }
      if (ruleResult.parameters) {
        parameters = ruleResult.parameters;
      }
    }

    // 2. Classify task complexity
    const complexity = this.classifyComplexity(context.prompt);
    appliedRules.push(`complexity:${complexity}`);

    // 3. Get candidate models
    const candidates = this.getCandidateModels(context, complexity);

    // 4. Score and rank candidates
    const scoredCandidates = this.scoreCandidates(candidates, context, complexity);

    // 5. Select best model (guaranteed to have at least one candidate)
    const selected = scoredCandidates[0]!;
    const alternatives = scoredCandidates.slice(1, 4).map(c => ({
      model: c.model,
      reason: c.reasoning,
      estimatedCost: c.estimatedCost,
    }));

    return {
      selectedModel: selected.model,
      reasoning: selected.reasoning,
      alternatives,
      estimatedCost: selected.estimatedCost,
      confidence: selected.confidence,
      appliedRules,
      parameters,
    };
  }

  /**
   * Classify prompt complexity
   */
  classifyComplexity(prompt: string): TaskComplexity {
    const lowerPrompt = prompt.toLowerCase();
    const words = lowerPrompt.split(/\s+/);

    // Score each complexity level
    const scores: Record<TaskComplexity, number> = {
      simple: 0,
      moderate: 0,
      complex: 0,
      reasoning: 0,
    };

    for (const [level, indicators] of Object.entries(this.complexityIndicators)) {
      for (const indicator of indicators) {
        if (lowerPrompt.includes(indicator)) {
          scores[level as TaskComplexity]++;
        }
      }
    }

    // Additional heuristics
    const promptLength = words.length;
    if (promptLength < 20) scores.simple += 2;
    else if (promptLength < 100) scores.moderate += 1;
    else scores.complex += 1;

    // Check for code-related content
    if (lowerPrompt.includes('code') || lowerPrompt.includes('function') ||
        lowerPrompt.includes('class') || lowerPrompt.includes('```')) {
      scores.complex += 2;
    }

    // Check for math/logic
    if (/[0-9+\-*/=]+/.test(prompt) || lowerPrompt.includes('equation') ||
        lowerPrompt.includes('formula')) {
      scores.reasoning += 2;
    }

    // Find highest score
    let maxLevel: TaskComplexity = 'moderate';
    let maxScore = scores.moderate;

    for (const [level, score] of Object.entries(scores)) {
      if (score > maxScore) {
        maxScore = score;
        maxLevel = level as TaskComplexity;
      }
    }

    return maxLevel;
  }

  /**
   * Get candidate models based on context
   */
  private getCandidateModels(
    context: RoutingContext,
    complexity: TaskComplexity
  ): string[] {
    const recommended = this.modelRecommendations[complexity];
    const allModels = Object.keys(MODEL_PRICING_DB);

    // Filter by provider preference
    let candidates = context.preferredProvider
      ? allModels.filter(m => {
          const pricing = this.costCalculator.getModelPricing(m);
          return pricing?.provider === context.preferredProvider;
        })
      : allModels;

    // Filter by required capabilities
    if (context.requiredCapabilities && context.requiredCapabilities.length > 0) {
      candidates = candidates.filter(m => {
        const pricing = this.costCalculator.getModelPricing(m);
        if (!pricing) return false;
        return context.requiredCapabilities!.every(cap =>
          pricing.capabilities.includes(cap)
        );
      });
    }

    // Prioritize recommended models
    const prioritized = [
      ...recommended.filter(m => candidates.includes(m)),
      ...candidates.filter(m => !recommended.includes(m)),
    ];

    return prioritized;
  }

  /**
   * Score candidate models
   */
  private scoreCandidates(
    candidates: string[],
    context: RoutingContext,
    complexity: TaskComplexity
  ): Array<{
    model: string;
    score: number;
    reasoning: string;
    estimatedCost: number;
    confidence: number;
  }> {
    const qualityWeight = (context.qualityPriority || 50) / 100;
    const latencyWeight = (context.latencyPriority || 50) / 100;
    const costWeight = 1 - Math.max(qualityWeight, latencyWeight);

    const scored = candidates.map(model => {
      const pricing = this.costCalculator.getModelPricing(model);
      const performance = this.performanceData.get(model);

      if (!pricing) {
        return { model, score: 0, reasoning: 'Unknown model', estimatedCost: 0, confidence: 0 };
      }

      // Estimate tokens based on prompt length
      const estimatedInputTokens = Math.ceil(context.prompt.length / 4);
      const estimatedOutputTokens = context.maxTokens || estimatedInputTokens * 2;

      // Calculate estimated cost
      const estimatedCost = this.costCalculator.calculateCost({
        model,
        inputTokens: estimatedInputTokens,
        outputTokens: estimatedOutputTokens,
        timestamp: new Date(),
      }).totalCost;

      // Check budget limit
      if (context.budgetLimit && estimatedCost > context.budgetLimit) {
        return {
          model,
          score: 0,
          reasoning: 'Exceeds budget limit',
          estimatedCost,
          confidence: 1,
        };
      }

      // Score components
      const tierScores: Record<string, number> = {
        premium: 1.0,
        standard: 0.7,
        budget: 0.4,
      };

      const qualityScore = tierScores[pricing.tier] || 0.5;
      const costScore = 1 - Math.min(estimatedCost / 0.1, 1); // Normalize to $0.10 max
      const latencyScore = performance
        ? 1 - Math.min(performance.averageLatency / 5000, 1)
        : 0.5;

      // Calculate weighted score
      const score =
        qualityScore * qualityWeight +
        costScore * costWeight +
        latencyScore * latencyWeight;

      // Boost for recommended models
      const isRecommended = this.modelRecommendations[complexity].includes(model);
      const finalScore = isRecommended ? score * 1.2 : score;

      // Generate reasoning
      const reasons: string[] = [];
      if (isRecommended) reasons.push(`recommended for ${complexity} tasks`);
      if (qualityScore > 0.8) reasons.push('high quality');
      if (costScore > 0.7) reasons.push('cost-effective');
      if (latencyScore > 0.7) reasons.push('fast response');

      const reasoning = reasons.length > 0
        ? `Selected because: ${reasons.join(', ')}`
        : `Default selection for ${complexity} complexity`;

      // Confidence based on available data
      const confidence = performance
        ? Math.min(performance.sampleSize / 100, 1)
        : 0.5;

      return {
        model,
        score: finalScore,
        reasoning,
        estimatedCost,
        confidence,
      };
    });

    // Sort by score (descending)
    return scored.sort((a, b) => b.score - a.score);
  }

  /**
   * Apply custom routing rules
   */
  private applyCustomRules(context: RoutingContext): {
    decision?: RoutingDecision;
    appliedRules: string[];
    parameters?: Record<string, unknown>;
  } | null {
    const appliedRules: string[] = [];
    let parameters: Record<string, unknown> | undefined;

    // Sort rules by priority
    const sortedRules = [...this.customRules]
      .filter(r => r.enabled)
      .sort((a, b) => b.priority - a.priority);

    for (const rule of sortedRules) {
      if (this.evaluateCondition(rule.condition, context)) {
        appliedRules.push(rule.name);

        switch (rule.action.type) {
          case 'route_to_model':
            if (rule.action.model) {
              return {
                decision: {
                  selectedModel: rule.action.model,
                  reasoning: `Rule "${rule.name}": ${rule.action.reason || 'Custom routing rule'}`,
                  alternatives: [],
                  estimatedCost: 0,
                  confidence: 1,
                  appliedRules,
                },
                appliedRules,
              };
            }
            break;

          case 'adjust_params':
            parameters = { ...parameters, ...rule.action.params };
            break;

          case 'reject':
            throw new Error(rule.action.reason || 'Request rejected by routing rule');
        }
      }
    }

    return appliedRules.length > 0 ? { appliedRules, parameters } : null;
  }

  /**
   * Evaluate rule condition
   */
  private evaluateCondition(
    condition: RoutingRule['condition'],
    context: RoutingContext
  ): boolean {
    let fieldValue: unknown;

    switch (condition.field) {
      case 'prompt_length':
        fieldValue = context.prompt.length;
        break;
      case 'tokens':
        fieldValue = context.maxTokens || 0;
        break;
      case 'task_type':
        fieldValue = context.taskType || '';
        break;
      case 'time_of_day':
        fieldValue = new Date().getHours();
        break;
      default:
        fieldValue = context.metadata?.[condition.field];
    }

    switch (condition.operator) {
      case 'equals':
        return fieldValue === condition.value;
      case 'contains':
        return String(fieldValue).includes(String(condition.value));
      case 'greater_than':
        return Number(fieldValue) > Number(condition.value);
      case 'less_than':
        return Number(fieldValue) < Number(condition.value);
      case 'in':
        return Array.isArray(condition.value) && condition.value.includes(fieldValue as string);
      default:
        return false;
    }
  }

  /**
   * Add custom routing rule
   */
  addRule(rule: RoutingRule): void {
    this.customRules.push(rule);
  }

  /**
   * Remove routing rule
   */
  removeRule(ruleId: string): boolean {
    const index = this.customRules.findIndex(r => r.id === ruleId);
    if (index >= 0) {
      this.customRules.splice(index, 1);
      return true;
    }
    return false;
  }

  /**
   * Get all rules
   */
  getRules(): RoutingRule[] {
    return [...this.customRules];
  }

  /**
   * Update performance data for a model
   */
  updatePerformanceData(
    model: string,
    latency: number,
    success: boolean,
    quality?: number
  ): void {
    const existing = this.performanceData.get(model) || {
      model,
      averageLatency: 0,
      successRate: 1,
      averageQuality: 0.5,
      sampleSize: 0,
    };

    const n = existing.sampleSize;
    existing.averageLatency = (existing.averageLatency * n + latency) / (n + 1);
    existing.successRate = (existing.successRate * n + (success ? 1 : 0)) / (n + 1);
    if (quality !== undefined) {
      existing.averageQuality = (existing.averageQuality * n + quality) / (n + 1);
    }
    existing.sampleSize++;

    this.performanceData.set(model, existing);
  }

  /**
   * Set default routing strategy
   */
  setDefaultStrategy(strategy: RoutingStrategy): void {
    this.defaultStrategy = strategy;
  }
}

// Export singleton instance
export const modelRouter = new ModelRouter();
