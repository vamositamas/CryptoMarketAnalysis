import { RetryExhaustedError, retryWithBackoff } from './retry.util';

describe('retryWithBackoff', () => {
  it('returns immediately when the operation succeeds', async () => {
    const operation = jest.fn().mockResolvedValue('ok');
    const sleep = jest.fn();

    await expect(retryWithBackoff(operation, 3, 1000, { sleep })).resolves.toBe('ok');

    expect(operation).toHaveBeenCalledTimes(1);
    expect(sleep).not.toHaveBeenCalled();
  });

  it('retries with exponential backoff delays before succeeding', async () => {
    const operation = jest
      .fn()
      .mockRejectedValueOnce(new Error('first'))
      .mockRejectedValueOnce(new Error('second'))
      .mockResolvedValue('ok');
    const sleep = jest.fn().mockResolvedValue(undefined);

    await expect(retryWithBackoff(operation, 3, 1000, { sleep })).resolves.toBe('ok');

    expect(operation).toHaveBeenCalledTimes(3);
    expect(sleep).toHaveBeenCalledWith(1000);
    expect(sleep).toHaveBeenCalledWith(2000);
  });

  it('throws the last error with retry metadata when attempts are exhausted', async () => {
    const lastError = new Error('still down');
    const operation = jest
      .fn()
      .mockRejectedValueOnce(new Error('down'))
      .mockRejectedValueOnce(lastError);

    await expect(
      retryWithBackoff(operation, 1, 1000, { sleep: jest.fn().mockResolvedValue(undefined) }),
    ).rejects.toMatchObject({
      message: 'still down',
      cause: lastError,
      retryCount: 1,
      attempts: 2,
    } satisfies Partial<RetryExhaustedError>);
  });
});
