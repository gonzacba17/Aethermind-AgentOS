/**
 * Forecasting API Routes
 *
 * REST API endpoints for predictive cost forecasting,
 * pattern analysis, and alert management.
 */

import { Router } from 'express';
import type { Router as ExpressRouter, Request, Response } from 'express';
import { z } from 'zod';
import { validateBody, validateQuery } from '../middleware/validator.js';
import {
  featureExtractor,
  patternDetector,
  costForecaster,
  predictiveAlertService,
  type RawUsageRecord,
} from '../ml/index.js';
import { db } from '../db/index.js';
import { telemetryEvents, budgets } from '../db/schema.js';
import { eq, and, gte, lte, desc } from 'drizzle-orm';
import logger from '../utils/logger.js';

const router: ExpressRouter = Router();

// ============================================
// VALIDATION SCHEMAS
// ============================================

const ForecastQuerySchema = z.object({
  horizonDays: z.string().transform(Number).pipe(z.number().min(1).max(30)).optional(),
  periodType: z.enum(['hour', 'day', 'week']).optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
});

const PatternQuerySchema = z.object({
  days: z.string().transform(Number).pipe(z.number().min(1).max(90)).optional(),
  detectPatterns: z.string().transform(v => v === 'true').optional(),
});

const AlertQuerySchema = z.object({
  days: z.string().transform(Number).pipe(z.number().min(1).max(30)).optional(),
  priority: z.enum(['low', 'medium', 'high', 'critical']).optional(),
  type: z.string().optional(),
});

const BudgetProjectionSchema = z.object({
  budgetId: z.string().uuid(),
  days: z.number().min(1).max(30).optional(),
});

const AcknowledgeAlertSchema = z.object({
  alertId: z.string(),
  action: z.string().optional(),
});

const ConfigUpdateSchema = z.object({
  budgetExceedThreshold: z.number().min(0).max(1).optional(),
  costSpikeThreshold: z.number().min(0).optional(),
  anomalyConfidenceThreshold: z.number().min(0).max(1).optional(),
  forecastLookAheadDays: z.number().min(1).max(30).optional(),
  alertExpirationHours: z.number().min(1).max(168).optional(),
});

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Fetch usage data for an organization
 */
async function fetchUsageData(
  organizationId: string,
  startDate: Date,
  endDate: Date
): Promise<RawUsageRecord[]> {
  try {
    const result = await db.select()
      .from(telemetryEvents)
      .where(and(
        eq(telemetryEvents.organizationId, organizationId),
        gte(telemetryEvents.timestamp, startDate),
        lte(telemetryEvents.timestamp, endDate)
      ))
      .orderBy(desc(telemetryEvents.timestamp))
      .limit(10000);

    return result.map(row => ({
      timestamp: new Date(row.timestamp),
      model: row.model,
      provider: row.provider,
      inputTokens: row.promptTokens,
      outputTokens: row.completionTokens,
      cost: Number(row.cost),
      latency: row.latency,
      status: row.status as 'success' | 'error',
      organizationId: row.organizationId,
    }));
  } catch (error) {
    logger.error('Failed to fetch usage data', { error: (error as Error).message });
    return [];
  }
}

/**
 * Get organization ID from request
 */
function getOrganizationId(req: Request): string {
  // Try to get from user context, fall back to query param or header
  const user = req.user as any;
  return user?.organizationId || req.query.organizationId as string || 'default';
}

// ============================================
// ROUTES
// ============================================

/**
 * GET /api/forecasting/forecast
 * Generate cost forecast
 */
router.get('/forecast', validateQuery(ForecastQuerySchema), async (req: Request, res: Response) => {
  try {
    const organizationId = getOrganizationId(req);
    const { horizonDays, periodType, startDate, endDate } = req.query as any;

    const end = endDate ? new Date(endDate) : new Date();
    const start = startDate
      ? new Date(startDate)
      : new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000); // Default 30 days

    const usageData = await fetchUsageData(organizationId, start, end);

    if (usageData.length === 0) {
      return res.status(200).json({
        message: 'No usage data available for forecasting',
        forecast: null,
      });
    }

    const forecast = await costForecaster.forecast(organizationId, usageData, {
      horizonDays: horizonDays || 7,
      periodType: periodType || 'day',
    });

    res.json(forecast);
  } catch (error) {
    logger.error('Forecast generation failed', { error: (error as Error).message });
    res.status(500).json({ error: 'Failed to generate forecast' });
  }
});

/**
 * GET /api/forecasting/patterns
 * Analyze usage patterns
 */
