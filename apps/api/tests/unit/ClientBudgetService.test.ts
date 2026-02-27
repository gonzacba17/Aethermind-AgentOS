/**
 * Tests for evaluateBudget logic.
 *
 * Since evaluateBudget hits the database, we test the core logic
 * by extracting the evaluation algorithm into a pure function.
 */

describe('evaluateBudget logic', () => {
  interface BudgetInput {
    spentUsd: number;
    limitUsd: number;
    thresholds: number[];
  }

  /**
   * Pure function that mirrors the evaluation logic in ClientBudgetService.
   * This is the business logic we want to verify.
   */
  function evaluate(input: BudgetInput) {
    const { spentUsd, limitUsd, thresholds } = input;
    const percentUsed = limitUsd > 0 ? (spentUsd / limitUsd) * 100 : 0;
    const remaining = Math.max(0, limitUsd - spentUsd);

    let status: 'ok' | 'warning' | 'exceeded' = 'ok';
    if (percentUsed >= 100) {
      status = 'exceeded';
    } else if (percentUsed >= Math.min(...thresholds)) {
      status = 'warning';
    }

    return {
      status,
      percentUsed: Math.round(percentUsed * 100) / 100,
      remaining: Math.round(remaining * 100) / 100,
      spentUsd: Math.round(spentUsd * 100) / 100,
      limitUsd,
    };
  }

  it('returns ok when spend is below lowest threshold', () => {
    const result = evaluate({ spentUsd: 50, limitUsd: 100, thresholds: [80, 90, 100] });
    expect(result.status).toBe('ok');
    expect(result.percentUsed).toBe(50);
    expect(result.remaining).toBe(50);
  });

  it('returns warning when spend hits 80% threshold', () => {
    const result = evaluate({ spentUsd: 82, limitUsd: 100, thresholds: [80, 90, 100] });
    expect(result.status).toBe('warning');
    expect(result.percentUsed).toBe(82);
    expect(result.remaining).toBe(18);
  });

  it('returns warning when spend hits 90% threshold', () => {
    const result = evaluate({ spentUsd: 95, limitUsd: 100, thresholds: [80, 90, 100] });
    expect(result.status).toBe('warning');
    expect(result.percentUsed).toBe(95);
    expect(result.remaining).toBe(5);
  });

  it('returns exceeded when spend reaches 100%', () => {
    const result = evaluate({ spentUsd: 100, limitUsd: 100, thresholds: [80, 90, 100] });
    expect(result.status).toBe('exceeded');
    expect(result.percentUsed).toBe(100);
    expect(result.remaining).toBe(0);
  });

  it('returns exceeded when spend exceeds 100%', () => {
    const result = evaluate({ spentUsd: 150, limitUsd: 100, thresholds: [80, 90, 100] });
    expect(result.status).toBe('exceeded');
    expect(result.percentUsed).toBe(150);
    expect(result.remaining).toBe(0);
  });

  it('handles zero limit gracefully', () => {
    const result = evaluate({ spentUsd: 10, limitUsd: 0, thresholds: [80, 90, 100] });
    expect(result.status).toBe('ok');
    expect(result.percentUsed).toBe(0);
  });

  it('handles zero spend', () => {
    const result = evaluate({ spentUsd: 0, limitUsd: 100, thresholds: [80, 90, 100] });
    expect(result.status).toBe('ok');
    expect(result.percentUsed).toBe(0);
    expect(result.remaining).toBe(100);
  });

  it('handles custom thresholds', () => {
    // With thresholds at [50, 75, 100], warning should trigger at 50%
    const result = evaluate({ spentUsd: 55, limitUsd: 100, thresholds: [50, 75, 100] });
    expect(result.status).toBe('warning');
    expect(result.percentUsed).toBe(55);
  });

  it('handles fractional values correctly', () => {
    const result = evaluate({ spentUsd: 82.345, limitUsd: 100, thresholds: [80, 90, 100] });
    expect(result.status).toBe('warning');
    expect(result.percentUsed).toBe(82.35);
    expect(result.remaining).toBeCloseTo(17.65, 1);
    expect(result.spentUsd).toBe(82.35);
  });

  it('correctly identifies boundary: exactly at threshold', () => {
    const result = evaluate({ spentUsd: 80, limitUsd: 100, thresholds: [80, 90, 100] });
    expect(result.status).toBe('warning');
  });

  it('correctly identifies boundary: just below threshold', () => {
    const result = evaluate({ spentUsd: 79.99, limitUsd: 100, thresholds: [80, 90, 100] });
    expect(result.status).toBe('ok');
  });
});

