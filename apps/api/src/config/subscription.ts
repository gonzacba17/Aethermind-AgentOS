/**
 * Stripe and Email Configuration Constants
 * Central place for all subscription-related configuration
 */

// Stripe Price ID to Plan Mapping
export const STRIPE_PRICE_TO_PLAN: Record<string, 'pro' | 'enterprise'> = {
  [process.env.STRIPE_PRO_PRICE_ID || 'price_pro']: 'pro',
  [process.env.STRIPE_ENTERPRISE_PRICE_ID || 'price_enterprise']: 'enterprise',
};

// Plan display names
export const PLAN_NAMES: Record<string, string> = {
  free: 'Free',
  pro: 'Pro',
  enterprise: 'Enterprise',
};

// Plan limits
export const PLAN_LIMITS = {
  free: {
    maxAgents: 3,
    logRetentionDays: 30,
    usageLimit: 100,
  },
  pro: {
    maxAgents: 50,
    logRetentionDays: 90,
    usageLimit: 10000,
  },
  enterprise: {
    maxAgents: -1, // unlimited
    logRetentionDays: 365,
    usageLimit: -1, // unlimited
  },
} as const;

// Subscription statuses
export const SUBSCRIPTION_STATUSES = {
  FREE: 'free',
  TRIAL: 'trial',
  ACTIVE: 'active',
  PAST_DUE: 'past_due',
  CANCELLED: 'cancelled',
  INACTIVE: 'inactive',
} as const;

// Token expiry times
export const TOKEN_EXPIRY = {
  EMAIL_VERIFICATION: 24 * 60 * 60 * 1000, // 24 hours
  PASSWORD_RESET: 60 * 60 * 1000, // 1 hour
  JWT: '7d', // 7 days
} as const;

// Email configuration
export const EMAIL_CONFIG = {
  FROM_NAME: 'Aethermind',
  SUPPORT_EMAIL: 'support@aethermind.com',
  NO_REPLY_EMAIL: process.env.FROM_EMAIL || 'noreply@aethermind.com',
} as const;

// Stripe webhook events we handle
export const STRIPE_WEBHOOK_EVENTS = [
  'customer.subscription.created',
  'customer.subscription.updated',
  'customer.subscription.deleted',
  'invoice.payment_succeeded',
  'invoice.payment_failed',
  'checkout.session.completed',
] as const;

export default {
  STRIPE_PRICE_TO_PLAN,
  PLAN_NAMES,
  PLAN_LIMITS,
  SUBSCRIPTION_STATUSES,
  TOKEN_EXPIRY,
  EMAIL_CONFIG,
  STRIPE_WEBHOOK_EVENTS,
};
