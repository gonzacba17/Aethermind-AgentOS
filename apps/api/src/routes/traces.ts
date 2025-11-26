import { Router } from 'express';
import type { Router as ExpressRouter } from 'express';

const router: ExpressRouter = Router();

router.get('/', async (req, res) => {
  try {
    const traces = await req.store.getAllTraces();
    res.json(traces);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

router.get('/:id', async (req, res) => {
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
