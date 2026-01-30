/**
 * Optimization API Routes
 *
 * Provides REST endpoints for the Auto-Optimization Engine:
 * - Cost analysis and projections
 * - Optimization recommendations
 * - Intelligent model routing
 * - Routing rules management
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import {
  OptimizationEngine,
  optimizationEngine,
  OptimizationReport,
} from '../optimization/engine.js';
import { RoutingRuleSchema } from '../optimization/router.js';
import logger from '../utils/logger.js';

const router = Router();

/**
 * Request validation schemas
 */
const GenerateReportSchema = z.object({
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  includeRecommendations: z.boolean().optional(),
});

const RouteRequestSchema = z.object({
  prompt: z.string().min(1).max(100000),
  maxTokens: z.number().int().positive().optional(),
  preferredProvider: z.enum(['openai', 'anthropic', 'local']).optional(),
  requiredCapabilities: z.array(z.string()).optional(),
  budgetLimit: z.number().positive().optional(),
  qualityPriority: z.number().int().min(0).max(100).optional(),
  latencyPriority: z.number().int().min(0).max(100).optional(),
  taskType: z.string().optional(),
});

const EstimateCostSchema = z.object({
  model: z.string(),
  inputTokens: z.number().int().nonnegative(),
  outputTokens: z.number().int().nonnegative(),
});

const FindAlternativesSchema = z.object({
  model: z.string(),
  maxAlternatives: z.number().int().min(1).max(10).optional(),
  minSavingsPercent: z.number().min(0).max(100).optional(),
});

const UpdateConfigSchema = z.object({
  enableAutoRouting: z.boolean().optional(),
  enableCostAlerts: z.boolean().optional(),
  costAlertThreshold: z.number().positive().optional(),
  analysisLookbackDays: z.number().int().min(1).max(365).optional(),
  recommendationMinSavings: z.number().nonnegative().optional(),
});

/**
 * GET /api/optimization/report
 *
 * Generate an optimization report for the organization
 */
router.get('/report', async (req: Request, res: Response) => {
  try {
    const query = GenerateReportSchema.safeParse(req.query);
    if (!query.success) {
      return res.status(400).json({
        error: 'Invalid parameters',
        details: query.error.issues,
      });
    }

    const organizationId = (req.user as any)?.organizationId || 'default';

    const report = await optimizationEngine.generateReport(organizationId, {
      startDate: query.data.startDate ? new Date(query.data.startDate) : undefined,
      endDate: query.data.endDate ? new Date(query.data.endDate) : undefined,
      includeRecommendations: query.data.includeRecommendations,
    });

    res.json(report);
  } catch (error) {
    logger.error('Failed to generate optimization report', {
      error: (error as Error).message,
      requestId: req.requestId,
    });

    res.status(500).json({
      error: 'Failed to generate report',
      message: (error as Error).message,
    });
  }
});

/**
 * POST /api/optimization/route
 *
 * Route a request to the optimal model
 */
router.post('/route', async (req: Request, res: Response) => {
  try {
    const body = RouteRequestSchema.safeParse(req.body);
    if (!body.success) {
      return res.status(400).json({
        error: 'Invalid request body',
        details: body.error.issues,
      });
    }

    const decision = optimizationEngine.routeRequest(body.data);

    res.json({
      selectedModel: decision.selectedModel,
      reasoning: decision.reasoning,
      alternatives: decision.alternatives,
      estimatedCost: decision.estimatedCost,
      confidence: decision.confidence,
      appliedRules: decision.appliedRules,
      parameters: decision.parameters,
    });
  } catch (error) {
    logger.error('Failed to route request', {
      error: (error as Error).message,
      requestId: req.requestId,
    });

    res.status(500).json({
      error: 'Failed to route request',
      message: (error as Error).message,
    });
  }
});

/**
 * POST /api/optimization/estimate
 *
 * Estimate cost for a request
 */
router.post('/estimate', async (req: Request, res: Response) => {
  try {
    const body = EstimateCostSchema.safeParse(req.body);
    if (!body.success) {
      return res.status(400).json({
        error: 'Invalid request body',
        details: body.error.issues,
      });
    }

    const estimate = optimizationEngine.estimateCost(
      body.data.model,
      body.data.inputTokens,
      body.data.outputTokens
    );

    res.json({
      model: body.data.model,
      inputTokens: body.data.inputTokens,
      outputTokens: body.data.outputTokens,
      estimatedCost: estimate.cost,
      breakdown: estimate.breakdown,
      currency: 'USD',
    });
  } catch (error) {
    logger.error('Failed to estimate cost', {
      error: (error as Error).message,
      requestId: req.requestId,
    });

    res.status(500).json({
      error: 'Failed to estimate cost',
      message: (error as Error).message,
    });
  }
});

/**
 * POST /api/optimization/alternatives
 *
 * Find cheaper model alternatives
 */
