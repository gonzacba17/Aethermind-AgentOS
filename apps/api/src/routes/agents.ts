import { Router } from 'express';
import type { Router as ExpressRouter } from 'express';
import { validateBody, validateQuery, validateParams } from '../middleware/validator.js';
import { jwtAuthMiddleware, AuthRequest } from '../middleware/jwt-auth.js';
import { usageLimiter, incrementUsage } from '../middleware/usage-limiter.js';
import {
  CreateAgentSchema,
  ExecuteAgentSchema,
  PaginationSchema,
  IdParamSchema,
} from '@aethermind/core';

const router: ExpressRouter = Router();

router.use(jwtAuthMiddleware as any);

router.get('/', validateQuery(PaginationSchema), async (req: AuthRequest, res: any) => {
  const { offset, limit } = req.query as any;
  
  const agents = await req.store.getAgents({ userId: req.userId!, offset, limit });
  
  res.json({
    data: agents.data,
    total: agents.total,
    offset,
    limit,
    hasMore: offset + limit < agents.total,
  });
});

router.get('/:id', validateParams(IdParamSchema), (req, res) => {
  const agent = req.runtime.getAgent(req.params['id']!);
  if (!agent) {
    res.status(404).json({ error: 'Agent not found' });
    return;
  }
  res.json({
    id: agent.id,
    name: agent.getName(),
    model: agent.getModel(),
    status: agent.getStatus(),
    config: agent.config,
    state: agent.getState().toObject(),
  });
});

router.post('/', validateBody(CreateAgentSchema), async (req: AuthRequest, res: any) => {
  try {
    const config = req.body;

    const agent = req.runtime.createAgent(config, async (ctx) => {
      ctx.logger.info('Agent executed via API');
      return { input: ctx.input, processed: true };
    });

    await req.store.addAgent({
      id: agent.id,
      userId: req.userId!,
      name: agent.getName(),
      model: agent.getModel(),
      config: agent.config,
    });

    res.status(201).json({
      id: agent.id,
      name: agent.getName(),
      model: agent.getModel(),
      status: agent.getStatus(),
    });
  } catch (error) {
    throw error;
  }
});

router.post('/:id/execute', usageLimiter as any, validateParams(IdParamSchema), validateBody(ExecuteAgentSchema), async (req: AuthRequest, res: any) => {
  const agent = req.runtime.getAgent(req.params['id']!);
  if (!agent) {
    res.status(404).json({ error: 'Agent not found' });
    return;
  }

  try {
    const result = await req.orchestrator.executeTask(agent.id, req.body.input);
    await req.store.addExecution({ ...result, userId: req.userId! });

    const trace = req.orchestrator.getTrace(result.executionId);
    if (trace) {
      await req.store.addTrace(trace);
    }

    const costs = req.orchestrator.getCosts().filter(
      (c) => c.executionId === result.executionId
    );
    for (const cost of costs) {
      await req.store.addCost(cost);
    }

    await incrementUsage(req.userId!);

    if (req.cache) {
      await req.cache.del('costs:summary');
    }

    res.json(result);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

router.delete('/:id', validateParams(IdParamSchema), (req, res) => {
  const removed = req.runtime.removeAgent(req.params['id']!);
  if (!removed) {
    res.status(404).json({ error: 'Agent not found' });
    return;
  }
  res.status(204).send();
});

router.get('/:id/logs', validateParams(IdParamSchema), validateQuery(PaginationSchema), async (req, res) => {
  try {
    const agent = req.runtime.getAgent(req.params['id']!);
    if (!agent) {
      res.status(404).json({ error: 'Agent not found' });
      return;
    }
    const logs = await req.store.getLogs({ agentId: agent.id });
    res.json(logs);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

export { router as agentRoutes };
