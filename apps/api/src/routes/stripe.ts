import { Router, Request, Response } from 'express';
import type { Router as ExpressRouter } from 'express';
import { StripeService } from '../services/StripeService';
import requireEmailVerified from '../middleware/requireEmailVerified';

const router: ExpressRouter = Router();

// Initialize Stripe service
const stripeService = new StripeService();

/**
 * POST /stripe/webhook
 * Stripe webhook endpoint - handles subscription lifecycle events
 * This endpoint is PUBLIC and uses Stripe signature verification for security
 */
router.post('/webhook', async (req: Request, res: Response) => {
  try {
    const signature = req.headers['stripe-signature'];

    if (!signature || typeof signature !== 'string') {
      return res.status(400).json({ error: 'Missing stripe-signature header' });
    }

    // Verify webhook signature and construct event
    // Note: req.body must be raw buffer for signature verification
    const event = stripeService.constructWebhookEvent(req.body, signature);

    console.log(`📨 Received Stripe webhook: ${event.type}`);

    // Process the event
    await stripeService.handleWebhookEvent(event);

    // Return 200 to acknowledge receipt
    res.json({ received: true });
  } catch (error) {
    console.error('❌ Webhook error:', error);
    return res.status(400).json({
      error: 'Webhook processing failed',
      message: (error as Error).message,
    });
  }
});

/**
 * POST /stripe/create-checkout-session
 * Create a Stripe checkout session for subscription
 * Requires authentication AND email verification
 */
router.post('/create-checkout-session', requireEmailVerified, async (req: Request, res: Response) => {
  try {
    // Get user from JWT (added by auth middleware)
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Extract userId from token (you might want to use your auth middleware here)
    const token = authHeader.replace('Bearer ', '');
    const jwt = require('jsonwebtoken');
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded.userId || decoded.id;

    const { priceId, successUrl, cancelUrl } = req.body;

    if (!priceId) {
      return res.status(400).json({ error: 'priceId is required' });
    }

    if (!successUrl || !cancelUrl) {
      return res.status(400).json({ error: 'successUrl and cancelUrl are required' });
    }

    if (!stripeService.isConfigured()) {
      return res.status(503).json({ error: 'Stripe is not configured' });
    }

    // Create checkout session
    const session = await stripeService.createCheckoutSession(
      userId,
      priceId,
      successUrl,
      cancelUrl
    );

    res.json({ sessionId: session.id, url: session.url });
  } catch (error) {
    console.error('❌ Create checkout session error:', error);
    res.status(500).json({
      error: 'Failed to create checkout session',
      message: (error as Error).message,
    });
  }
});

/**
 * POST /stripe/create-portal-session
 * Create a Stripe customer portal session for managing subscription
 * Requires authentication
 */
router.post('/create-portal-session', async (req: Request, res: Response) => {
  try {
    // Get user from JWT
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const token = authHeader.replace('Bearer ', '');
    const jwt = require('jsonwebtoken');
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded.userId || decoded.id;

    const { returnUrl } = req.body;

    if (!returnUrl) {
      return res.status(400).json({ error: 'returnUrl is required' });
    }

    if (!stripeService.isConfigured()) {
      return res.status(503).json({ error: 'Stripe is not configured' });
    }

    // Create portal session
    const session = await stripeService.createPortalSession(userId, returnUrl);

    res.json({ url: session.url });
  } catch (error) {
    console.error('❌ Create portal session error:', error);
    res.status(500).json({
      error: 'Failed to create portal session',
      message: (error as Error).message,
    });
  }
});

export default router;
