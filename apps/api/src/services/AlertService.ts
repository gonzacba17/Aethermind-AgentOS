import { PrismaClient } from '@prisma/client';
import type { Budget, User } from '@prisma/client';

export class AlertService {
  constructor(
    private prisma: PrismaClient,
    private sendgridApiKey?: string,
    private slackWebhookUrl?: string
  ) {}

  /**
   * Check all active budgets and send alerts if thresholds are exceeded
   */
  async checkAndSendAlerts(): Promise<void> {
    const budgets = await this.prisma.budget.findMany({
      where: { status: 'active' },
      include: { user: true },
    });

    for (const budget of budgets) {
      await this.checkBudgetAlerts(budget);
    }
  }

  /**
   * Check a single budget and send alerts if needed
   */
  private async checkBudgetAlerts(budget: Budget & { user: User }): Promise<void> {
    const percentUsed = (Number(budget.currentSpend) / Number(budget.limitAmount)) * 100;

    // 80% warning (or custom alertAt threshold)
    if (percentUsed >= budget.alertAt && !budget.alert80Sent) {
      await this.sendAlert(budget, 'warning', percentUsed);
      await this.prisma.budget.update({
        where: { id: budget.id },
        data: { alert80Sent: true },
      });
    }

    // 100% critical
    if (percentUsed >= 100 && !budget.alert100Sent) {
      await this.sendAlert(budget, 'critical', percentUsed);
      await this.prisma.budget.update({
        where: { id: budget.id },
        data: { alert100Sent: true },
      });
    }
  }

  /**
   * Send alert via configured channels
   */
  private async sendAlert(
    budget: Budget & { user: User },
    severity: 'warning' | 'critical',
    percentUsed: number
  ): Promise<void> {
    const message = this.buildAlertMessage(budget, severity, percentUsed);
    const errors: string[] = [];

    // Send email if configured
    if (this.sendgridApiKey && budget.user.email) {
      try {
        await this.sendEmail(budget.user.email, budget.name, message, severity);
      } catch (error) {
        errors.push(`Email: ${(error as Error).message}`);
      }
    }

    // Send Slack if configured
    if (this.slackWebhookUrl) {
      try {
        await this.sendSlack(budget.name, message, severity);
      } catch (error) {
        errors.push(`Slack: ${(error as Error).message}`);
      }
    }

    // Log alert
    await this.prisma.alertLog.create({
      data: {
        budgetId: budget.id,
        alertType: severity,
        channel: this.getChannelsString(),
        recipient: budget.user.email,
        message,
        success: errors.length === 0,
        error: errors.length > 0 ? errors.join('; ') : null,
      },
    });
  }

  /**
   * Build alert message
   */
  private buildAlertMessage(budget: Budget, severity: string, percentUsed: number): string {
    const emoji = severity === 'critical' ? '🚨' : '⚠️';
    return `${emoji} Budget Alert: "${budget.name}"\n\n` +
      `Current spend: $${Number(budget.currentSpend).toFixed(2)}\n` +
      `Limit: $${Number(budget.limitAmount).toFixed(2)}\n` +
      `Usage: ${percentUsed.toFixed(1)}%\n` +
      `Period: ${budget.period}\n` +
      `Scope: ${budget.scope}${budget.scopeId ? ` (${budget.scopeId})` : ''}`;
  }

  /**
   * Send email via SendGrid
   */
  private async sendEmail(
    to: string,
    budgetName: string,
    message: string,
    severity: string
  ): Promise<void> {
    if (!this.sendgridApiKey) {
      throw new Error('SendGrid API key not configured');
    }

    const subject = severity === 'critical' 
      ? `🚨 Budget Exceeded: ${budgetName}`
      : `⚠️ Budget Alert: ${budgetName}`;

    // Using fetch instead of @sendgrid/mail to avoid additional dependency
    const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.sendgridApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        personalizations: [{
          to: [{ email: to }],
          subject,
        }],
        from: {
          email: process.env.ALERT_FROM_EMAIL || 'alerts@aethermind.ai',
          name: 'Aethermind AgentOS',
        },
        content: [{
          type: 'text/plain',
          value: message,
        }, {
          type: 'text/html',
          value: `<pre style="font-family: monospace; background: #f5f5f5; padding: 16px; border-radius: 4px;">${message}</pre>`,
        }],
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`SendGrid API error: ${error}`);
    }
  }

  /**
   * Send Slack notification via webhook
   */
  private async sendSlack(
    budgetName: string,
    message: string,
    severity: string
  ): Promise<void> {
    if (!this.slackWebhookUrl) {
      throw new Error('Slack webhook URL not configured');
    }

    const color = severity === 'critical' ? 'danger' : 'warning';
    
    const response = await fetch(this.slackWebhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        attachments: [{
          color,
          title: `Budget Alert: ${budgetName}`,
          text: message,
          footer: 'Aethermind AgentOS',
          ts: Math.floor(Date.now() / 1000),
        }],
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Slack webhook error: ${error}`);
    }
  }

  /**
   * Get configured channels as string
   */
  private getChannelsString(): string {
    const channels: string[] = [];
    if (this.sendgridApiKey) channels.push('email');
    if (this.slackWebhookUrl) channels.push('slack');
    return channels.join(',') || 'none';
  }
}

export function createAlertService(
  prisma: PrismaClient,
  sendgridApiKey?: string,
  slackWebhookUrl?: string
): AlertService {
  return new AlertService(prisma, sendgridApiKey, slackWebhookUrl);
}
