/**
 * CRITICAL INTEGRATION: Budget Enforcement in Orchestrator
 * 
 * This code MUST be added to Orchestrator.ts to enable budget blocking.
 * Without this, budgets are tracked but NOT enforced.
 * 
 * Location: packages/core/src/orchestrator/Orchestrator.ts
 */

// ============================================
// 1. ADD IMPORTS AT TOP OF FILE
// ============================================

import { BudgetExceededError } from '../errors/BudgetExceededError.js';

// ============================================
// 2. ADD BUDGET SERVICE TO CONSTRUCTOR
// ============================================

export class Orchestrator {
  private runtime: AgentRuntime;
  private config: OrchestratorConfig;
  private emitter: EventEmitter.EventEmitter;
  private logger: StructuredLogger;
  private workflows: Map<string, WorkflowDefinition> = new Map();
  private taskQueueService: TaskQueueService | null;
  private pendingTasks: Map<string, PendingTask> = new Map();
  private traces: Map<string, Trace> = new Map();
  private costs: CostInfo[] = [];
  
  // ADD THIS:
  private budgetService: any | null = null;  // Will be injected from API

  constructor(
    runtime: AgentRuntime,
    queueService: TaskQueueService | null,
    config: Partial<OrchestratorConfig> = {}
  ) {
    // ... existing code
  }

  // ADD THIS METHOD:
  setBudgetService(budgetService: any): void {
    this.budgetService = budgetService;
  }

// ============================================
// 3. MODIFY executeWorkflow() METHOD
// ============================================

async executeWorkflow(
  workflowName: string,
  input: unknown,
  options?: { userId?: string }  // ADD THIS PARAMETER
): Promise<{ executionId: string; results: Map<string, ExecutionResult> }> {
  const workflow = this.workflows.get(workflowName);
  if (!workflow) {
    throw new Error(`Workflow not found: ${workflowName}`);
  }

  // ============================================
  // ADD BUDGET VALIDATION HERE (BEFORE EXECUTION)
  // ============================================
  
  if (this.budgetService && options?.userId) {
    this.logger.info('Validating budget before workflow execution', { 
      workflowName, 
      userId: options.userId 
    });

    // Estimate workflow cost (simplified - you may need to implement this)
    const estimatedCost = await this.estimateWorkflowCost(workflow, input);
    
    // Validate against budget
    const validation = await this.budgetService.validateBudget(
      options.userId,
      'workflow',
      workflowName,
      estimatedCost
    );

    if (!validation.allowed && validation.budget) {
      this.logger.warn('Workflow blocked by budget limit', {
        workflowName,
        budgetId: validation.budget.id,
        limitAmount: validation.budget.limitAmount,
        currentSpend: validation.budget.currentSpend,
        estimatedCost,
      });

      throw new BudgetExceededError({
        budgetId: validation.budget.id,
        budgetName: validation.budget.name,
        limitAmount: Number(validation.budget.limitAmount),
        currentSpend: Number(validation.budget.currentSpend),
        estimatedCost,
      });
    }

    this.logger.info('Budget validation passed', { 
      workflowName, 
      estimatedCost,
      remainingBudget: validation.budget 
        ? Number(validation.budget.limitAmount) - Number(validation.budget.currentSpend)
        : 'unlimited'
    });
  }

  // ============================================
  // EXISTING WORKFLOW EXECUTION CODE CONTINUES HERE
  // ============================================

  const executionId = uuid();
  const results = new Map<string, ExecutionResult>();
  const stepOutputs = new Map<string, unknown>();

  this.logger.info(`Starting workflow: ${workflowName}`, { executionId });
  this.emit('workflow:started', { executionId, workflowName, input });

  const rootTrace = this.createTraceNode(workflowName, 'workflow', input);

  try {
    // ... existing workflow execution logic ...
    
    // After successful completion, track actual cost
    let totalCost = 0;
    for (const [stepId, result] of results) {
      if (result.cost) {
        totalCost += result.cost;
      }
    }

    // ============================================
    // ADD BUDGET INCREMENT HERE (AFTER EXECUTION)
    // ============================================
    
    if (this.budgetService && options?.userId && totalCost > 0) {
      const budget = await this.budgetService.getActiveBudget(
        options.userId,
        'workflow',
        workflowName
      );
      
      if (budget) {
        await this.budgetService.incrementSpend(budget.id, totalCost);
        this.logger.info('Budget updated after workflow execution', {
          budgetId: budget.id,
          costAdded: totalCost,
          newSpend: Number(budget.currentSpend) + totalCost,
        });
      }
    }

    // ... rest of existing code ...
    
  } catch (error) {
    // ... existing error handling ...
    throw error;
  }
}

// ============================================
// 4. ADD HELPER METHOD FOR COST ESTIMATION
// ============================================

private async estimateWorkflowCost(
  workflow: WorkflowDefinition,
  input: unknown
): Promise<number> {
  // Simplified estimation - you may want to use CostEstimationService here
  // For now, return a conservative estimate based on step count
  const avgCostPerStep = 0.01; // $0.01 per step (adjust based on your models)
  return workflow.steps.length * avgCostPerStep;
}

// ============================================
// END OF INTEGRATION CODE
// ============================================

/**
 * INTEGRATION CHECKLIST:
 * 
 * [ ] Import BudgetExceededError at top of file
 * [ ] Add budgetService property to class
 * [ ] Add setBudgetService() method
 * [ ] Add options parameter to executeWorkflow()
 * [ ] Add budget validation BEFORE workflow execution
 * [ ] Add budget increment AFTER successful execution
 * [ ] Add estimateWorkflowCost() helper method
 * [ ] Test with real budget and workflow
 * 
 * TESTING:
 * 1. Create budget with $0.10 limit
 * 2. Execute workflow estimated at $0.05 (should work)
 * 3. Execute another workflow estimated at $0.10 (should block)
 * 4. Verify BudgetExceededError is thrown
 * 5. Verify error message is clear
 */
