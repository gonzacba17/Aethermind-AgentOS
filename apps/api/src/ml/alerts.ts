/**
 * Predictive Alert System
 *
 * Generates proactive alerts based on forecasts, anomalies,
 * and pattern analysis to help users prevent budget overruns.
 */

import { z } from 'zod';
import {
  CostForecaster,
  ForecastResult,
  BudgetProjection,
  costForecaster,
} from './forecaster.js';
import {
  PatternDetector,
  PatternAnalysisResult,
  DetectedAnomaly,
  PatternAlert,
  patternDetector,
} from './patterns.js';
import {
  FeatureExtractor,
  RawUsageRecord,
  featureExtractor,
} from './features.js';
import { db, pool } from '../db/index.js';
import { budgets, users, alertLogs } from '../db/schema.js';
import { eq, and, sql } from 'drizzle-orm';
import logger from '../utils/logger.js';

/**
 * Predictive alert types
 */
export type PredictiveAlertType =
  | 'budget_forecast_exceed'
  | 'cost_spike_predicted'
  | 'anomaly_detected'
  | 'trend_warning'
  | 'seasonal_peak_approaching'
  | 'usage_pattern_change'
  | 'model_cost_optimization';

/**
 * Alert priority
 */
export type AlertPriority = 'low' | 'medium' | 'high' | 'critical';

/**
 * Delivery channel
 */
export type DeliveryChannel = 'email' | 'slack' | 'webhook' | 'in_app';

/**
 * Predictive alert
 */
export interface PredictiveAlert {
  id: string;
  type: PredictiveAlertType;
  priority: AlertPriority;
  organizationId: string;
  userId?: string;
  budgetId?: string;
  title: string;
  message: string;
  details: Record<string, unknown>;
  createdAt: Date;
  expiresAt: Date;
  acknowledgedAt?: Date;
  actionTaken?: string;
  channels: DeliveryChannel[];
  delivered: boolean;
  deliveryErrors: string[];
}

/**
 * Alert rule
 */
export interface AlertRule {
  id: string;
  organizationId: string;
  name: string;
  enabled: boolean;
  type: PredictiveAlertType;
  conditions: AlertCondition[];
  actions: AlertAction[];
  cooldownMinutes: number;
  lastTriggeredAt?: Date;
}

/**
 * Alert condition
 */
export interface AlertCondition {
  field: string;
  operator: 'gt' | 'lt' | 'eq' | 'gte' | 'lte' | 'contains';
  value: number | string | boolean;
}

/**
 * Alert action
 */
export interface AlertAction {
  type: 'notify' | 'pause_budget' | 'reduce_limits' | 'webhook';
  config: Record<string, unknown>;
}

/**
 * Alert summary
 */
export interface AlertSummary {
  organizationId: string;
  period: { start: Date; end: Date };
  totalAlerts: number;
  byPriority: Record<AlertPriority, number>;
  byType: Record<string, number>;
  acknowledgedCount: number;
  activeAlerts: PredictiveAlert[];
  recentActions: Array<{ alertId: string; action: string; timestamp: Date }>;
}

/**
 * Alert System Configuration
 */
export interface PredictiveAlertConfig {
  // Forecast thresholds
  budgetExceedThreshold: number; // Probability threshold (0-1)
  costSpikeThreshold: number; // Percentage increase
  anomalyConfidenceThreshold: number;

  // Timing
  forecastLookAheadDays: number;
  alertExpirationHours: number;
  minAlertCooldownMinutes: number;

  // Delivery
  defaultChannels: DeliveryChannel[];
  batchDeliveryIntervalMinutes: number;

  // Limits
  maxActiveAlertsPerOrg: number;
  maxAlertsPerHour: number;
}

const DEFAULT_CONFIG: PredictiveAlertConfig = {
  budgetExceedThreshold: 0.7, // 70% probability
  costSpikeThreshold: 50, // 50% increase
  anomalyConfidenceThreshold: 0.8,
  forecastLookAheadDays: 7,
  alertExpirationHours: 48,
  minAlertCooldownMinutes: 60,
  defaultChannels: ['in_app', 'email'],
  batchDeliveryIntervalMinutes: 15,
  maxActiveAlertsPerOrg: 50,
  maxAlertsPerHour: 10,
};

/**
 * Predictive Alert Service Class
 */
