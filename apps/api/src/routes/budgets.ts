import { Router } from 'express';
import type { Router as ExpressRouter } from 'express';
import { z } from 'zod';
import { validateBody, validateQuery } from '../middleware/validator.js';

const router: ExpressRouter = Router();

const CreateBudgetSchema = z.object({
  name: z.string().min(1).max(255),
  limitAmount: z.number().positive(),
  period: z.enum(['daily', 'weekly', 'monthly']),
  scope: z.enum(['user', 'team', 'agent', 'workflow']),
  scopeId: z.string().optional(),
  hardLimit: z.boolean().default(true),
  alertAt: z.number().min(1).max(100).default(80),
});

const UpdateBudgetSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  limitAmount: z.number().positive().optional(),
  period: z.enum(['daily', 'weekly', 'monthly']).optional(),
  hardLimit: z.boolean().optional(),
  alertAt: z.number().min(1).max(100).optional(),
  status: z.enum(['active', 'paused', 'exceeded']).optional(),
});

const ListBudgetsSchema = z.object({
  status: z.enum(['active', 'paused', 'exceeded']).optional(),
  scope: z.enum(['user', 'team', 'agent', 'workflow']).optional(),
});

// Create budget
router.post('/', validateBody(CreateBudgetSchema), async (req, res) => {
  try {
    const budget = await req.budgetService.createBudget({
      userId: (req.user as any)?.id,
      ...req.body,
    });
    
    res.status(201).json(budget);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// List budgets
router.get('/', validateQuery(ListBudgetsSchema), async (req, res) => {
  try {
    const { status, scope } = req.query as any;
    
    const budgets = await req.prisma.budget.findMany({
      where: {
        userId: (req.user as any)?.id,
        ...(status && { status }),
        ...(scope && { scope }),
      },
      orderBy: { createdAt: 'desc' },
    });
    
    res.json(budgets);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Get budget by ID
router.get('/:id', async (req, res) => {
  try {
    const budget = await req.prisma.budget.findFirst({
      where: {
        id: req.params.id,
        userId: (req.user as any)?.id,
      },
    });
    
    if (!budget) {
      return res.status(404).json({ error: 'Budget not found' });
    }
    
    res.json(budget);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Update budget
router.patch('/:id', validateBody(UpdateBudgetSchema), async (req, res) => {
  try {
    await req.budgetService.updateBudget(
      req.params.id,
      (req.user as any)?.id,
      req.body
    );
    
    const updated = await req.prisma.budget.findFirst({
      where: {
        id: req.params.id,
        userId: (req.user as any)?.id,
      },
    });
    
    if (!updated) {
      return res.status(404).json({ error: 'Budget not found' });
    }
    
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Delete budget
router.delete('/:id', async (req, res) => {
  try {
    await req.budgetService.deleteBudget(req.params.id, (req.user as any)?.id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Get budget usage summary
router.get('/:id/usage', async (req, res) => {
  try {
    const budget = await req.prisma.budget.findFirst({
      where: {
        id: req.params.id,
        userId: (req.user as any)?.id,
      },
    });
    
    if (!budget) {
      return res.status(404).json({ error: 'Budget not found' });
    }
    
    const percentUsed = (Number(budget.currentSpend) / Number(budget.limitAmount)) * 100;
    const remaining = Number(budget.limitAmount) - Number(budget.currentSpend);
    
    res.json({
      budgetId: budget.id,
      name: budget.name,
      limitAmount: Number(budget.limitAmount),
      currentSpend: Number(budget.currentSpend),
      remaining: Math.max(0, remaining),
      percentUsed: Math.min(100, percentUsed),
      status: budget.status,
      period: budget.period,
      hardLimit: budget.hardLimit,
      alertAt: budget.alertAt,
    });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

export { router as budgetRoutes };