router.get('/patterns', validateQuery(PatternQuerySchema), async (req: Request, res: Response) => {
  try {
    const organizationId = getOrganizationId(req);
    const { days, detectPatterns } = req.query as any;

    const end = new Date();
    const start = new Date(end.getTime() - (days || 30) * 24 * 60 * 60 * 1000);

    const usageData = await fetchUsageData(organizationId, start, end);

    if (usageData.length === 0) {
      return res.status(200).json({
        message: 'No usage data available for pattern analysis',
        analysis: null,
      });
    }

    const features = featureExtractor.extractFeatures(usageData);
    const analysis = patternDetector.analyze(features);

    res.json({
      period: analysis.period,
      anomalies: analysis.anomalies,
      costTrend: analysis.costTrend,
      usageTrend: analysis.usageTrend,
      seasonalPattern: analysis.seasonalPattern,
      statistics: analysis.statistics,
      alerts: analysis.alerts,
      dataPoints: features.length,
    });
  } catch (error) {
    logger.error('Pattern analysis failed', { error: (error as Error).message });
    res.status(500).json({ error: 'Failed to analyze patterns' });
  }
});

/**
 * GET /api/forecasting/anomalies
 * Get detected anomalies
 */
router.get('/anomalies', validateQuery(PatternQuerySchema), async (req: Request, res: Response) => {
  try {
    const organizationId = getOrganizationId(req);
    const { days } = req.query as any;

    const end = new Date();
    const start = new Date(end.getTime() - (days || 7) * 24 * 60 * 60 * 1000);

    const usageData = await fetchUsageData(organizationId, start, end);

    if (usageData.length === 0) {
      return res.status(200).json({ anomalies: [] });
    }

    const features = featureExtractor.extractFeatures(usageData);
    const analysis = patternDetector.analyze(features);

    res.json({
      anomalies: analysis.anomalies,
      count: analysis.anomalies.length,
      period: analysis.period,
    });
  } catch (error) {
    logger.error('Anomaly detection failed', { error: (error as Error).message });
    res.status(500).json({ error: 'Failed to detect anomalies' });
  }
});

/**
 * GET /api/forecasting/trends
 * Get trend analysis
 */
router.get('/trends', validateQuery(PatternQuerySchema), async (req: Request, res: Response) => {
  try {
    const organizationId = getOrganizationId(req);
    const { days } = req.query as any;

    const end = new Date();
    const start = new Date(end.getTime() - (days || 30) * 24 * 60 * 60 * 1000);

    const usageData = await fetchUsageData(organizationId, start, end);

    if (usageData.length === 0) {
      return res.status(200).json({
        costTrend: null,
        usageTrend: null,
      });
    }

    const features = featureExtractor.extractFeatures(usageData);
    const analysis = patternDetector.analyze(features);

    res.json({
      costTrend: analysis.costTrend,
      usageTrend: analysis.usageTrend,
      statistics: analysis.statistics,
    });
  } catch (error) {
    logger.error('Trend analysis failed', { error: (error as Error).message });
    res.status(500).json({ error: 'Failed to analyze trends' });
  }
});

/**
 * POST /api/forecasting/budget-projection
 * Project budget usage
 */
router.post('/budget-projection', validateBody(BudgetProjectionSchema), async (req: Request, res: Response) => {
  try {
    const organizationId = getOrganizationId(req);
    const { budgetId, days } = req.body;

    // Fetch budget
    const [budget] = await db.select()
      .from(budgets)
      .where(eq(budgets.id, budgetId))
      .limit(1);

    if (!budget) {
      return res.status(404).json({ error: 'Budget not found' });
    }

    const end = new Date();
    const start = new Date(end.getTime() - (days || 30) * 24 * 60 * 60 * 1000);

    const usageData = await fetchUsageData(organizationId, start, end);

    // Calculate period end based on budget period
    const now = new Date();
    let periodEnd: Date;
    switch (budget.period) {
      case 'daily':
        periodEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
        break;
      case 'weekly':
        periodEnd = new Date(now.getTime() + (7 - now.getDay()) * 24 * 60 * 60 * 1000);
        break;
      case 'monthly':
        periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);
        break;
      default:
        periodEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    }

    const projection = await costForecaster.projectBudget(
      budget.id,
      budget.name,
      Number(budget.limitAmount),
      Number(budget.currentSpend),
      periodEnd,
      usageData
    );

    res.json(projection);
  } catch (error) {
    logger.error('Budget projection failed', { error: (error as Error).message });
    res.status(500).json({ error: 'Failed to project budget' });
  }
});

/**
 * GET /api/forecasting/alerts
 * Get predictive alerts
 */
router.get('/alerts', validateQuery(AlertQuerySchema), async (req: Request, res: Response) => {
  try {
    const organizationId = getOrganizationId(req);
    const { priority, type } = req.query as any;

    let alerts = predictiveAlertService.getActiveAlerts(organizationId);

    // Filter by priority
    if (priority) {
      alerts = alerts.filter(a => a.priority === priority);
    }

    // Filter by type
    if (type) {
      alerts = alerts.filter(a => a.type === type);
    }

    res.json({
      alerts,
      count: alerts.length,
    });
  } catch (error) {
    logger.error('Failed to fetch alerts', { error: (error as Error).message });
    res.status(500).json({ error: 'Failed to fetch alerts' });
  }
});

