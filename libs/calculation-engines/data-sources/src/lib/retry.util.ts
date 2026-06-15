export interface RetryWithBackoffOptions {
  sleep?: (milliseconds: number) => Promise<void>;
  shouldRetry?: (error: unknown) => boolean;
}

export class RetryExhaustedError extends Error {
  public readonly statusCode?: number;

  constructor(
    message: string,
    public readonly cause: unknown,
    public readonly retryCount: number,
    public readonly attempts: number,
  ) {
    super(message);
    this.statusCode = getStatusCode(cause);
  }
}

export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxAttempts = 3,
  baseDelay = 1000,
  options: RetryWithBackoffOptions = {},
): Promise<T> {
  const sleep = options.sleep ?? delay;
  const shouldRetry = options.shouldRetry ?? (() => true);
  let lastError: unknown;

  for (let retryIndex = 0; retryIndex <= maxAttempts; retryIndex += 1) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      if (retryIndex === maxAttempts || !shouldRetry(error)) {
        throw new RetryExhaustedError(
          error instanceof Error ? error.message : String(error),
          error,
          retryIndex,
          retryIndex + 1,
        );
      }

      await sleep(baseDelay * 2 ** retryIndex);
    }
  }

  throw new RetryExhaustedError('Retry attempts exhausted', lastError, maxAttempts, maxAttempts + 1);
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function getStatusCode(error: unknown): number | undefined {
  return typeof error === 'object' &&
    error !== null &&
    'statusCode' in error &&
    typeof error.statusCode === 'number'
    ? error.statusCode
    : undefined;
}
