import { Router } from 'express';
import { z } from 'zod';
import type { Router as ExpressRouter } from 'express';

const router: ExpressRouter = Router();

const WorkflowStepSchema = z.object({
  id: z.string().min(1),
  agent: z.string().min(1),
  next: z.union([z.string(), z.array(z.string())]).optional(),
  condition: z.string().optional(),
  parallel: z.boolean().optional(),
});

const CreateWorkflowSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  steps: z.array(WorkflowStepSchema).min(1),
  entryPoint: z.string().min(1),
});

router.get('/', (req, res) => {
  const workflows = req.workflowEngine.listWorkflows();
  res.json(workflows.map((name) => ({
    name,
    definition: req.workflowEngine.getWorkflow(name),
  })));
});

router.get('/:name', (req, res) => {
  const workflow = req.workflowEngine.getWorkflow(req.params['name']!);
  if (!workflow) {
    res.status(404).json({ error: 'Workflow not found' });
    return;
  }
  res.json(workflow);
});

router.post('/', (req, res) => {
  try {
    const definition = CreateWorkflowSchema.parse(req.body);
    req.workflowEngine.registerWorkflow(definition);
    res.status(201).json({ name: definition.name, message: 'Workflow created' });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation error', details: error.errors });
      return;
    }
    throw error;
  }
});

router.post('/:name/estimate', async (req, res) => {
  const workflow = req.workflowEngine.getWorkflow(req.params['name']!);
  if (!workflow) {
    res.status(404).json({ error: 'Workflow not found' });
    return;
  }

  try {
    // Import CostEstimationService dynamically to avoid circular dependencies
    const { CostEstimationService } = await import('@aethermind/core');
    const costService = new CostEstimationService(req.runtime, req.store);

    const estimate = await costService.estimateWorkflowCost(workflow, req.body.input || {});

    res.json({
      workflowName: workflow.name,
      estimatedCost: estimate.totalCost,
      currency: estimate.currency,
      breakdown: estimate.breakdown,
      tokenCount: estimate.totalTokens,
      confidence: estimate.confidence,
      basedOn: estimate.basedOn,
      timestamp: estimate.timestamp,
    });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

router.post('/:name/execute', async (req, res) => {
  const workflow = req.workflowEngine.getWorkflow(req.params['name']!);
  if (!workflow) {
    res.status(404).json({ error: 'Workflow not found' });
    return;
  }

  try {
    const result = await req.workflowEngine.execute(req.params['name']!, req.body.input);

    const resultsObject: Record<string, unknown> = {};
    for (const [key, value] of result.stepResults) {
      resultsObject[key] = value;
    }

    res.json({
      executionId: result.executionId,
      workflowName: result.workflowName,
      status: result.status,
      output: result.output,
      duration: result.duration,
      stepResults: resultsObject,
    });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

export { router as workflowRoutes };