/**
 * GET /api/forecasting/alerts/summary
 * Get alert summary
 */
router.get('/alerts/summary', validateQuery(AlertQuerySchema), async (req: Request, res: Response) => {
  try {
    const organizationId = getOrganizationId(req);
    const { days } = req.query as any;

    const summary = await predictiveAlertService.getAlertSummary(
      organizationId,
      days || 7
    );

    res.json(summary);
  } catch (error) {
    logger.error('Failed to fetch alert summary', { error: (error as Error).message });
    res.status(500).json({ error: 'Failed to fetch alert summary' });
  }
});

/**
 * POST /api/forecasting/alerts/acknowledge
 * Acknowledge an alert
 */
router.post('/alerts/acknowledge', validateBody(AcknowledgeAlertSchema), async (req: Request, res: Response) => {
  try {
    const { alertId, action } = req.body;

    const acknowledged = predictiveAlertService.acknowledgeAlert(alertId, action);

    if (!acknowledged) {
      return res.status(404).json({ error: 'Alert not found' });
    }

    res.json({ success: true, alertId, action });
  } catch (error) {
    logger.error('Failed to acknowledge alert', { error: (error as Error).message });
    res.status(500).json({ error: 'Failed to acknowledge alert' });
  }
});

/**
 * POST /api/forecasting/analyze
 * Trigger full analysis and alert generation
 */
router.post('/analyze', async (req: Request, res: Response) => {
  try {
    const organizationId = getOrganizationId(req);

    const end = new Date();
    const start = new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);

    const usageData = await fetchUsageData(organizationId, start, end);

    if (usageData.length === 0) {
      return res.status(200).json({
        message: 'No usage data available for analysis',
        alerts: [],
      });
    }

    const alerts = await predictiveAlertService.analyzeAndAlert(organizationId, usageData);

    res.json({
      success: true,
      alertsGenerated: alerts.length,
      alerts,
    });
  } catch (error) {
    logger.error('Analysis failed', { error: (error as Error).message });
    res.status(500).json({ error: 'Failed to run analysis' });
  }
});

/**
 * GET /api/forecasting/features
 * Get extracted features (for debugging/advanced users)
 */
router.get('/features', validateQuery(PatternQuerySchema), async (req: Request, res: Response) => {
  try {
    const organizationId = getOrganizationId(req);
    const { days } = req.query as any;

    const end = new Date();
    const start = new Date(end.getTime() - (days || 7) * 24 * 60 * 60 * 1000);

    const usageData = await fetchUsageData(organizationId, start, end);
    const features = featureExtractor.extractFeatures(usageData);

    // Convert to serializable format (Maps to objects)
    const serializable = features.map(f => ({
      ...f,
      modelDistribution: Object.fromEntries(f.modelDistribution),
    }));

    res.json({
      features: serializable,
      count: features.length,
      config: featureExtractor.getConfig(),
    });
  } catch (error) {
    logger.error('Feature extraction failed', { error: (error as Error).message });
    res.status(500).json({ error: 'Failed to extract features' });
  }
});

/**
 * GET /api/forecasting/seasonal
 * Get seasonal patterns
 */
router.get('/seasonal', validateQuery(PatternQuerySchema), async (req: Request, res: Response) => {
  try {
    const organizationId = getOrganizationId(req);
    const { days } = req.query as any;

    const end = new Date();
    const start = new Date(end.getTime() - (days || 30) * 24 * 60 * 60 * 1000);

    const usageData = await fetchUsageData(organizationId, start, end);
    const features = featureExtractor.extractFeatures(usageData);
    const seasonalPattern = featureExtractor.extractSeasonalPatterns(features);

    res.json({
      hourly: seasonalPattern.hourly,
      daily: seasonalPattern.daily,
      labels: {
        hourly: Array.from({ length: 24 }, (_, i) => `${i}:00`),
        daily: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
      },
    });
  } catch (error) {
    logger.error('Seasonal analysis failed', { error: (error as Error).message });
    res.status(500).json({ error: 'Failed to analyze seasonal patterns' });
  }
});

/**
 * GET /api/forecasting/config
 * Get forecasting configuration
 */
router.get('/config', (_req: Request, res: Response) => {
  res.json({
    featureExtractor: featureExtractor.getConfig(),
    patternDetector: patternDetector.getConfig(),
    forecaster: costForecaster.getConfig(),
    alerts: predictiveAlertService.getConfig(),
  });
});

/**
 * PATCH /api/forecasting/config
 * Update forecasting configuration
 */
router.patch('/config', validateBody(ConfigUpdateSchema), (req: Request, res: Response) => {
  try {
    predictiveAlertService.updateConfig(req.body);
    res.json({
      success: true,
      config: predictiveAlertService.getConfig(),
    });
  } catch (error) {
    logger.error('Failed to update config', { error: (error as Error).message });
    res.status(500).json({ error: 'Failed to update configuration' });
  }
});

export default router;
