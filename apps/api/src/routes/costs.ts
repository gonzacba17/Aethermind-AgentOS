import { Router } from 'express';
import type { Router as ExpressRouter } from 'express';
import { validateQuery } from '../middleware/validator.js';
import { CostFilterSchema } from '@aethermind/core';

const router: ExpressRouter = Router();

router.get('/', validateQuery(CostFilterSchema), async (req, res) => {
  try {
    const { executionId, model, limit, offset } = req.query as any;

    const costs = await req.store.getCosts({
      executionId,
      model,
      limit,
      offset,
    });

    const total = await req.store.getTotalCost();
    const byModel = await req.store.getCostByModel();

    res.json({
      ...costs,
      summary: {
        total,
        byModel,
      },
    });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

router.get('/summary', async (req, res) => {
  try {
    const cacheKey = 'costs:summary';

    if (req.cache) {
      const cached = await req.cache.get(cacheKey);
      if (cached) {
        res.json(cached);
        return;
      }
    }

    const orchestratorCosts = req.orchestrator.getCosts();
    const storeCostsResult = await req.store.getCosts({});

    const allCosts = [...orchestratorCosts, ...storeCostsResult.data];

    const byModel: Record<string, { count: number; tokens: number; cost: number }> = {};

    for (const cost of allCosts) {
      if (!byModel[cost.model]) {
        byModel[cost.model] = { count: 0, tokens: 0, cost: 0 };
      }
      byModel[cost.model]!.count += 1;
      byModel[cost.model]!.tokens += cost.tokens.totalTokens;
      byModel[cost.model]!.cost += cost.cost;
    }

    const summary = {
      total: allCosts.reduce((sum, c) => sum + c.cost, 0),
      totalTokens: allCosts.reduce((sum, c) => sum + c.tokens.totalTokens, 0),
      executionCount: allCosts.length,
      byModel,
    };

    if (req.cache) {
      await req.cache.set(cacheKey, JSON.stringify(summary), 60);
    }

    res.json(summary);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Valid LLM providers
const VALID_PROVIDERS = ['openai', 'anthropic', 'google'];

router.post('/', async (req, res) => {
  try {
    const { executionId, provider, model, cost, promptTokens, completionTokens, totalTokens } = req.body;
    
    // Validation
    if (!executionId) {
      res.status(400).json({ error: 'executionId is required' });
      return;
    }
    
    if (!provider || !VALID_PROVIDERS.includes(provider.toLowerCase())) {
      res.status(400).json({ 
        error: `Invalid provider. Must be one of: ${VALID_PROVIDERS.join(', ')}` 
      });
      return;
    }
    
    if (cost === undefined || cost === null) {
      res.status(400).json({ error: 'cost is required' });
      return;
    }
    
    if (cost < 0) {
      res.status(400).json({ error: 'cost must be non-negative' });
      return;
    }
    
    // Create cost record (provider info is embedded in model name for now)
    const costRecord = await req.store.addCost({
      executionId,
      model: model || provider, // Use model if provided, otherwise provider name
      tokens: {
        promptTokens: promptTokens || 0,
        completionTokens: completionTokens || 0,
        totalTokens: totalTokens || (promptTokens || 0) + (completionTokens || 0),
      },
      cost,
      currency: 'USD',
    });

    
    // Invalidate cache
    if (req.cache) {
      await req.cache.del('costs:summary');
    }
    
    res.status(201).json(costRecord);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

router.get('/budget', async (req, res) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }
    
    // Get user's active budget from Prisma
    const budget = await req.prisma.budget.findFirst({
      where: {
        userId: (req.user as any)?.id,
        status: 'active',
        scope: 'user',
      },
      orderBy: { createdAt: 'desc' },
    });
    
    if (!budget) {
      res.status(404).json({ error: 'No budget configured' });
      return;
    }
    
    const limitAmount = Number(budget.limitAmount);
    const currentSpend = Number(budget.currentSpend);
    
    res.json({
      limit: limitAmount,
      spent: currentSpend,
      remaining: Math.max(0, limitAmount - currentSpend),
      percentUsed: (currentSpend / limitAmount) * 100,
      period: budget.period,
    });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

export { router as costRoutes };
