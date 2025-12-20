import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { AlertService } from '../AlertService';
import type { PrismaClient } from '@prisma/client';

// Mock fetch globally
global.fetch = jest.fn() as jest.MockedFunction<typeof fetch>;

// Mock Prisma Client
const mockPrisma = {
  budget: {
    findMany: jest.fn(),
    update: jest.fn(),
  },
  alertLog: {
    create: jest.fn(),
  },
} as unknown as jest.Mocked<PrismaClient>;

// Helper to create mock budget with all required fields
const createMockBudget = (overrides: any = {}) => ({
  id: 'budget-1',
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
  name: 'Test Budget',
  userId: 'user-1',
  status: 'active',
  limitAmount: 100,
  currentSpend: 85,
  period: 'monthly',
  scope: 'global',
  scopeId: null,
  hardLimit: false,
  alertAt: 80,
  alert80Sent: false,
  alert100Sent: false,
  user: {
    id: 'user-1',
    email: 'test@example.com',
    createdAt: new Date(),
    updatedAt: new Date(),
    name: 'Test User',
    plan: 'pro',
    apiKey: null,
    apiKeyHash: null,
    usageCount: 0,
    usageLimit: 1000,
  },
  ...overrides,
});

describe('AlertService', () => {
  let alertService: AlertService;
  const mockSendgridKey = 'SG.test-api-key';
  const mockSlackWebhook = 'https://hooks.slack.com/test-webhook';

  beforeEach(() => {
    jest.clearAllMocks();
    (global.fetch as jest.MockedFunction<typeof fetch>).mockReset();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('checkAndSendAlerts', () => {
    beforeEach(() => {
      alertService = new AlertService(mockPrisma, mockSendgridKey, mockSlackWebhook);
    });

    it('should fetch all active budgets', async () => {
      mockPrisma.budget.findMany.mockResolvedValue([]);

      await alertService.checkAndSendAlerts();

      expect(mockPrisma.budget.findMany).toHaveBeenCalledWith({
        where: { status: 'active' },
        include: { user: true },
      });
    });

    it('should send alert at 80% threshold', async () => {
      const mockBudget = createMockBudget({ currentSpend: 85 });

      mockPrisma.budget.findMany.mockResolvedValue([mockBudget]);
      mockPrisma.budget.update.mockResolvedValue(mockBudget);
      mockPrisma.alertLog.create.mockResolvedValue({} as any);
      (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValue({
        ok: true,
        text: async () => '',
      } as Response);

      await alertService.checkAndSendAlerts();

      expect(mockPrisma.budget.update).toHaveBeenCalledWith({
        where: { id: 'budget-1' },
        data: { alert80Sent: true },
      });
      expect(mockPrisma.alertLog.create).toHaveBeenCalled();
    });

    it('should send critical alert at 100% threshold', async () => {
      const mockBudget = createMockBudget({
        currentSpend: 105,
        alert80Sent: true,
      });

      mockPrisma.budget.findMany.mockResolvedValue([mockBudget]);
      mockPrisma.budget.update.mockResolvedValue(mockBudget);
      mockPrisma.alertLog.create.mockResolvedValue({} as any);
      (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValue({
        ok: true,
        text: async () => '',
      } as Response);

      await alertService.checkAndSendAlerts();

      expect(mockPrisma.budget.update).toHaveBeenCalledWith({
        where: { id: 'budget-1' },
        data: { alert100Sent: true },
      });
    });

    it('should not send duplicate alerts', async () => {
      const mockBudget = createMockBudget({
        currentSpend: 85,
        alert80Sent: true,
      });

      mockPrisma.budget.findMany.mockResolvedValue([mockBudget]);

      await alertService.checkAndSendAlerts();

      expect(mockPrisma.budget.update).not.toHaveBeenCalled();
      expect(mockPrisma.alertLog.create).not.toHaveBeenCalled();
    });

    it('should send email via SendGrid', async () => {
      const mockBudget = createMockBudget();

      mockPrisma.budget.findMany.mockResolvedValue([mockBudget]);
      mockPrisma.budget.update.mockResolvedValue(mockBudget);
      mockPrisma.alertLog.create.mockResolvedValue({} as any);
      
      (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValue({
        ok: true,
        text: async () => '',
      } as Response);

      await alertService.checkAndSendAlerts();

      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.sendgrid.com/v3/mail/send',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Authorization': `Bearer ${mockSendgridKey}`,
          }),
        })
      );
    });

    it('should handle email errors gracefully', async () => {
      const mockBudget = createMockBudget();

      mockPrisma.budget.findMany.mockResolvedValue([mockBudget]);
      mockPrisma.budget.update.mockResolvedValue(mockBudget);
      mockPrisma.alertLog.create.mockResolvedValue({} as any);
      
      (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValue({
        ok: false,
        text: async () => 'SendGrid error',
      } as Response);

      await alertService.checkAndSendAlerts();

      expect(mockPrisma.alertLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          success: false,
          error: expect.stringContaining('SendGrid'),
        }),
      });
    });
  });
});
