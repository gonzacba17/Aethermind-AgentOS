import Stripe from 'stripe';
import { PrismaClient } from '@prisma/client';
import { emailService } from './EmailService';

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
  private prisma: PrismaClient;
  private webhookSecret: string;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
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
   * Handle subscription created
   */
  private async handleSubscriptionCreated(subscription: Stripe.Subscription): Promise<void> {
    const customerId = subscription.customer as string;
    const priceId = subscription.items.data[0]?.price.id;
    const plan = priceId ? PRICE_TO_PLAN[priceId] : undefined;

    if (!plan) {
      console.warn(`⚠️  Unknown price ID: ${priceId}`);
      return;
    }

    // Find user by Stripe customer ID
    const user = await this.prisma.user.findUnique({
      where: { stripeCustomerId: customerId },
    });

    if (!user) {
      console.warn(`⚠️  User not found for customer: ${customerId}`);
      return;
    }

    // Update user subscription
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        plan,
        subscriptionStatus: subscription.status === 'trialing' ? 'trial' : 'active',
        stripeSubscriptionId: subscription.id,
        trialEndsAt: subscription.trial_end ? new Date(subscription.trial_end * 1000) : null,
      },
    });

    // Log the event
    await this.logSubscriptionEvent(user.id, 'subscription_created', {
      subscriptionId: subscription.id,
      plan,
      status: subscription.status,
    });

    console.log(`✅ Subscription created for user ${user.email}: ${plan}`);
  }

  /**
   * Handle subscription updated
   */
  private async handleSubscriptionUpdated(subscription: Stripe.Subscription): Promise<void> {
    const customerId = subscription.customer as string;
    const priceId = subscription.items.data[0]?.price.id;
    const plan = priceId ? PRICE_TO_PLAN[priceId] : undefined;

    const user = await this.prisma.user.findUnique({
      where: { stripeCustomerId: customerId },
    });

    if (!user) {
      console.warn(`⚠️  User not found for customer: ${customerId}`);
      return;
    }

    // Map Stripe status to our subscription status
    let subscriptionStatus = 'inactive';
    if (subscription.status === 'active') subscriptionStatus = 'active';
    else if (subscription.status === 'trialing') subscriptionStatus = 'trial';
    else if (subscription.status === 'past_due') subscriptionStatus = 'past_due';
    else if (subscription.status === 'canceled' || subscription.status === 'unpaid') subscriptionStatus = 'cancelled';

    // Update user
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        plan: plan || user.plan,
        subscriptionStatus,
        stripeSubscriptionId: subscription.id,
      },
    });

    // Log the event
    await this.logSubscriptionEvent(user.id, 'subscription_updated', {
      subscriptionId: subscription.id,
      status: subscription.status,
      newPlan: plan,
    });

    // Send notification if status changed to past_due or canceled
    if (subscription.status === 'past_due' || subscription.status === 'canceled') {
      await emailService.sendPaymentFailedEmail(user.email, user.name || 'User');
    }

    console.log(`✅ Subscription updated for user ${user.email}: ${subscriptionStatus}`);
  }

  /**
   * Handle subscription deleted
   */
  private async handleSubscriptionDeleted(subscription: Stripe.Subscription): Promise<void> {
    const customerId = subscription.customer as string;

    const user = await this.prisma.user.findUnique({
      where: { stripeCustomerId: customerId },
    });

    if (!user) {
      console.warn(`⚠️  User not found for customer: ${customerId}`);
      return;
    }

    // Downgrade to free plan
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        plan: 'free',
        subscriptionStatus: 'cancelled',
        stripeSubscriptionId: null,
        trialEndsAt: null,
      },
    });

    // Log the event
    await this.logSubscriptionEvent(user.id, 'subscription_deleted', {
      subscriptionId: subscription.id,
      downgradedTo: 'free',
    });

    // Send notification
    await emailService.sendSubscriptionCanceledEmail(user.email, user.name || 'User');

    console.log(`✅ Subscription deleted for user ${user.email}, downgraded to free`);
  }

  /**
   * Handle successful payment
   */
  private async handlePaymentSucceeded(invoice: Stripe.Invoice): Promise<void> {
    const customerId = invoice.customer as string;

    const user = await this.prisma.user.findUnique({
      where: { stripeCustomerId: customerId },
    });

    if (!user) {
      console.warn(`⚠️  User not found for customer: ${customerId}`);
      return;
    }

    // Update subscription status to active
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        subscriptionStatus: 'active',
      },
    });

    // Log the event
    await this.logSubscriptionEvent(user.id, 'payment_succeeded', {
      invoiceId: invoice.id,
      amount: invoice.amount_paid / 100,
      currency: invoice.currency,
    });

    console.log(`✅ Payment succeeded for user ${user.email}: ${invoice.amount_paid / 100} ${invoice.currency}`);
  }

  /**
   * Handle failed payment
   */
  private async handlePaymentFailed(invoice: Stripe.Invoice): Promise<void> {
    const customerId = invoice.customer as string;

    const user = await this.prisma.user.findUnique({
      where: { stripeCustomerId: customerId },
    });

    if (!user) {
      console.warn(`⚠️  User not found for customer: ${customerId}`);
      return;
    }

    // Update subscription status to past_due
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        subscriptionStatus: 'past_due',
      },
    });

    // Log the event
    await this.logSubscriptionEvent(user.id, 'payment_failed', {
      invoiceId: invoice.id,
      attemptCount: invoice.attempt_count,
    });

    // Send alert email
    await emailService.sendPaymentFailedEmail(user.email, user.name || 'User');

    console.log(`❌ Payment failed for user ${user.email}, status set to past_due`);
  }

  /**
   * Handle checkout session completed
   */
  private async handleCheckoutCompleted(session: Stripe.Checkout.Session): Promise<void> {
    const customerId = session.customer as string;
    const subscriptionId = session.subscription as string;

    // Get or create user association
    const user = await this.prisma.user.findUnique({
      where: { stripeCustomerId: customerId },
    });

    if (!user && session.client_reference_id) {
      // Link customer to user if not already linked
      await this.prisma.user.update({
        where: { id: session.client_reference_id },
        data: {
          stripeCustomerId: customerId,
          stripeSubscriptionId: subscriptionId,
        },
      });

      console.log(`✅ Linked customer ${customerId} to user ${session.client_reference_id}`);
    }

    // Log the event
    if (user || session.client_reference_id) {
      await this.logSubscriptionEvent(
        user?.id || session.client_reference_id!,
        'checkout_completed',
        {
          sessionId: session.id,
          customerId,
          subscriptionId,
        }
      );
    }
  }

  /**
   * Create Stripe checkout session
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

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new Error('User not found');
    }

    // Create or retrieve customer
    let customerId = user.stripeCustomerId;
    if (!customerId) {
      const customer = await this.stripe.customers.create({
        email: user.email,
        metadata: {
          userId: user.id,
        },
      });
      customerId = customer.id;

      // Update user with customer ID
      await this.prisma.user.update({
        where: { id: userId },
        data: { stripeCustomerId: customerId },
      });
    }

    // Create checkout session
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

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

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
      await this.prisma.subscriptionLog.create({
        data: {
          userId,
          event,
          metadata,
        },
      });
    } catch (error) {
      console.error('Failed to log subscription event:', error);
    }
  }

  /**
   * Check if Stripe is configured
   */
  isConfigured(): boolean {
    return this.stripe !== null;
  }
}

export default StripeService;
