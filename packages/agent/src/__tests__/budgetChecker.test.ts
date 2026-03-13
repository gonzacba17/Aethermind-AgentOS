import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AethermindBudgetExceededError } from '../errors/AethermindBudgetExceededError.js';

describe('AethermindBudgetExceededError', () => {
  it('extends Error correctly', () => {
    const error = new AethermindBudgetExceededError({
      limitUsd: 100,
      spentUsd: 105,
      percentUsed: 105,
      budgetType: 'monthly',
    });

    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(AethermindBudgetExceededError);
  });

  it('has correct name property', () => {
    const error = new AethermindBudgetExceededError({
      limitUsd: 100,
      spentUsd: 105,
      percentUsed: 105,
      budgetType: 'monthly',
    });

    expect(error.name).toBe('AethermindBudgetExceededError');
  });

  it('generates descriptive message', () => {
    const error = new AethermindBudgetExceededError({
      limitUsd: 100,
      spentUsd: 105,
      percentUsed: 105,
      budgetType: 'monthly',
    });

    expect(error.message).toContain('Budget limit of $100 reached');
    expect(error.message).toContain('Execution blocked');
    expect(error.message).toContain('$105');
    expect(error.message).toContain('105%');
  });

  it('exposes budgetInfo property', () => {
    const info = {
      limitUsd: 50,
      spentUsd: 42.5,
      percentUsed: 85,
      budgetType: 'daily' as const,
    };

    const error = new AethermindBudgetExceededError(info);

    expect(error.budgetInfo).toEqual(info);
    expect(error.budgetInfo.limitUsd).toBe(50);
    expect(error.budgetInfo.spentUsd).toBe(42.5);
    expect(error.budgetInfo.percentUsed).toBe(85);
    expect(error.budgetInfo.budgetType).toBe('daily');
  });

  it('works with instanceof checks', () => {
    const error = new AethermindBudgetExceededError({
      limitUsd: 100,
      spentUsd: 100,
      percentUsed: 100,
      budgetType: 'monthly',
    });

    // This is critical for SDK users catching specific errors
    try {
      throw error;
    } catch (e) {
      expect(e instanceof AethermindBudgetExceededError).toBe(true);
      expect(e instanceof Error).toBe(true);
    }
  });

  it('has a stack trace', () => {
    const error = new AethermindBudgetExceededError({
      limitUsd: 100,
      spentUsd: 100,
      percentUsed: 100,
      budgetType: 'monthly',
    });

    expect(error.stack).toBeDefined();
    expect(error.stack).toContain('AethermindBudgetExceededError');
  });
});