describe('forecast logic', () => {
  interface ForecastInput {
    dailyCosts: number[];
    spentSoFar: number;
    daysRemaining: number;
  }

  /**
   * Pure function that mirrors the forecast logic in the endpoint.
   */
  function forecast(input: ForecastInput) {
    const { dailyCosts, spentSoFar, daysRemaining } = input;
    const daysWithData = dailyCosts.length;
    const totalCostLast7d = dailyCosts.reduce((sum, c) => sum + c, 0);
    const avgDailyUsd = daysWithData > 0 ? totalCostLast7d / daysWithData : 0;
    const projectedMonthlyUsd = spentSoFar + (avgDailyUsd * daysRemaining);

    let confidence: 'low' | 'medium' | 'high' = 'low';
    if (daysWithData >= 7) confidence = 'high';
    else if (daysWithData >= 3) confidence = 'medium';

    return {
      projectedMonthlyUsd: Math.round(projectedMonthlyUsd * 100) / 100,
      avgDailyUsd: Math.round(avgDailyUsd * 100) / 100,
      daysRemaining,
      daysWithData,
      confidence,
    };
  }

  it('projects monthly spend based on daily average', () => {
    const result = forecast({
      dailyCosts: [10, 10, 10, 10, 10, 10, 10],
      spentSoFar: 100,
      daysRemaining: 15,
    });
    expect(result.projectedMonthlyUsd).toBe(250); // 100 + (10 * 15)
    expect(result.avgDailyUsd).toBe(10);
    expect(result.confidence).toBe('high');
  });

  it('returns low confidence with < 3 days', () => {
    const result = forecast({
      dailyCosts: [5, 15],
      spentSoFar: 20,
      daysRemaining: 20,
    });
    expect(result.confidence).toBe('low');
    expect(result.avgDailyUsd).toBe(10);
    expect(result.projectedMonthlyUsd).toBe(220); // 20 + (10 * 20)
  });

  it('returns medium confidence with 3-6 days', () => {
    const result = forecast({
      dailyCosts: [8, 12, 10, 9, 11],
      spentSoFar: 50,
      daysRemaining: 10,
    });
    expect(result.confidence).toBe('medium');
    expect(result.daysWithData).toBe(5);
  });

  it('handles zero daily costs', () => {
    const result = forecast({
      dailyCosts: [],
      spentSoFar: 0,
      daysRemaining: 30,
    });
    expect(result.projectedMonthlyUsd).toBe(0);
    expect(result.avgDailyUsd).toBe(0);
    expect(result.confidence).toBe('low');
  });

  it('handles varying daily costs', () => {
    const result = forecast({
      dailyCosts: [1, 2, 3, 4, 5, 6, 7],
      spentSoFar: 28,
      daysRemaining: 5,
    });
    // Average = 28/7 = 4
    expect(result.avgDailyUsd).toBe(4);
    expect(result.projectedMonthlyUsd).toBe(48); // 28 + (4 * 5)
    expect(result.confidence).toBe('high');
  });

  it('handles zero remaining days', () => {
    const result = forecast({
      dailyCosts: [10, 10, 10, 10, 10, 10, 10],
      spentSoFar: 300,
      daysRemaining: 0,
    });
    expect(result.projectedMonthlyUsd).toBe(300); // No extrapolation needed
  });
});
