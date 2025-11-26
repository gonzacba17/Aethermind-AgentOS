export class RetryError extends Error {
  constructor(
    message: string,
    public attempts: number,
    public lastError: Error
  ) {
    super(message);
    this.name = 'RetryError';
  }
}

export interface RetryOptions {
  maxAttempts?: number;
  initialDelay?: number;
  maxDelay?: number;
  backoffFactor?: number;
  retryableStatuses?: number[];
  onRetry?: (attempt: number, error: Error, delay: number) => void;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const {
    maxAttempts = 3,
    initialDelay = 1000,
    maxDelay = 10000,
    backoffFactor = 2,
    retryableStatuses = [408, 429, 500, 502, 503, 504],
    onRetry,
  } = options;

  let lastError: Error;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;

      if ((error as any).status && !retryableStatuses.includes((error as any).status)) {
        throw error;
      }

      if (attempt === maxAttempts - 1) {
        throw new RetryError(
          `Failed after ${maxAttempts} attempts`,
          maxAttempts,
          lastError
        );
      }

      const baseDelay = initialDelay * Math.pow(backoffFactor, attempt);
      const jitter = baseDelay * 0.2 * (Math.random() * 2 - 1);
      const delay = Math.min(baseDelay + jitter, maxDelay);

      if (onRetry) {
        onRetry(attempt + 1, lastError, delay);
      }

      await sleep(delay);
    }
  }

  throw new RetryError(
    `Failed after ${maxAttempts} attempts`,
    maxAttempts,
    lastError!
  );
}

export async function withTimeout<T>(
  fn: () => Promise<T>,
  timeoutMs: number,
  timeoutMessage = 'Operation timed out'
): Promise<T> {
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => {
      const error: any = new Error(timeoutMessage);
      error.status = 408;
      error.name = 'TimeoutError';
      reject(error);
    }, timeoutMs);
  });

  return Promise.race([fn(), timeoutPromise]);
}

export async function retryWithBackoffAndTimeout<T>(
  fn: () => Promise<T>,
  timeoutMs: number,
  retryOptions: RetryOptions = {}
): Promise<T> {
  return retryWithBackoff(() => withTimeout(fn, timeoutMs), retryOptions);
}
