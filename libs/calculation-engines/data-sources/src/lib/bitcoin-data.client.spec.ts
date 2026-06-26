import { BitcoinDataClient, BitcoinDataClientError } from './bitcoin-data.client';

describe('BitcoinDataClient', () => {
  it('fetches and normalizes the latest MVRV Z-Score value', async () => {
    const fetchFn = jest.fn().mockResolvedValue(
      createJsonResponse({ d: '2026-06-15', unixTs: 1781481600, mvrvZscore: 0.4178 }),
    );
    const client = new BitcoinDataClient({ fetchFn: fetchFn as never });

    await expect(client.fetchMvrvZScore()).resolves.toEqual({
      date: '2026-06-15',
      value: 0.4178,
    });
    expect(fetchFn).toHaveBeenCalledWith('https://bitcoin-data.com/v1/mvrv-zscore/last');
  });

  it('fetches and normalizes the latest Realized Price value', async () => {
    const fetchFn = jest.fn().mockResolvedValue(
      createJsonResponse({ d: '2026-06-15', unixTs: 1781481600, realizedPrice: 53020.27 }),
    );
    const client = new BitcoinDataClient({ fetchFn: fetchFn as never });

    await expect(client.fetchRealizedPrice()).resolves.toEqual({
      date: '2026-06-15',
      value: 53020.27,
    });
    expect(fetchFn).toHaveBeenCalledWith('https://bitcoin-data.com/v1/realized-price/last');
  });

  it('fetches Balanced Price history with alternate response field names', async () => {
    const fetchFn = jest.fn().mockResolvedValue(
      createJsonResponse([
        { d: '2026-06-14', balanced_price: 52000 },
        { d: '2026-06-15', balancedPrice: 52100 },
        { d: '2026-06-16', 'balanced-price': 52200 },
      ]),
    );
    const client = new BitcoinDataClient({ fetchFn: fetchFn as never });

    await expect(client.fetchBalancedPriceHistory()).resolves.toEqual([
      { date: '2026-06-14', value: 52000 },
      { date: '2026-06-15', value: 52100 },
      { date: '2026-06-16', value: 52200 },
    ]);
    expect(fetchFn).toHaveBeenCalledWith('https://bitcoin-data.com/v1/balanced-price');
  });

  it('logs request details and throws when the API responds with an error', async () => {
    const logger = { error: jest.fn() };
    const fetchFn = jest.fn().mockResolvedValue({ ok: false, status: 503, json: jest.fn() });
    const client = new BitcoinDataClient({ fetchFn: fetchFn as never, logger, retryAttempts: 0 });

    await expect(client.fetchMvrvZScore()).rejects.toMatchObject({
      statusCode: 503,
    } satisfies Partial<BitcoinDataClientError>);
    expect(logger.error).toHaveBeenCalledWith(
      'MVRV Z-Score request failed',
      expect.objectContaining({
        error: 'MVRV Z-Score request failed with status 503',
      }),
    );
  });

  it('throws when the response is missing a date', async () => {
    const client = new BitcoinDataClient({
      fetchFn: jest.fn().mockResolvedValue(createJsonResponse({ mvrvZscore: 0.4 })) as never,
      logger: { error: jest.fn() },
      retryAttempts: 0,
    });

    await expect(client.fetchMvrvZScore()).rejects.toThrow('MVRV Z-Score response is missing a date');
  });

  it('throws when the value is not numeric', async () => {
    const client = new BitcoinDataClient({
      fetchFn: jest.fn().mockResolvedValue(
        createJsonResponse({ d: '2026-06-15', realizedPrice: 'n/a' }),
      ) as never,
      logger: { error: jest.fn() },
      retryAttempts: 0,
    });

    await expect(client.fetchRealizedPrice()).rejects.toThrow(
      'Realized Price response has an invalid value',
    );
  });

  it('retries service failures with exponential backoff before succeeding', async () => {
    const sleep = jest.fn().mockResolvedValue(undefined);
    const fetchFn = jest
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 503, json: jest.fn() })
      .mockResolvedValueOnce({ ok: false, status: 503, json: jest.fn() })
      .mockResolvedValue(createJsonResponse({ d: '2026-06-15', mvrvZscore: 0.4178 }));
    const client = new BitcoinDataClient({
      fetchFn: fetchFn as never,
      logger: { error: jest.fn() },
      sleep,
    });

    await expect(client.fetchMvrvZScore()).resolves.toEqual({ date: '2026-06-15', value: 0.4178 });
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
