import { FearGreedClient, FearGreedClientError } from './fear-greed.client';

describe('FearGreedClient', () => {
  it('fetches and normalizes the latest Fear & Greed Index value', async () => {
    const fetchFn = jest.fn().mockResolvedValue(
      createJsonResponse({
        data: [{ value: '23', value_classification: 'Extreme Fear', timestamp: '1781568000' }],
      }),
    );
    const client = new FearGreedClient({ fetchFn: fetchFn as never });

    await expect(client.fetchLatest()).resolves.toEqual({
      date: '2026-06-16',
      value: 23,
    });
    expect(fetchFn).toHaveBeenCalledWith('https://api.alternative.me/fng/?limit=1&format=json');
  });

  it('logs request details and throws when the API responds with an error', async () => {
    const logger = { error: jest.fn() };
    const fetchFn = jest.fn().mockResolvedValue({ ok: false, status: 503, json: jest.fn() });
    const client = new FearGreedClient({ fetchFn: fetchFn as never, logger, retryAttempts: 0 });

    await expect(client.fetchLatest()).rejects.toMatchObject({
      statusCode: 503,
    } satisfies Partial<FearGreedClientError>);
    expect(logger.error).toHaveBeenCalledWith(
      'Fear & Greed Index request failed',
      expect.objectContaining({
        error: 'Fear & Greed Index request failed with status 503',
      }),
    );
  });

  it('throws when the response is missing data', async () => {
    const client = new FearGreedClient({
      fetchFn: jest.fn().mockResolvedValue(createJsonResponse({ data: [] })) as never,
      logger: { error: jest.fn() },
      retryAttempts: 0,
    });

    await expect(client.fetchLatest()).rejects.toThrow(
      'Fear & Greed Index response is missing data',
    );
  });

  it('throws when the value is not numeric', async () => {
    const client = new FearGreedClient({
      fetchFn: jest.fn().mockResolvedValue(
        createJsonResponse({ data: [{ value: 'n/a', timestamp: '1781568000' }] }),
      ) as never,
      logger: { error: jest.fn() },
      retryAttempts: 0,
    });

    await expect(client.fetchLatest()).rejects.toThrow(
      'Fear & Greed Index response has an invalid value',
    );
  });

  it('retries service failures with exponential backoff before succeeding', async () => {
    const sleep = jest.fn().mockResolvedValue(undefined);
    const fetchFn = jest
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 503, json: jest.fn() })
      .mockResolvedValueOnce({ ok: false, status: 503, json: jest.fn() })
      .mockResolvedValue(
        createJsonResponse({ data: [{ value: '50', timestamp: '1781568000' }] }),
      );
    const client = new FearGreedClient({
      fetchFn: fetchFn as never,
      logger: { error: jest.fn() },
      sleep,
    });

    await expect(client.fetchLatest()).resolves.toEqual({ date: '2026-06-16', value: 50 });
    expect(fetchFn).toHaveBeenCalledTimes(3);
    expect(sleep).toHaveBeenCalledWith(1000);
    expect(sleep).toHaveBeenCalledWith(2000);
  });
});

function createJsonResponse(body: unknown): Response {
  return {
    ok: true,
    status: 200,
    json: jest.fn().mockResolvedValue(body),
  } as unknown as Response;
}
