/**
 * Error thrown when a budget limit has been exceeded.
 * Blocks LLM execution to enforce cost controls.
 */
export class AethermindBudgetExceededError extends Error {
  public override readonly name = 'AethermindBudgetExceededError';
  public readonly budgetInfo: {
    limitUsd: number;
    spentUsd: number;
    percentUsed: number;
    budgetType: string;
  };

  constructor(budgetInfo: {
    limitUsd: number;
    spentUsd: number;
    percentUsed: number;
    budgetType: string;
  }) {
    super(
      `Budget limit of $${budgetInfo.limitUsd} reached. Execution blocked. ` +
      `Current spend: $${budgetInfo.spentUsd} (${budgetInfo.percentUsed}% used).`
    );
    this.budgetInfo = budgetInfo;

    // Ensure proper prototype chain for instanceof checks
    Object.setPrototypeOf(this, AethermindBudgetExceededError.prototype);
  }
}
