import { Router } from 'express';
import type { Router as ExpressRouter } from 'express';

const router: ExpressRouter = Router();

router.get('/', async (req, res) => {
  try {
    const { executionId, model, limit, offset } = req.query;

    const costs = await req.store.getCosts({
      executionId: executionId as string | undefined,
      model: model as string | undefined,
      limit: limit ? parseInt(limit as string, 10) : undefined,
      offset: offset ? parseInt(offset as string, 10) : undefined,
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

    res.json({
      total: allCosts.reduce((sum, c) => sum + c.cost, 0),
      totalTokens: allCosts.reduce((sum, c) => sum + c.tokens.totalTokens, 0),
      executionCount: allCosts.length,
      byModel,
    });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

export { router as costRoutes };
