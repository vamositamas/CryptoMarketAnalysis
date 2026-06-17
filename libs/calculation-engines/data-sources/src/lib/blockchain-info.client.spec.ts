import { BlockchainInfoClient, BlockchainInfoClientError } from './blockchain-info.client';

describe('BlockchainInfoClient', () => {
  it('fetches and normalizes market price values for a date range', async () => {
    const fetchFn = jest.fn().mockResolvedValue(
      createJsonResponse({
        values: [
          { x: 1780272000, y: 66000 },
          { x: 1780358400, y: 67234.5 },
          { x: 1780444800, y: 68000 },
        ],
      }),
    );
    const client = new BlockchainInfoClient({
      baseUrl: 'https://api.blockchain.info/charts',
      fetchFn: fetchFn as never,
    });

    await expect(client.fetchMarketPrice('2026-06-01', '2026-06-02')).resolves.toEqual([
      { date: '2026-06-01', priceUsd: 66000 },
      { date: '2026-06-02', priceUsd: 67234.5 },
    ]);
    expect(fetchFn).toHaveBeenCalledWith(
      'https://api.blockchain.info/charts/market-price?start=2026-06-01&timespan=2days&format=json',
    );
  });

  it('calculates a 90 day timespan for a 90 day inclusive range', async () => {
    const fetchFn = jest.fn().mockResolvedValue(createJsonResponse({ values: [] }));
    const client = new BlockchainInfoClient({
      baseUrl: 'https://api.blockchain.info/charts',
      fetchFn: fetchFn as never,
    });

    await client.fetchMarketPrice('2026-03-13', '2026-06-10');

    expect(fetchFn).toHaveBeenCalledWith(
      'https://api.blockchain.info/charts/market-price?start=2026-03-13&timespan=90days&format=json',
    );
  });

  it('filters returned values to the exact requested date range', async () => {
    const fetchFn = jest.fn().mockResolvedValue(
      createJsonResponse({
        values: [
          { x: 1780185600, y: 65000 },
          { x: 1780272000, y: 66000 },
          { x: 1780358400, y: 67000 },
          { x: 1780444800, y: 68000 },
        ],
      }),
    );
    const client = new BlockchainInfoClient({ fetchFn: fetchFn as never });

    await expect(client.fetchMarketPrice('2026-06-01', '2026-06-02')).resolves.toEqual([
      { date: '2026-06-01', priceUsd: 66000 },
      { date: '2026-06-02', priceUsd: 67000 },
    ]);
  });

  it('logs request details and throws when Blockchain.info responds with an error', async () => {
    const logger = { error: jest.fn() };
    const fetchFn = jest.fn().mockResolvedValue({
      ok: false,
      status: 503,
      json: jest.fn(),
    });
    const client = new BlockchainInfoClient({
      fetchFn: fetchFn as never,
      logger,
      retryAttempts: 0,
    });

    await expect(client.fetchMarketPrice('2026-06-01', '2026-06-10')).rejects.toMatchObject({
      statusCode: 503,
    } satisfies Partial<BlockchainInfoClientError>);
    expect(logger.error).toHaveBeenCalledWith(
      'Blockchain.info request failed',
      expect.objectContaining({
        timestamp: expect.any(String),
        request: expect.objectContaining({
          startDate: '2026-06-01',
          endDate: '2026-06-10',
        }),
        error: 'Blockchain.info request failed with status 503',
      }),
    );
  });

  it('rejects invalid date ranges before making a request', async () => {
    const fetchFn = jest.fn();
    const logger = { error: jest.fn() };
    const client = new BlockchainInfoClient({
      fetchFn: fetchFn as never,
      logger,
      retryAttempts: 0,
    });

    await expect(client.fetchMarketPrice('2026-06-10', '2026-06-01')).rejects.toThrow(
      'End date must be on or after start date',
    );
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('throws when response does not include chart values', async () => {
    const client = new BlockchainInfoClient({
      fetchFn: jest.fn().mockResolvedValue(createJsonResponse({})) as never,
      logger: { error: jest.fn() },
      retryAttempts: 0,
    });

    await expect(client.fetchMarketPrice('2026-06-01', '2026-06-10')).rejects.toThrow(
      'Blockchain.info response is missing chart values',
    );
  });

  it('fetches and normalizes hash rate values for a date range', async () => {
    const fetchFn = jest.fn().mockResolvedValue(
      createJsonResponse({ values: [{ x: 1780272000, y: 931513615.5806334 }] }),
    );
    const client = new BlockchainInfoClient({
      baseUrl: 'https://api.blockchain.info/charts',
      fetchFn: fetchFn as never,
    });

    await expect(client.fetchHashRate('2026-06-01', '2026-06-01')).resolves.toEqual([
      { date: '2026-06-01', value: 931513615.5806334 },
    ]);
    expect(fetchFn).toHaveBeenCalledWith(
      'https://api.blockchain.info/charts/hash-rate?start=2026-06-01&timespan=1days&format=json',
    );
  });

  it('fetches and normalizes mining difficulty values for a date range', async () => {
    const fetchFn = jest.fn().mockResolvedValue(
      createJsonResponse({ values: [{ x: 1780272000, y: 138955357012247.48 }] }),
    );
    const client = new BlockchainInfoClient({
      baseUrl: 'https://api.blockchain.info/charts',
      fetchFn: fetchFn as never,
    });

    await expect(client.fetchDifficulty('2026-06-01', '2026-06-01')).resolves.toEqual([
      { date: '2026-06-01', value: 138955357012247.48 },
    ]);
    expect(fetchFn).toHaveBeenCalledWith(
      'https://api.blockchain.info/charts/difficulty?start=2026-06-01&timespan=1days&format=json',
    );
  });

  it('retries service failures with exponential backoff before succeeding', async () => {
    const sleep = jest.fn().mockResolvedValue(undefined);
    const fetchFn = jest
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 503, json: jest.fn() })
      .mockResolvedValueOnce({ ok: false, status: 503, json: jest.fn() })
      .mockResolvedValue(
        createJsonResponse({
          values: [{ x: 1780272000, y: 66000 }],
        }),
      );
    const client = new BlockchainInfoClient({
      fetchFn: fetchFn as never,
      logger: { error: jest.fn() },
      sleep,
    });

    await expect(client.fetchMarketPrice('2026-06-01', '2026-06-01')).resolves.toEqual([
      { date: '2026-06-01', priceUsd: 66000 },
    ]);

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
