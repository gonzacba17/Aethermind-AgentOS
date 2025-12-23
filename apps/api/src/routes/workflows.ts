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
  const limit = parseInt(req.query.limit as string) || 50;
  const offset = parseInt(req.query.offset as string) || 0;
  
  const allWorkflows = req.workflowEngine.listWorkflows();
  const total = allWorkflows.length;
  const workflows = allWorkflows.slice(offset, offset + limit);
  
  res.json({
    data: workflows.map((name) => ({
      name,
      definition: req.workflowEngine.getWorkflow(name),
    })),
    total,
    limit,
    offset,
    hasMore: offset + limit < total,
  });
});

router.get('/:name', async (req, res) => {
  const workflowName = req.params['name']!;
  const cacheKey = `workflow:${workflowName}`;

  if (req.cache) {
    const cached = await req.cache.get(cacheKey);
    if (cached) {
      res.json(cached);
      return;
    }
  }

  const workflow = req.workflowEngine.getWorkflow(workflowName);
  if (!workflow) {
    res.status(404).json({ error: 'Workflow not found' });
    return;
  }

  if (req.cache) {
    await req.cache.set(cacheKey, JSON.stringify(workflow), 300);
  }

  res.json(workflow);
});

// Check for duplicate workflow names
router.post('/', async (req, res) => {
  try {
    const definition = CreateWorkflowSchema.parse(req.body);
    
    // Check if workflow already exists
    const existing = req.workflowEngine.getWorkflow(definition.name);
    if (existing) {
      res.status(409).json({ error: 'Workflow already exists' });
      return;
    }
    
    // Validate step references and detect circular dependencies
    const stepIds = new Set(definition.steps.map(s => s.id));
    
    // Check entry point exists
    if (!stepIds.has(definition.entryPoint)) {
      res.status(400).json({ error: 'Validation error', details: 'Invalid entry point' });
      return;
    }
    
    // Check all step references are valid
    for (const step of definition.steps) {
      if (step.next) {
        const nextSteps = Array.isArray(step.next) ? step.next : [step.next];
        for (const nextId of nextSteps) {
          if (!stepIds.has(nextId)) {
            res.status(400).json({ error: 'Validation error', details: `Invalid step reference: ${nextId}` });
            return;
          }
        }
      }
    }
    
    // Detect circular dependencies
    const detectCircular = (stepId: string, visited: Set<string>): boolean => {
      if (visited.has(stepId)) return true;
      visited.add(stepId);
      
      const step = definition.steps.find(s => s.id === stepId);
      if (!step?.next) return false;
      
      const nextSteps = Array.isArray(step.next) ? step.next : [step.next];
      for (const nextId of nextSteps) {
        if (detectCircular(nextId, new Set(visited))) return true;
      }
      return false;
    };
    
    if (detectCircular(definition.entryPoint, new Set())) {
      res.status(400).json({ error: 'Validation error', details: 'Workflow contains circular dependencies' });
      return;
    }
    
    // Cast to WorkflowDefinition since Zod validates all required fields
    req.workflowEngine.registerWorkflow(definition as import('@aethermind/core').WorkflowDefinition);

    if (req.cache) {
      await req.cache.del(`workflow:${definition.name}`);
    }

    res.status(201).json({ name: definition.name, message: 'Workflow created' });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation error', details: error.errors });
      return;
    }
    throw error;
  }
});

router.put('/:name', async (req, res) => {
  const workflowName = req.params['name']!;
  const workflow = req.workflowEngine.getWorkflow(workflowName);
  
  if (!workflow) {
    res.status(404).json({ error: 'Workflow not found' });
    return;
  }
  
  try {
    const updates = CreateWorkflowSchema.partial().parse(req.body);
    
    // Validate if steps are being updated
    if (updates.steps) {
      if (updates.steps.length === 0) {
        res.status(400).json({ error: 'Validation error', details: 'Workflow must have at least one step' });
        return;
      }
    }
    
    // Update workflow using WorkflowEngine
    req.workflowEngine.updateWorkflow(workflowName, updates as Partial<import('@aethermind/core').WorkflowDefinition>);
    
    if (req.cache) {
      await req.cache.del(`workflow:${workflowName}`);
    }
    
    res.json({ name: workflowName, message: 'Workflow updated' });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation error', details: error.errors });
      return;
    }
    throw error;
  }
});

router.delete('/:name', async (req, res) => {
  const workflowName = req.params['name']!;
  const workflow = req.workflowEngine.getWorkflow(workflowName);
  
  if (!workflow) {
    res.status(404).json({ error: 'Workflow not found' });
    return;
  }
  
  try {
    // Delete workflow using WorkflowEngine
    req.workflowEngine.deleteWorkflow(workflowName);
    
    if (req.cache) {
      await req.cache.del(`workflow:${workflowName}`);
    }
    
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
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

    if (req.cache) {
      await req.cache.del('costs:summary');
    }

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

