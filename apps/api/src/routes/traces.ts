import { Router } from 'express';
import type { Router as ExpressRouter } from 'express';
import { validateParams, validateQuery } from '../middleware/validator.js';
import { IdParamSchema, PaginationSchema } from '@aethermind/core';

const router: ExpressRouter = Router();

router.get('/', validateQuery(PaginationSchema), async (req, res) => {
  try {
    const traces = await req.store.getAllTraces();
    const { offset, limit } = req.query as any;
    
    const paginatedTraces = traces.slice(offset, offset + limit);
    
    res.json({
      data: paginatedTraces,
      total: traces.length,
      offset,
      limit,
      hasMore: offset + limit < traces.length,
    });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

router.get('/:id', validateParams(IdParamSchema), async (req, res) => {
  try {
    const trace = await req.store.getTrace(req.params['id']!);
    if (!trace) {
      const orchestratorTrace = req.orchestrator.getTrace(req.params['id']!);
      if (orchestratorTrace) {
        res.json(orchestratorTrace);
        return;
      }
      res.status(404).json({ error: 'Trace not found' });
      return;
    }
    res.json(trace);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

export { router as traceRoutes };
