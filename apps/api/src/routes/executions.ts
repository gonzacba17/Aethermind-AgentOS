import { Router } from 'express';
import type { Router as ExpressRouter } from 'express';

const router: ExpressRouter = Router();

router.get('/', async (req, res) => {
  try {
    const executions = await req.store.getAllExecutions();
    res.json(executions);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

router.get('/:id', async (req, res) => {
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

router.get('/:id/logs', async (req, res) => {
  try {
    const logs = await req.store.getLogs({ executionId: req.params['id'] });
    res.json(logs);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

router.get('/:id/trace', async (req, res) => {
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

router.get('/agent/:agentId', async (req, res) => {
  try {
    const executions = await req.store.getExecutionsByAgent(req.params['agentId']!);
    res.json(executions);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

export { router as executionRoutes };
