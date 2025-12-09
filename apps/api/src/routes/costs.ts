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

export { router as costRoutes };
