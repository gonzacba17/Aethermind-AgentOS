import { Router } from 'express';
import type { Router as ExpressRouter } from 'express';
import { validateParams, validateQuery } from '../middleware/validator.js';
import { IdParamSchema, PaginationSchema } from '@aethermind/core';

const router: ExpressRouter = Router();

router.get('/', validateQuery(PaginationSchema), async (req, res) => {
  try {
    const executions = await req.store.getAllExecutions();
    const { offset, limit } = req.query as any;
    
    const paginatedExecutions = executions.slice(offset, offset + limit);
    
    res.json({
      data: paginatedExecutions,
      total: executions.length,
      offset,
      limit,
      hasMore: offset + limit < executions.length,
    });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

router.get('/:id', validateParams(IdParamSchema), async (req, res) => {
  try {
    const execution = await req.store.getExecution(req.params['id']!);
    if (!execution) {
      res.status(404).json({ error: 'Execution not found' });
      return;
    }
    res.json(execution);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

router.get('/:id/logs', validateParams(IdParamSchema), async (req, res) => {
  try {
    const logs = await req.store.getLogs({ executionId: req.params['id'] });
    res.json(logs);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

router.get('/:id/trace', validateParams(IdParamSchema), async (req, res) => {
  try {
    const trace = await req.store.getTrace(req.params['id']!);
    if (!trace) {
      res.status(404).json({ error: 'Trace not found' });
      return;
    }
    res.json(trace);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

router.get('/agent/:agentId', validateParams(IdParamSchema.extend({ agentId: IdParamSchema.shape.id })), async (req, res) => {
  try {
    const executions = await req.store.getExecutionsByAgent(req.params['agentId']!);
    res.json(executions);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

export { router as executionRoutes };
