import Stripe from 'stripe';
import { db, pool } from '../db';
import { users, subscriptionLogs } from '../db/schema';
import { eq } from 'drizzle-orm';
import { emailService } from './EmailService';
import logger from '../utils/logger';

/**
 * Stripe Service - Handles all Stripe-related operations
 * Features:
 * - Webhook event processing with signature verification
 * - Subscription lifecycle management
 * - Customer creation and updates
 * - Price ID to plan mapping
 * - Database synchronization
 */

// Plan to Price ID mapping
const PRICE_TO_PLAN: Record<string, 'pro' | 'enterprise'> = {
  [process.env.STRIPE_PRO_PRICE_ID || '']: 'pro',
  [process.env.STRIPE_ENTERPRISE_PRICE_ID || '']: 'enterprise',
};

export class StripeService {
  private stripe: Stripe | null = null;
  private webhookSecret: string;

  constructor() {
    this.webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || '';

    if (process.env.STRIPE_SECRET_KEY) {
      this.stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
        apiVersion: '2023-10-16',
      });
      console.log('✅ Stripe Service initialized');
    } else {
      console.warn('⚠️  Stripe Service: STRIPE_SECRET_KEY not configured');
    }
  }

  /**
   * Check if Stripe is configured
   */
  isConfigured(): boolean {
    return this.stripe !== null;
  }

  /**
   * Get active subscription for a customer
   * Used to verify subscription status before plan changes
   */
  async getActiveSubscription(customerId: string): Promise<Stripe.Subscription | null> {
    if (!this.stripe) {
      throw new Error('Stripe is not configured');
    }

    try {
      const subscriptions = await this.stripe.subscriptions.list({
        customer: customerId,
        status: 'active',
        limit: 1,
      });

      if (subscriptions.data.length > 0) {
        return subscriptions.data[0] ?? null;
      }

      // Also check for trialing subscriptions
      const trialingSubscriptions = await this.stripe.subscriptions.list({
        customer: customerId,
        status: 'trialing',
        limit: 1,
      });

      if (trialingSubscriptions.data.length > 0) {
        return trialingSubscriptions.data[0] ?? null;
      }

      return null;
    } catch (error) {
      logger.error('Failed to get active subscription from Stripe', {
        customerId,
        error: (error as Error).message,
      });
      throw error;
    }
  }

  /**
   * Verify Stripe webhook signature
   */
  constructWebhookEvent(payload: string | Buffer, signature: string): Stripe.Event {
    if (!this.stripe) {
      throw new Error('Stripe is not configured');
    }

    if (!this.webhookSecret) {
      throw new Error('STRIPE_WEBHOOK_SECRET is not configured');
    }

    try {
      return this.stripe.webhooks.constructEvent(payload, signature, this.webhookSecret);
    } catch (error) {
      throw new Error(`Webhook signature verification failed: ${(error as Error).message}`);
    }
  }

  /**
   * Process Stripe webhook event
   */
  async handleWebhookEvent(event: Stripe.Event): Promise<void> {
    console.log(`📨 Processing Stripe webhook: ${event.type}`);

    try {
      switch (event.type) {
        case 'customer.subscription.created':
          await this.handleSubscriptionCreated(event.data.object as Stripe.Subscription);
          break;

        case 'customer.subscription.updated':
          await this.handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
          break;

        case 'customer.subscription.deleted':
          await this.handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
          break;

        case 'invoice.payment_succeeded':
          await this.handlePaymentSucceeded(event.data.object as Stripe.Invoice);
          break;

        case 'invoice.payment_failed':
          await this.handlePaymentFailed(event.data.object as Stripe.Invoice);
          break;

        case 'checkout.session.completed':
          await this.handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
          break;

        default:
          console.log(`ℹ️  Unhandled webhook event type: ${event.type}`);
      }
    } catch (error) {
      console.error(`❌ Error processing webhook ${event.type}:`, error);
      throw error;
    }
  }

  /**
   * Handle subscription created - uses transaction for data consistency
   */
  private async handleSubscriptionCreated(subscription: Stripe.Subscription): Promise<void> {
    const customerId = subscription.customer as string;
    const priceId = subscription.items.data[0]?.price.id;
    const plan = priceId ? PRICE_TO_PLAN[priceId] : undefined;

    if (!plan) {
      logger.warn(`Unknown price ID: ${priceId}`);
      return;
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Find user by Stripe customer ID with lock
      const userResult = await client.query(
        'SELECT id, email FROM users WHERE stripe_customer_id = $1 FOR UPDATE',
        [customerId]
      );

      if (userResult.rows.length === 0) {
        await client.query('ROLLBACK');
        logger.warn(`User not found for customer: ${customerId}`);
        return;
      }

      const user = userResult.rows[0];

      // Update user subscription
      await client.query(
        `UPDATE users SET
          plan = $1,
          subscription_status = $2,
          stripe_subscription_id = $3,
          trial_ends_at = $4,
          updated_at = NOW()
        WHERE id = $5`,
        [
          plan,
          subscription.status === 'trialing' ? 'trial' : 'active',
          subscription.id,
          subscription.trial_end ? new Date(subscription.trial_end * 1000) : null,
          user.id,
        ]
      );

      // Log the event within transaction
      await client.query(
        'INSERT INTO subscription_logs (user_id, event, metadata) VALUES ($1, $2, $3)',
        [user.id, 'subscription_created', JSON.stringify({
          subscriptionId: subscription.id,
          plan,
          status: subscription.status,
        })]
      );

      await client.query('COMMIT');
      logger.info(`Subscription created for user ${user.email}: ${plan}`);
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Failed to handle subscription created', { error: (error as Error).message });
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Handle subscription updated - uses transaction for data consistency
   */
  private async handleSubscriptionUpdated(subscription: Stripe.Subscription): Promise<void> {
    const customerId = subscription.customer as string;
    const priceId = subscription.items.data[0]?.price.id;
    const plan = priceId ? PRICE_TO_PLAN[priceId] : undefined;

    // Map Stripe status to our subscription status
    let subscriptionStatus = 'inactive';
    if (subscription.status === 'active') subscriptionStatus = 'active';
    else if (subscription.status === 'trialing') subscriptionStatus = 'trial';
    else if (subscription.status === 'past_due') subscriptionStatus = 'past_due';
    else if (subscription.status === 'canceled' || subscription.status === 'unpaid') subscriptionStatus = 'cancelled';

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Find user with lock
      const userResult = await client.query(
        'SELECT id, email, name, plan FROM users WHERE stripe_customer_id = $1 FOR UPDATE',
        [customerId]
      );

      if (userResult.rows.length === 0) {
        await client.query('ROLLBACK');
        logger.warn(`User not found for customer: ${customerId}`);
        return;
      }

      const user = userResult.rows[0];

      // Update user
      await client.query(
        `UPDATE users SET
          plan = $1,
          subscription_status = $2,
          stripe_subscription_id = $3,
          updated_at = NOW()
        WHERE id = $4`,
        [plan || user.plan, subscriptionStatus, subscription.id, user.id]
      );

      // Log the event
      await client.query(
        'INSERT INTO subscription_logs (user_id, event, metadata) VALUES ($1, $2, $3)',
        [user.id, 'subscription_updated', JSON.stringify({
          subscriptionId: subscription.id,
          status: subscription.status,
          newPlan: plan,
        })]
      );

      await client.query('COMMIT');

      // Send notification outside transaction (non-critical)
      if (subscription.status === 'past_due' || subscription.status === 'canceled') {
        await emailService.sendPaymentFailedEmail(user.email, user.name || 'User');
      }

      logger.info(`Subscription updated for user ${user.email}: ${subscriptionStatus}`);
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Failed to handle subscription updated', { error: (error as Error).message });
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Handle subscription deleted - uses transaction for data consistency
   */
  private async handleSubscriptionDeleted(subscription: Stripe.Subscription): Promise<void> {
    const customerId = subscription.customer as string;

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Find user with lock
      const userResult = await client.query(
        'SELECT id, email, name FROM users WHERE stripe_customer_id = $1 FOR UPDATE',
        [customerId]
      );

      if (userResult.rows.length === 0) {
        await client.query('ROLLBACK');
        logger.warn(`User not found for customer: ${customerId}`);
        return;
      }

      const user = userResult.rows[0];

      // Downgrade to free plan
      await client.query(
        `UPDATE users SET
          plan = 'free',
          subscription_status = 'cancelled',
          stripe_subscription_id = NULL,
          trial_ends_at = NULL,
          updated_at = NOW()
        WHERE id = $1`,
        [user.id]
      );

      // Log the event
      await client.query(
        'INSERT INTO subscription_logs (user_id, event, metadata) VALUES ($1, $2, $3)',
        [user.id, 'subscription_deleted', JSON.stringify({
          subscriptionId: subscription.id,
          downgradedTo: 'free',
        })]
      );

      await client.query('COMMIT');

      // Send notification outside transaction
      await emailService.sendSubscriptionCanceledEmail(user.email, user.name || 'User');

      logger.info(`Subscription deleted for user ${user.email}, downgraded to free`);
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Failed to handle subscription deleted', { error: (error as Error).message });
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Handle successful payment - uses transaction for atomic status update
   * Ensures subscription status and payment log are recorded atomically
   */
  private async handlePaymentSucceeded(invoice: Stripe.Invoice): Promise<void> {
    const customerId = invoice.customer as string;

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Find user with row lock to prevent concurrent modifications
      const userResult = await client.query(
        'SELECT id, email FROM users WHERE stripe_customer_id = $1 FOR UPDATE',
        [customerId]
      );

      if (userResult.rows.length === 0) {
        await client.query('ROLLBACK');
        logger.warn(`User not found for customer: ${customerId}`);
        return;
      }

      const user = userResult.rows[0];

      // Update subscription status atomically
      await client.query(
        `UPDATE users SET
          subscription_status = 'active',
          updated_at = NOW()
        WHERE id = $1`,
        [user.id]
      );

      // Log the event within transaction
      await client.query(
        'INSERT INTO subscription_logs (user_id, event, metadata) VALUES ($1, $2, $3)',
        [user.id, 'payment_succeeded', JSON.stringify({
          invoiceId: invoice.id,
          amount: invoice.amount_paid / 100,
          currency: invoice.currency,
        })]
      );

      await client.query('COMMIT');
      logger.info(`Payment succeeded for user ${user.email}: ${invoice.amount_paid / 100} ${invoice.currency}`);
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Failed to handle payment succeeded', { error: (error as Error).message });
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Handle failed payment - uses transaction for atomic status update
   * Records payment failure atomically, sends notification outside transaction
   */
  private async handlePaymentFailed(invoice: Stripe.Invoice): Promise<void> {
    const customerId = invoice.customer as string;

    const client = await pool.connect();
    let userEmail = '';
    let userName = '';

    try {
      await client.query('BEGIN');

      // Find user with row lock
      const userResult = await client.query(
        'SELECT id, email, name FROM users WHERE stripe_customer_id = $1 FOR UPDATE',
        [customerId]
      );

      if (userResult.rows.length === 0) {
        await client.query('ROLLBACK');
        logger.warn(`User not found for customer: ${customerId}`);
        return;
      }

      const user = userResult.rows[0];
      userEmail = user.email;
      userName = user.name || 'User';

      // Update subscription status atomically
      await client.query(
        `UPDATE users SET
          subscription_status = 'past_due',
          updated_at = NOW()
        WHERE id = $1`,
        [user.id]
      );

      // Log the event within transaction
      await client.query(
        'INSERT INTO subscription_logs (user_id, event, metadata) VALUES ($1, $2, $3)',
        [user.id, 'payment_failed', JSON.stringify({
          invoiceId: invoice.id,
          attemptCount: invoice.attempt_count,
        })]
      );

      await client.query('COMMIT');
      logger.warn(`Payment failed for user ${userEmail}, status set to past_due`);
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Failed to handle payment failure', { error: (error as Error).message });
      throw error;
    } finally {
      client.release();
    }

    // Send alert email outside transaction (non-critical operation)
    if (userEmail) {
      try {
        await emailService.sendPaymentFailedEmail(userEmail, userName);
      } catch (error) {
        logger.error('Failed to send payment failed email', {
          email: userEmail,
          error: (error as Error).message
        });
      }
    }
  }

  /**
   * Handle checkout session completed - uses transaction for atomic customer linking
   * Ensures user-customer relationship is established atomically
   */
  private async handleCheckoutCompleted(session: Stripe.Checkout.Session): Promise<void> {
    const customerId = session.customer as string;
    const subscriptionId = session.subscription as string;

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Check if user already linked to this customer
      const existingUserResult = await client.query(
        'SELECT id FROM users WHERE stripe_customer_id = $1 FOR UPDATE',
        [customerId]
      );

      let userId: string | null = null;

      if (existingUserResult.rows.length > 0) {
        userId = existingUserResult.rows[0].id;
      } else if (session.client_reference_id) {
        // Link customer to user - lock the user row first
        const userToLinkResult = await client.query(
          'SELECT id FROM users WHERE id = $1 FOR UPDATE',
          [session.client_reference_id]
        );

        if (userToLinkResult.rows.length > 0) {
          userId = session.client_reference_id;

          await client.query(
            `UPDATE users SET
              stripe_customer_id = $1,
              stripe_subscription_id = $2,
              updated_at = NOW()
            WHERE id = $3`,
            [customerId, subscriptionId, userId]
          );

          logger.info(`Linked customer ${customerId} to user ${userId}`);
        }
      }

      // Log the event within transaction
      if (userId) {
        await client.query(
          'INSERT INTO subscription_logs (user_id, event, metadata) VALUES ($1, $2, $3)',
          [userId, 'checkout_completed', JSON.stringify({
            sessionId: session.id,
            customerId,
            subscriptionId,
          })]
        );
      }

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Failed to handle checkout completed', { error: (error as Error).message });
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Create Stripe checkout session
   * Uses transaction to ensure customer ID is linked atomically
   * Prevents race conditions when user initiates multiple checkouts
   */
  async createCheckoutSession(
    userId: string,
    priceId: string,
    successUrl: string,
    cancelUrl: string
  ): Promise<Stripe.Checkout.Session> {
    if (!this.stripe) {
      throw new Error('Stripe is not configured');
    }

    const client = await pool.connect();
    let customerId: string;

    try {
      await client.query('BEGIN');

      // Lock user row to prevent concurrent customer creation
      const userResult = await client.query(
        'SELECT id, email, stripe_customer_id FROM users WHERE id = $1 FOR UPDATE',
        [userId]
      );

      if (userResult.rows.length === 0) {
        await client.query('ROLLBACK');
        throw new Error('User not found');
      }

      const user = userResult.rows[0];
      customerId = user.stripe_customer_id;

      // Create Stripe customer if not exists
      if (!customerId) {
        const customer = await this.stripe.customers.create({
          email: user.email,
          metadata: {
            userId: user.id,
          },
        });
        customerId = customer.id;

        // Link customer to user atomically
        await client.query(
          'UPDATE users SET stripe_customer_id = $1, updated_at = NOW() WHERE id = $2',
          [customerId, userId]
        );

        logger.info(`Created Stripe customer ${customerId} for user ${userId}`);
      }

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Failed to create/link Stripe customer', {
        userId,
        error: (error as Error).message
      });
      throw error;
    } finally {
      client.release();
    }

    // Create checkout session (outside transaction - Stripe API call)
    const session = await this.stripe.checkout.sessions.create({
      customer: customerId,
      client_reference_id: userId,
      mode: 'subscription',
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      success_url: successUrl,
      cancel_url: cancelUrl,
    });

    return session;
  }

  /**
   * Create customer portal session
   */
  async createPortalSession(userId: string, returnUrl: string): Promise<Stripe.BillingPortal.Session> {
    if (!this.stripe) {
      throw new Error('Stripe is not configured');
    }

    const [user] = await db.select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user || !user.stripeCustomerId) {
      throw new Error('User does not have a Stripe customer');
    }

    const session = await this.stripe.billingPortal.sessions.create({
      customer: user.stripeCustomerId,
      return_url: returnUrl,
    });

    return session;
  }

  /**
   * Get subscription details from Stripe
   */
  async getSubscription(subscriptionId: string): Promise<Stripe.Subscription | null> {
    if (!this.stripe) {
      return null;
    }

    try {
      return await this.stripe.subscriptions.retrieve(subscriptionId);
    } catch (error) {
      console.error('Error retrieving subscription:', error);
      return null;
    }
  }

  /**
   * Log subscription event to database
   */
  private async logSubscriptionEvent(userId: string, event: string, metadata: any): Promise<void> {
    try {
      await db.insert(subscriptionLogs).values({
        userId,
        event,
        metadata,
      });
    } catch (error) {
      console.error('Failed to log subscription event:', error);
    }
  }
}

export default StripeService;
