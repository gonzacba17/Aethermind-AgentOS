import { Router } from 'express';
import type { Router as ExpressRouter } from 'express';
import { validateQuery } from '../middleware/validator.js';
import { LogFilterSchema } from '@aethermind/core';

const router: ExpressRouter = Router();

router.get('/', validateQuery(LogFilterSchema), async (req, res) => {
  try {
    const { level, agentId, executionId, limit, offset } = req.query as any;

    const logsResult = await req.store.getLogs({
      level,
      agentId,
      executionId,
      limit,
      offset,
    });

    res.json(logsResult);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

router.delete('/', async (req, res) => {
  try {
    await req.store.clearLogs();
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

router.get('/stream', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const sendLog = (entry: unknown) => {
    res.write(`data: ${JSON.stringify(entry)}\n\n`);
  };

  const unsubscribe = req.runtime.getLogger().onLog(sendLog);

  req.on('close', () => {
    unsubscribe();
    res.end();
  });
});

export { router as logRoutes };
