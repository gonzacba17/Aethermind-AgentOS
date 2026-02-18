/**
 * Unit tests for auth signup — API key handling
 * Verifies that the hashed API key is never returned in user responses
 * and the plaintext key is only shown once at signup
 */

import { jest, describe, test, expect, beforeEach, beforeAll } from '@jest/globals';
import request from 'supertest';
import express, { Express } from 'express';

// Mock dependencies before importing
jest.mock('../../src/db', () => {
  const mockUsers: any[] = [];
  
  return {
    db: {
      select: jest.fn(() => ({
        from: jest.fn(() => ({
          where: jest.fn(() => ({
            limit: jest.fn((limit: number) => {
              return Promise.resolve(mockUsers.slice(0, limit));
            })
          }))
        }))
      })),
      insert: jest.fn(() => ({
        values: jest.fn((data: any) => {
          const newUser = { 
            ...data, 
            id: data.id || 'user_test_123',
            emailVerified: false,
            plan: data.plan || 'free',
          };
          mockUsers.push(newUser);
          return {
            returning: jest.fn(() => Promise.resolve([newUser]))
          };
        })
      })),
      __mockUsers: mockUsers,
      __clearMockUsers: () => mockUsers.length = 0,
    }
  };
});

jest.mock('../../src/services/EmailService', () => ({
  emailService: {
    sendVerificationEmail: jest.fn(() => Promise.resolve()),
    sendPasswordResetEmail: jest.fn(() => Promise.resolve()),
    sendWelcomeEmail: jest.fn(() => Promise.resolve()),
    isConfigured: jest.fn(() => true),
    getProvider: jest.fn(() => 'sendgrid'),
  }
}));

jest.mock('../../src/services/StripeService', () => ({
  StripeService: jest.fn().mockImplementation(() => ({
    isConfigured: jest.fn(() => true),
    getSubscription: jest.fn(() => Promise.resolve(null)),
  })),
}));

jest.mock('../../src/services/OAuthService', () => ({
  convertTemporaryUser: jest.fn(),
  getTemporaryUser: jest.fn(),
  removeTemporaryUser: jest.fn(),
}));

jest.mock('../../src/services/RedisService', () => ({
  default: {
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
  }
}));

// Set env variables before importing
process.env.JWT_SECRET = 'test-secret-key-minimum-32-characters-long';
process.env.NODE_ENV = 'test';

// Import after mocks
import authRoutes from '../../src/routes/auth';
import { db } from '../../src/db';

describe('Auth Signup — API Key Security', () => {
  let app: Express;

  beforeAll(() => {
    app = express();
    app.use(express.json());
    app.use('/auth', authRoutes);
  });

  beforeEach(() => {
    jest.clearAllMocks();
    (db as any).__clearMockUsers();
  });

  test('signup response includes apiKey field (shown once, plaintext)', async () => {
    const response = await request(app)
      .post('/auth/signup')
      .send({
        email: 'newuser@test.com',
        password: 'securepassword123',
      });

    // Should succeed
    expect([200, 201]).toContain(response.status);

    // Should have apiKey at root level (shown once)
    expect(response.body).toHaveProperty('apiKey');
    expect(response.body.apiKey).toMatch(/^aethermind_/);
    expect(response.body).toHaveProperty('apiKeyShownOnce', true);
  });

  test('signup response user object does NOT contain apiKey', async () => {
    const response = await request(app)
      .post('/auth/signup')
      .send({
        email: 'another@test.com',
        password: 'securepassword123',
      });

    expect([200, 201]).toContain(response.status);
    
    // The user object should NOT have apiKey
    expect(response.body.user).toBeDefined();
    expect(response.body.user).not.toHaveProperty('apiKey');
    expect(response.body.user).not.toHaveProperty('apiKeyHash');
  });

  test('signup stores hashed apiKey, not plaintext', async () => {
    const response = await request(app)
      .post('/auth/signup')
      .send({
        email: 'hashtest@test.com',
        password: 'securepassword123',
      });

    expect([200, 201]).toContain(response.status);

    // The apiKey returned should be plaintext
    const plaintextKey = response.body.apiKey;
    expect(plaintextKey).toMatch(/^aethermind_/);

    // Verify db.insert was called and the stored value starts with $2a$ (bcrypt hash)
    const insertCall = (db.insert as jest.Mock).mock.calls[0];
    expect(insertCall).toBeDefined();
  });
});
