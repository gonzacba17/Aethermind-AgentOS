/**
 * StripeService Unit Tests
 * Tests for Stripe integration handling webhooks, subscriptions, and customer management
 */

import { jest, describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import Stripe from 'stripe';

// Mock dependencies before importing StripeService
jest.mock('../../src/db', () => ({
  db: {
    select: jest.fn(() => ({
      from: jest.fn(() => ({
        where: jest.fn(() => ({
          limit: jest.fn(() => Promise.resolve([]))
        }))
      }))
    })),
    update: jest.fn(() => ({
      set: jest.fn(() => ({
        where: jest.fn(() => Promise.resolve())
      }))
    })),
    insert: jest.fn(() => ({
      values: jest.fn(() => Promise.resolve())
    }))
  }
}));

jest.mock('../../src/services/EmailService', () => ({
  emailService: {
    sendPaymentFailedEmail: jest.fn(() => Promise.resolve()),
    sendSubscriptionCanceledEmail: jest.fn(() => Promise.resolve()),
    sendWelcomeEmail: jest.fn(() => Promise.resolve()),
  }
}));

// Import after mocks
import { StripeService } from '../../src/services/StripeService';
import { db } from '../../src/db';
import { emailService } from '../../src/services/EmailService';

// Mock environment variables
const originalEnv = process.env;

describe('StripeService', () => {
  let stripeService: StripeService;
  
  beforeEach(() => {
    jest.clearAllMocks();
    process.env = {
      ...originalEnv,
      STRIPE_SECRET_KEY: 'sk_test_mock_key_12345',
      STRIPE_WEBHOOK_SECRET: 'whsec_test_mock_secret_12345',
      STRIPE_PRO_PRICE_ID: 'price_pro_123',
      STRIPE_ENTERPRISE_PRICE_ID: 'price_enterprise_123',
    };
    stripeService = new StripeService();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('constructor', () => {
    test('should initialize Stripe when STRIPE_SECRET_KEY is provided', () => {
      expect(stripeService.isConfigured()).toBe(true);
    });

    test('should not initialize Stripe when STRIPE_SECRET_KEY is missing', () => {
      process.env.STRIPE_SECRET_KEY = '';
      const unconfiguredService = new StripeService();
      expect(unconfiguredService.isConfigured()).toBe(false);
    });
  });

  describe('isConfigured', () => {
    test('should return true when Stripe is initialized', () => {
      expect(stripeService.isConfigured()).toBe(true);
    });

    test('should return false when Stripe is not initialized', () => {
      process.env.STRIPE_SECRET_KEY = '';
      const unconfiguredService = new StripeService();
      expect(unconfiguredService.isConfigured()).toBe(false);
    });
  });

  describe('constructWebhookEvent', () => {
    test('should throw error when Stripe is not configured', () => {
      process.env.STRIPE_SECRET_KEY = '';
      const unconfiguredService = new StripeService();
      
      expect(() => {
        unconfiguredService.constructWebhookEvent('payload', 'signature');
      }).toThrow('Stripe is not configured');
    });

    test('should throw error when webhook secret is not configured', () => {
      process.env.STRIPE_WEBHOOK_SECRET = '';
      const noSecretService = new StripeService();
      
      expect(() => {
        noSecretService.constructWebhookEvent('payload', 'signature');
      }).toThrow('STRIPE_WEBHOOK_SECRET is not configured');
    });
  });

  describe('handleWebhookEvent', () => {
    const mockUser = {
      id: 'user_123',
      email: 'test@example.com',
      name: 'Test User',
      stripeCustomerId: 'cus_12345',
      plan: 'free',
    };

    beforeEach(() => {
      // Setup db mock to return user
      (db.select as jest.Mock).mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue([mockUser])
          })
        })
      });
    });

    test('should process customer.subscription.created event', async () => {
      const mockSubscription = {
        id: 'sub_123',
        customer: 'cus_12345',
        status: 'active',
        items: {
          data: [{ price: { id: 'price_pro_123' } }]
        },
        trial_end: null,
      } as unknown as Stripe.Subscription;

      const event: Stripe.Event = {
        id: 'evt_123',
        type: 'customer.subscription.created',
        data: { object: mockSubscription },
        object: 'event',
        api_version: '2023-10-16',
        created: Date.now(),
        livemode: false,
        pending_webhooks: 0,
        request: null,
      };

      await stripeService.handleWebhookEvent(event);

      expect(db.update).toHaveBeenCalled();
      expect(db.insert).toHaveBeenCalled();
    });

    test('should process customer.subscription.deleted event and downgrade user', async () => {
      const mockSubscription = {
        id: 'sub_123',
        customer: 'cus_12345',
        status: 'canceled',
      } as unknown as Stripe.Subscription;

      const event: Stripe.Event = {
        id: 'evt_123',
        type: 'customer.subscription.deleted',
        data: { object: mockSubscription },
        object: 'event',
        api_version: '2023-10-16',
        created: Date.now(),
        livemode: false,
        pending_webhooks: 0,
        request: null,
      };

      await stripeService.handleWebhookEvent(event);

      expect(db.update).toHaveBeenCalled();
      expect(emailService.sendSubscriptionCanceledEmail).toHaveBeenCalledWith(
        mockUser.email,
        mockUser.name
      );
    });

    test('should process invoice.payment_succeeded event', async () => {
      const mockInvoice = {
        id: 'in_123',
        customer: 'cus_12345',
        amount_paid: 2900,
        currency: 'usd',
      } as unknown as Stripe.Invoice;

      const event: Stripe.Event = {
        id: 'evt_123',
        type: 'invoice.payment_succeeded',
        data: { object: mockInvoice },
        object: 'event',
        api_version: '2023-10-16',
        created: Date.now(),
        livemode: false,
        pending_webhooks: 0,
        request: null,
      };

      await stripeService.handleWebhookEvent(event);

      expect(db.update).toHaveBeenCalled();
    });

    test('should process invoice.payment_failed event and send email', async () => {
      const mockInvoice = {
        id: 'in_123',
        customer: 'cus_12345',
        attempt_count: 1,
      } as unknown as Stripe.Invoice;

      const event: Stripe.Event = {
        id: 'evt_123',
        type: 'invoice.payment_failed',
        data: { object: mockInvoice },
        object: 'event',
        api_version: '2023-10-16',
        created: Date.now(),
        livemode: false,
        pending_webhooks: 0,
        request: null,
      };

      await stripeService.handleWebhookEvent(event);

      expect(db.update).toHaveBeenCalled();
      expect(emailService.sendPaymentFailedEmail).toHaveBeenCalledWith(
        mockUser.email,
        mockUser.name
      );
    });

    test('should log unhandled event types without error', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      
      const event: Stripe.Event = {
        id: 'evt_123',
        type: 'some.unknown.event' as any,
        data: { object: {} },
        object: 'event',
        api_version: '2023-10-16',
        created: Date.now(),
        livemode: false,
        pending_webhooks: 0,
        request: null,
      };

      await expect(stripeService.handleWebhookEvent(event)).resolves.not.toThrow();
      
      consoleSpy.mockRestore();
    });

    test('should handle missing user gracefully', async () => {
      // Setup db mock to return no user
      (db.select as jest.Mock).mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue([])
          })
        })
      });

      const mockSubscription = {
        id: 'sub_123',
        customer: 'cus_nonexistent',
        status: 'active',
        items: {
          data: [{ price: { id: 'price_pro_123' } }]
        },
      } as unknown as Stripe.Subscription;

      const event: Stripe.Event = {
        id: 'evt_123',
        type: 'customer.subscription.created',
        data: { object: mockSubscription },
        object: 'event',
        api_version: '2023-10-16',
        created: Date.now(),
        livemode: false,
        pending_webhooks: 0,
        request: null,
      };

      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      
      await expect(stripeService.handleWebhookEvent(event)).resolves.not.toThrow();
      
      consoleSpy.mockRestore();
    });
  });

  describe('getSubscription', () => {
    test('should return null when Stripe is not configured', async () => {
      process.env.STRIPE_SECRET_KEY = '';
      const unconfiguredService = new StripeService();
      
      const result = await unconfiguredService.getSubscription('sub_123');
      expect(result).toBeNull();
    });
  });

  describe('createCheckoutSession', () => {
    test('should throw error when Stripe is not configured', async () => {
      process.env.STRIPE_SECRET_KEY = '';
      const unconfiguredService = new StripeService();
      
      await expect(
        unconfiguredService.createCheckoutSession(
          'user_123',
          'price_123',
          'https://example.com/success',
          'https://example.com/cancel'
        )
      ).rejects.toThrow('Stripe is not configured');
    });

    test('should throw error when user not found', async () => {
      (db.select as jest.Mock).mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue([])
          })
        })
      });

      await expect(
        stripeService.createCheckoutSession(
          'nonexistent_user',
          'price_123',
          'https://example.com/success',
          'https://example.com/cancel'
        )
      ).rejects.toThrow('User not found');
    });
  });

  describe('createPortalSession', () => {
    test('should throw error when Stripe is not configured', async () => {
      process.env.STRIPE_SECRET_KEY = '';
      const unconfiguredService = new StripeService();
      
      await expect(
        unconfiguredService.createPortalSession('user_123', 'https://example.com/return')
      ).rejects.toThrow('Stripe is not configured');
    });

    test('should throw error when user has no Stripe customer', async () => {
      (db.select as jest.Mock).mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue([{ id: 'user_123', stripeCustomerId: null }])
          })
        })
      });

      await expect(
        stripeService.createPortalSession('user_123', 'https://example.com/return')
      ).rejects.toThrow('User does not have a Stripe customer');
    });

    test('should throw error when user not found', async () => {
      (db.select as jest.Mock).mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue([])
          })
        })
      });

      await expect(
        stripeService.createPortalSession('nonexistent_user', 'https://example.com/return')
      ).rejects.toThrow('User does not have a Stripe customer');
    });
  });
});
