import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { retryWithBackoff, type RetryConfig } from '../utils/retry.js';

describe('retryWithBackoff', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should return result on first successful attempt', async () => {
    const fn = vi.fn().mockResolvedValue('success');

    const result = await retryWithBackoff(fn);

    expect(result).toBe('success');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('should retry on failure and succeed', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error('First fail'))
      .mockRejectedValueOnce(new Error('Second fail'))
      .mockResolvedValue('success');

    const resultPromise = retryWithBackoff(fn, { maxRetries: 3 });

    // Fast-forward through delays
    await vi.runAllTimersAsync();

    const result = await resultPromise;

    expect(result).toBe('success');
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('should throw after max retries exceeded', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('Always fails'));

    const resultPromise = retryWithBackoff(fn, { maxRetries: 2 });

    // Fast-forward through delays
    await vi.runAllTimersAsync();

    await expect(resultPromise).rejects.toThrow('Always fails');
    expect(fn).toHaveBeenCalledTimes(3); // Initial + 2 retries
  });

  it('should use exponential backoff', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error('Fail 1'))
      .mockRejectedValueOnce(new Error('Fail 2'))
      .mockResolvedValue('success');

    const config: RetryConfig = {
      maxRetries: 3,
      initialDelayMs: 100,
      maxDelayMs: 10000,
      backoffMultiplier: 2,
    };

    const resultPromise = retryWithBackoff(fn, config);

    // First attempt fails immediately
    await vi.advanceTimersByTimeAsync(0);
    expect(fn).toHaveBeenCalledTimes(1);

    // Wait for first delay (100ms)
    await vi.advanceTimersByTimeAsync(100);
    expect(fn).toHaveBeenCalledTimes(2);

    // Wait for second delay (200ms = 100 * 2^1)
    await vi.advanceTimersByTimeAsync(200);
    expect(fn).toHaveBeenCalledTimes(3);

    const result = await resultPromise;
    expect(result).toBe('success');
  });

  it('should cap delay at maxDelayMs', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error('Fail'))
      .mockResolvedValue('success');

    const config: RetryConfig = {
      maxRetries: 1,
      initialDelayMs: 5000,
      maxDelayMs: 1000, // Max is less than initial
      backoffMultiplier: 2,
    };

    const resultPromise = retryWithBackoff(fn, config);

    await vi.advanceTimersByTimeAsync(0);
    expect(fn).toHaveBeenCalledTimes(1);

    // Delay should be capped at 1000ms
    await vi.advanceTimersByTimeAsync(1000);
    expect(fn).toHaveBeenCalledTimes(2);

    await resultPromise;
  });

  it('should convert non-Error throws to Error', async () => {
    const fn = vi.fn().mockRejectedValue('string error');

    const resultPromise = retryWithBackoff(fn, { maxRetries: 0 });

    await expect(resultPromise).rejects.toThrow('string error');
  });

  it('should use default config when not specified', async () => {
    const fn = vi.fn().mockResolvedValue('success');

    const result = await retryWithBackoff(fn);

    expect(result).toBe('success');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('should log retry attempts', async () => {
    const consoleSpy = vi.spyOn(console, 'warn');
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error('Fail'))
      .mockResolvedValue('success');

    const resultPromise = retryWithBackoff(fn, {
      maxRetries: 1,
      initialDelayMs: 100,
      maxDelayMs: 1000,
      backoffMultiplier: 2,
    });

    await vi.runAllTimersAsync();
    await resultPromise;

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('[Aethermind] Retry attempt 1/1 after 100ms')
    );
  });
});