export class PredictiveAlertService {
  private config: PredictiveAlertConfig;
  private forecaster: CostForecaster;
  private patternDetector: PatternDetector;
  private featureExtractor: FeatureExtractor;
  private alertCounter = 0;
  private activeAlerts: Map<string, PredictiveAlert[]> = new Map();
  private alertRules: Map<string, AlertRule[]> = new Map();
  private recentAlertCounts: Map<string, { count: number; resetAt: Date }> = new Map();

  // Notification handlers
  private emailHandler?: (alert: PredictiveAlert, recipient: string) => Promise<void>;
  private slackHandler?: (alert: PredictiveAlert, webhookUrl: string) => Promise<void>;
  private webhookHandler?: (alert: PredictiveAlert, url: string) => Promise<void>;

  constructor(
    config: Partial<PredictiveAlertConfig> = {},
    forecaster?: CostForecaster,
    detector?: PatternDetector,
    extractor?: FeatureExtractor
  ) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.forecaster = forecaster || costForecaster;
    this.patternDetector = detector || patternDetector;
    this.featureExtractor = extractor || featureExtractor;
  }

  /**
   * Analyze and generate alerts for an organization
   */
  async analyzeAndAlert(
    organizationId: string,
    usageData: RawUsageRecord[]
  ): Promise<PredictiveAlert[]> {
    const generatedAlerts: PredictiveAlert[] = [];

    // Check rate limit
    if (!this.checkRateLimit(organizationId)) {
      logger.warn('Alert rate limit exceeded', { organizationId });
      return [];
    }

    try {
      // Extract features
      const features = this.featureExtractor.extractFeatures(usageData);

      // Run pattern analysis
      const patternAnalysis = this.patternDetector.analyze(features);

      // Generate forecast
      const forecast = await this.forecaster.forecast(organizationId, usageData);

      // Get organization's budgets
      const orgBudgets = await this.getOrganizationBudgets(organizationId);

      // Generate budget forecast alerts
      for (const budget of orgBudgets) {
        const projection = await this.forecaster.projectBudget(
          budget.id,
          budget.name,
          Number(budget.limitAmount),
          Number(budget.currentSpend),
          this.getBudgetPeriodEnd(budget),
          usageData
        );

        const budgetAlerts = this.generateBudgetAlerts(organizationId, projection, budget);
        generatedAlerts.push(...budgetAlerts);
      }

      // Generate anomaly alerts
      const anomalyAlerts = this.generateAnomalyAlerts(organizationId, patternAnalysis);
      generatedAlerts.push(...anomalyAlerts);

      // Generate trend alerts
      const trendAlerts = this.generateTrendAlerts(organizationId, forecast, patternAnalysis);
      generatedAlerts.push(...trendAlerts);

      // Generate optimization alerts
      const optimizationAlerts = this.generateOptimizationAlerts(organizationId, features);
      generatedAlerts.push(...optimizationAlerts);

      // Filter duplicates and apply rules
      const filteredAlerts = this.filterAndPrioritize(organizationId, generatedAlerts);

      // Store alerts
      for (const alert of filteredAlerts) {
        await this.storeAlert(alert);
      }

      // Update active alerts
      this.activeAlerts.set(organizationId, [
        ...(this.activeAlerts.get(organizationId) || []),
        ...filteredAlerts,
      ]);

      // Deliver alerts
      await this.deliverAlerts(filteredAlerts);

      return filteredAlerts;
    } catch (error) {
      logger.error('Error analyzing and alerting', {
        organizationId,
        error: (error as Error).message,
      });
      return [];
    }
  }

  /**
   * Generate budget forecast alerts
   */
  private generateBudgetAlerts(
    organizationId: string,
    projection: BudgetProjection,
    budget: any
  ): PredictiveAlert[] {
    const alerts: PredictiveAlert[] = [];

    // High probability of exceeding budget
    if (projection.exceedsProbability >= this.config.budgetExceedThreshold) {
      const priority = this.getPriorityFromProbability(projection.exceedsProbability);

      alerts.push(this.createAlert(
        'budget_forecast_exceed',
        priority,
        organizationId,
        `Budget "${projection.budgetName}" Projected to Exceed`,
        projection.recommendation,
        {
          budgetId: projection.budgetId,
          budgetLimit: projection.budgetLimit,
          currentSpend: projection.currentSpend,
          projectedSpend: projection.projectedSpend,
          exceedsProbability: projection.exceedsProbability,
          daysUntilExceed: projection.daysUntilExceed,
          estimatedExceedDate: projection.estimatedExceedDate,
        },
        projection.budgetId
      ));
    }

    // Approaching budget threshold (80%)
    const currentUtilization = projection.currentSpend / projection.budgetLimit;
    if (currentUtilization >= 0.8 && currentUtilization < 1.0) {
      alerts.push(this.createAlert(
        'budget_forecast_exceed',
        'medium',
        organizationId,
        `Budget "${projection.budgetName}" at ${(currentUtilization * 100).toFixed(0)}%`,
        `Current spend is $${projection.currentSpend.toFixed(2)} of $${projection.budgetLimit.toFixed(2)} limit.`,
        {
          budgetId: projection.budgetId,
          utilization: currentUtilization,
          remaining: projection.budgetLimit - projection.currentSpend,
        },
        projection.budgetId
      ));
    }

    return alerts;
  }

  /**
   * Generate anomaly alerts
   */
  private generateAnomalyAlerts(
    organizationId: string,
    analysis: PatternAnalysisResult
  ): PredictiveAlert[] {
    const alerts: PredictiveAlert[] = [];

    for (const anomaly of analysis.anomalies) {
      if (anomaly.confidence >= this.config.anomalyConfidenceThreshold) {
        alerts.push(this.createAlert(
          'anomaly_detected',
          this.mapAnomalySeverity(anomaly.severity),
          organizationId,
          this.getAnomalyTitle(anomaly),
          anomaly.description,
          {
            anomalyType: anomaly.type,
            observedValue: anomaly.observedValue,
            expectedValue: anomaly.expectedValue,
            deviation: anomaly.deviation,
            confidence: anomaly.confidence,
            timestamp: anomaly.timestamp,
          }
        ));
      }
    }

    return alerts;
  }

  /**
   * Generate trend alerts
   */
  private generateTrendAlerts(
    organizationId: string,
    forecast: ForecastResult,
    analysis: PatternAnalysisResult
  ): PredictiveAlert[] {
    const alerts: PredictiveAlert[] = [];

    // Rising cost trend
    if (forecast.summary.trend === 'increasing' && forecast.summary.trendConfidence > 0.7) {
      const weeklyIncrease = forecast.summary.averageDailyCost * 7;
      const projectedMonthly = forecast.summary.averageDailyCost * 30;

      if (projectedMonthly > 100) { // Only alert if significant
        alerts.push(this.createAlert(
          'trend_warning',
          forecast.summary.averageDailyCost > 50 ? 'high' : 'medium',
          organizationId,
          'Rising Cost Trend Detected',
          `Costs are projected to average $${forecast.summary.averageDailyCost.toFixed(2)}/day, totaling approximately $${projectedMonthly.toFixed(2)} this month.`,
          {
            averageDailyCost: forecast.summary.averageDailyCost,
            projectedWeeklyCost: weeklyIncrease,
            projectedMonthlyCost: projectedMonthly,
            trendConfidence: forecast.summary.trendConfidence,
            peakCost: forecast.summary.peakCost,
            peakDate: forecast.summary.peakDate,
          }
        ));
      }
    }

    // Volatile pattern warning
    if (forecast.summary.trend === 'volatile') {
      alerts.push(this.createAlert(
        'usage_pattern_change',
        'medium',
        organizationId,
        'Volatile Cost Pattern',
        'Cost patterns are highly variable, making forecasting difficult. Consider implementing more consistent usage policies.',
        {
          trendDirection: forecast.summary.trend,
          confidence: forecast.summary.trendConfidence,
        }
      ));
    }

    return alerts;
  }

  /**
   * Generate optimization alerts
   */
  private generateOptimizationAlerts(
    organizationId: string,
    features: ReturnType<FeatureExtractor['extractFeatures']>
  ): PredictiveAlert[] {
    const alerts: PredictiveAlert[] = [];

    if (features.length === 0) return alerts;

    // Analyze model usage for optimization opportunities
    const modelUsage = new Map<string, { count: number; cost: number }>();
    for (const f of features) {
      for (const [model, count] of f.modelDistribution) {
        const existing = modelUsage.get(model) || { count: 0, cost: 0 };
        existing.count += count;
        existing.cost += (f.totalCost / f.requestCount) * count;
        modelUsage.set(model, existing);
      }
    }

    // Check for expensive model overuse
    const totalCost = Array.from(modelUsage.values()).reduce((s, m) => s + m.cost, 0);
    const expensiveModels = ['gpt-4', 'gpt-4-turbo', 'claude-3-opus', 'claude-opus'];

    for (const [model, usage] of modelUsage) {
      const isExpensive = expensiveModels.some(e => model.toLowerCase().includes(e));
      if (isExpensive && usage.cost / totalCost > 0.5) {
        alerts.push(this.createAlert(
          'model_cost_optimization',
          'medium',
          organizationId,
          'Premium Model Optimization Opportunity',
          `${model} accounts for ${((usage.cost / totalCost) * 100).toFixed(0)}% of costs. Consider using cheaper models for routine tasks.`,
          {
            model,
            costPercentage: usage.cost / totalCost,
            totalCost: usage.cost,
            requestCount: usage.count,
          }
        ));
      }
    }

    return alerts;
  }

  /**
   * Create alert object
   */
  private createAlert(
    type: PredictiveAlertType,
    priority: AlertPriority,
    organizationId: string,
    title: string,
    message: string,
    details: Record<string, unknown>,
    budgetId?: string
  ): PredictiveAlert {
    const now = new Date();
    return {
      id: `pa-${++this.alertCounter}-${Date.now()}`,
      type,
      priority,
      organizationId,
      budgetId,
      title,
      message,
      details,
      createdAt: now,
      expiresAt: new Date(now.getTime() + this.config.alertExpirationHours * 60 * 60 * 1000),
      channels: [...this.config.defaultChannels],
      delivered: false,
      deliveryErrors: [],
    };
  }

  /**
   * Filter and prioritize alerts
   */
  private filterAndPrioritize(
    organizationId: string,
    alerts: PredictiveAlert[]
  ): PredictiveAlert[] {
    // Remove duplicates (same type and budget within cooldown)
    const existingAlerts = this.activeAlerts.get(organizationId) || [];
    const now = new Date();
    const cooldownMs = this.config.minAlertCooldownMinutes * 60 * 1000;

    const filtered = alerts.filter(alert => {
      const isDuplicate = existingAlerts.some(existing =>
        existing.type === alert.type &&
        existing.budgetId === alert.budgetId &&
        now.getTime() - existing.createdAt.getTime() < cooldownMs
      );
      return !isDuplicate;
    });

    // Limit total active alerts
    const currentActive = existingAlerts.filter(a => a.expiresAt > now);
    const availableSlots = this.config.maxActiveAlertsPerOrg - currentActive.length;

    // Sort by priority and take available slots
    const priorityOrder: Record<AlertPriority, number> = {
      critical: 0,
      high: 1,
      medium: 2,
      low: 3,
    };

    const sorted = filtered.sort(
      (a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]
    );

    return sorted.slice(0, Math.max(0, availableSlots));
  }

  /**
   * Store alert to database
   */
  private async storeAlert(alert: PredictiveAlert): Promise<void> {
    // Skip storing if no budgetId (required field in schema)
    if (!alert.budgetId) {
      logger.debug('Skipping alert storage - no budgetId', { alertId: alert.id });
      return;
    }

    try {
      await db.insert(alertLogs).values({
        budgetId: alert.budgetId,
        alertType: alert.type,
        channel: alert.channels.join(','),
        recipient: alert.organizationId,
        message: `${alert.title}: ${alert.message}`,
        success: true,
        error: null,
      });
    } catch (error) {
      logger.error('Failed to store alert', {
        alertId: alert.id,
        error: (error as Error).message,
      });
    }
  }

  /**
   * Deliver alerts through configured channels
   */
  private async deliverAlerts(alerts: PredictiveAlert[]): Promise<void> {
    for (const alert of alerts) {
      for (const channel of alert.channels) {
        try {
          switch (channel) {
            case 'email':
              if (this.emailHandler) {
                await this.emailHandler(alert, alert.organizationId);
              }
              break;
            case 'slack':
              if (this.slackHandler) {
                await this.slackHandler(alert, '');
              }
              break;
            case 'webhook':
              if (this.webhookHandler) {
                await this.webhookHandler(alert, '');
              }
              break;
            case 'in_app':
              // In-app alerts are already stored in database
              break;
          }
          alert.delivered = true;
        } catch (error) {
          alert.deliveryErrors.push(`${channel}: ${(error as Error).message}`);
        }
      }
    }
  }

  /**
   * Get organization budgets
   */
  private async getOrganizationBudgets(organizationId: string): Promise<any[]> {
    try {
      const result = await db.select()
        .from(budgets)
        .where(eq(budgets.status, 'active'))
        .limit(50);
      return result;
    } catch (error) {
      logger.error('Failed to fetch budgets', { error: (error as Error).message });
      return [];
    }
  }

  /**
   * Get budget period end date
   */
  private getBudgetPeriodEnd(budget: any): Date {
    const now = new Date();
    switch (budget.period) {
      case 'daily':
        return new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
      case 'weekly':
        return new Date(now.getTime() + (7 - now.getDay()) * 24 * 60 * 60 * 1000);
      case 'monthly':
        return new Date(now.getFullYear(), now.getMonth() + 1, 1);
      default:
        return new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    }
  }

  /**
   * Check rate limit
   */
  private checkRateLimit(organizationId: string): boolean {
    const now = new Date();
    const entry = this.recentAlertCounts.get(organizationId);

    if (!entry || entry.resetAt < now) {
      this.recentAlertCounts.set(organizationId, {
        count: 1,
        resetAt: new Date(now.getTime() + 60 * 60 * 1000), // 1 hour
      });
      return true;
    }

    if (entry.count >= this.config.maxAlertsPerHour) {
      return false;
    }

    entry.count++;
    return true;
  }

  /**
   * Get priority from probability
   */
  private getPriorityFromProbability(probability: number): AlertPriority {
    if (probability >= 0.95) return 'critical';
    if (probability >= 0.85) return 'high';
    if (probability >= 0.7) return 'medium';
    return 'low';
  }

  /**
   * Map anomaly severity to alert priority
   */
  private mapAnomalySeverity(severity: 'low' | 'medium' | 'high' | 'critical'): AlertPriority {
    return severity;
  }

  /**
   * Get anomaly title
   */
  private getAnomalyTitle(anomaly: DetectedAnomaly): string {
    const titles: Record<string, string> = {
      cost_spike: 'Cost Spike Detected',
      cost_drop: 'Unusual Cost Drop',
      usage_surge: 'Usage Surge Detected',
      usage_drop: 'Usage Drop Detected',
      latency_spike: 'Latency Spike',
      error_rate_spike: 'Error Rate Spike',
      unusual_model_usage: 'Unusual Model Usage',
      off_hours_activity: 'Off-Hours Activity',
      trend_break: 'Trend Break Detected',
    };
    return titles[anomaly.type] || 'Anomaly Detected';
  }

  /**
   * Get active alerts for organization
   */
  getActiveAlerts(organizationId: string): PredictiveAlert[] {
    const now = new Date();
    return (this.activeAlerts.get(organizationId) || [])
      .filter(a => a.expiresAt > now && !a.acknowledgedAt);
  }

  /**
   * Acknowledge alert
   */
  acknowledgeAlert(alertId: string, action?: string): boolean {
    for (const [orgId, alerts] of this.activeAlerts) {
      const alert = alerts.find(a => a.id === alertId);
      if (alert) {
        alert.acknowledgedAt = new Date();
        alert.actionTaken = action;
        return true;
      }
    }
    return false;
  }

  /**
   * Get alert summary
   */
  async getAlertSummary(
    organizationId: string,
    days: number = 7
  ): Promise<AlertSummary> {
    const now = new Date();
    const startDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

    const activeAlerts = this.getActiveAlerts(organizationId);
    const allAlerts = (this.activeAlerts.get(organizationId) || [])
      .filter(a => a.createdAt >= startDate);

    const byPriority: Record<AlertPriority, number> = {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
    };
    const byType: Record<string, number> = {};

    for (const alert of allAlerts) {
      byPriority[alert.priority]++;
      byType[alert.type] = (byType[alert.type] || 0) + 1;
    }

    const acknowledgedCount = allAlerts.filter(a => a.acknowledgedAt).length;

    return {
      organizationId,
      period: { start: startDate, end: now },
      totalAlerts: allAlerts.length,
      byPriority,
      byType,
      acknowledgedCount,
      activeAlerts,
      recentActions: allAlerts
        .filter(a => a.actionTaken)
        .map(a => ({
          alertId: a.id,
          action: a.actionTaken!,
          timestamp: a.acknowledgedAt!,
        })),
    };
  }

  /**
   * Set notification handlers
   */
  setEmailHandler(handler: (alert: PredictiveAlert, recipient: string) => Promise<void>): void {
    this.emailHandler = handler;
  }

  setSlackHandler(handler: (alert: PredictiveAlert, webhookUrl: string) => Promise<void>): void {
    this.slackHandler = handler;
  }

  setWebhookHandler(handler: (alert: PredictiveAlert, url: string) => Promise<void>): void {
    this.webhookHandler = handler;
  }

  /**
   * Get configuration
   */
  getConfig(): PredictiveAlertConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  updateConfig(updates: Partial<PredictiveAlertConfig>): void {
    this.config = { ...this.config, ...updates };
  }
}

// Export singleton instance
export const predictiveAlertService = new PredictiveAlertService();
