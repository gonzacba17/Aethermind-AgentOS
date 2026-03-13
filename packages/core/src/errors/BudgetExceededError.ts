export class BudgetExceededError extends Error {
  public readonly budgetId: string;
  public readonly limitAmount: number;
  public readonly currentSpend: number;
  public readonly estimatedCost: number;
  public readonly budgetName: string;

  constructor(details: {
    budgetId: string;
    budgetName: string;
    limitAmount: number;
    currentSpend: number;
    estimatedCost: number;
  }) {
    super(
      `Budget "${details.budgetName}" exceeded. ` +
      `Limit: $${details.limitAmount.toFixed(2)}, ` +
      `Current: $${details.currentSpend.toFixed(2)}, ` +
      `Estimated: $${details.estimatedCost.toFixed(2)}`
    );
    
    this.name = 'BudgetExceededError';
    this.budgetId = details.budgetId;
    this.budgetName = details.budgetName;
    this.limitAmount = details.limitAmount;
    this.currentSpend = details.currentSpend;
    this.estimatedCost = details.estimatedCost;
    
    // Maintains proper stack trace for where our error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, BudgetExceededError);
    }
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      budgetId: this.budgetId,
      budgetName: this.budgetName,
      limitAmount: this.limitAmount,
      currentSpend: this.currentSpend,
      estimatedCost: this.estimatedCost,
    };
  }
}