router.post('/alternatives', async (req: Request, res: Response) => {
  try {
    const body = FindAlternativesSchema.safeParse(req.body);
    if (!body.success) {
      return res.status(400).json({
        error: 'Invalid request body',
        details: body.error.issues,
      });
    }

    // For now, use empty usage data - in production, would fetch from DB
    const alternatives = optimizationEngine.findAlternatives(
      body.data.model,
      [], // Would fetch actual usage records
      {
        maxAlternatives: body.data.maxAlternatives,
        minSavingsPercent: body.data.minSavingsPercent,
      }
    );

    res.json({
      currentModel: body.data.model,
      alternatives,
    });
  } catch (error) {
    logger.error('Failed to find alternatives', {
      error: (error as Error).message,
      requestId: req.requestId,
    });

    res.status(500).json({
      error: 'Failed to find alternatives',
      message: (error as Error).message,
    });
  }
});

/**
 * GET /api/optimization/models
 *
 * Get all available models with pricing
 */
router.get('/models', async (_req: Request, res: Response) => {
  try {
    const { CostCalculator } = await import('../optimization/cost-calculator.js');
    const calculator = new CostCalculator();
    const models = calculator.getAvailableModels();

    res.json({
      models: models.map(({ model, pricing }) => ({
        model,
        provider: pricing.provider,
        tier: pricing.tier,
        pricing: {
          inputPer1kTokens: pricing.inputPer1k,
          outputPer1kTokens: pricing.outputPer1k,
        },
        contextWindow: pricing.contextWindow,
        capabilities: pricing.capabilities,
      })),
    });
  } catch (error) {
    logger.error('Failed to get models', {
      error: (error as Error).message,
    });

    res.status(500).json({
      error: 'Failed to get models',
      message: (error as Error).message,
    });
  }
});

/**
 * GET /api/optimization/rules
 *
 * Get all routing rules
 */
router.get('/rules', async (_req: Request, res: Response) => {
  try {
    const rules = optimizationEngine.getRoutingRules();
    res.json({ rules });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to get rules',
      message: (error as Error).message,
    });
  }
});

/**
 * POST /api/optimization/rules
 *
 * Add a new routing rule
 */
router.post('/rules', async (req: Request, res: Response) => {
  try {
    const body = RoutingRuleSchema.safeParse(req.body);
    if (!body.success) {
      return res.status(400).json({
        error: 'Invalid rule',
        details: body.error.issues,
      });
    }

    optimizationEngine.addRoutingRule(body.data);

    res.status(201).json({
      message: 'Rule added successfully',
      rule: body.data,
    });
  } catch (error) {
    logger.error('Failed to add rule', {
      error: (error as Error).message,
    });

    res.status(500).json({
      error: 'Failed to add rule',
      message: (error as Error).message,
    });
  }
});

/**
 * DELETE /api/optimization/rules/:ruleId
 *
 * Remove a routing rule
 */
router.delete('/rules/:ruleId', async (req: Request, res: Response) => {
  try {
    const ruleId = req.params.ruleId!;
    const removed = optimizationEngine.removeRoutingRule(ruleId);

    if (removed) {
      res.json({ message: 'Rule removed successfully' });
    } else {
      res.status(404).json({ error: 'Rule not found' });
    }
  } catch (error) {
    res.status(500).json({
      error: 'Failed to remove rule',
      message: (error as Error).message,
    });
  }
});

/**
 * GET /api/optimization/config
 *
 * Get optimization configuration
 */
router.get('/config', async (_req: Request, res: Response) => {
  try {
    const config = optimizationEngine.getConfig();
    res.json({ config });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to get config',
      message: (error as Error).message,
    });
  }
});

/**
 * PATCH /api/optimization/config
 *
 * Update optimization configuration
 */
router.patch('/config', async (req: Request, res: Response) => {
  try {
    const body = UpdateConfigSchema.safeParse(req.body);
    if (!body.success) {
      return res.status(400).json({
        error: 'Invalid configuration',
        details: body.error.issues,
      });
    }

    optimizationEngine.updateConfig(body.data);
    const config = optimizationEngine.getConfig();

    res.json({
      message: 'Configuration updated',
      config,
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to update config',
      message: (error as Error).message,
    });
  }
});

/**
 * POST /api/optimization/performance
 *
 * Record model performance data (for improving routing decisions)
 */
router.post('/performance', async (req: Request, res: Response) => {
  try {
    const schema = z.object({
      model: z.string(),
      latency: z.number().nonnegative(),
      success: z.boolean(),
      quality: z.number().min(0).max(1).optional(),
    });

    const body = schema.safeParse(req.body);
    if (!body.success) {
      return res.status(400).json({
        error: 'Invalid performance data',
        details: body.error.issues,
      });
    }

    optimizationEngine.recordModelPerformance(
      body.data.model,
      body.data.latency,
      body.data.success,
      body.data.quality
    );

    res.json({ message: 'Performance data recorded' });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to record performance',
      message: (error as Error).message,
    });
  }
});

export default router;
