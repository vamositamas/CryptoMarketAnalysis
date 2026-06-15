import { CoinGeckoClient, CoinGeckoClientError } from './coingecko.client';

describe('CoinGeckoClient', () => {
  it('fetches and normalizes Bitcoin market data for a date', async () => {
    const fetchFn = jest.fn().mockResolvedValue(
      createJsonResponse({
        market_data: {
          current_price: { usd: 67234.5 },
          market_cap: { usd: 1320000000000 },
          circulating_supply: 19700000,
        },
      }),
    );
    const client = new CoinGeckoClient({
      baseUrl: 'https://api.coingecko.com/api/v3',
      fetchFn: fetchFn as never,
    });

    await expect(client.fetchBitcoinMarketData('2026-06-10')).resolves.toEqual({
      date: '2026-06-10',
      priceUsd: 67234.5,
      marketCapUsd: 1320000000000,
      circulatingSupply: 19700000,
    });
    expect(fetchFn).toHaveBeenCalledWith(
      'https://api.coingecko.com/api/v3/coins/bitcoin/history?date=10-06-2026',
    );
  });

  it('returns only the USD price when fetching Bitcoin price', async () => {
    const fetchFn = jest.fn().mockResolvedValue(
      createJsonResponse({
        market_data: {
          current_price: { usd: 42000 },
        },
      }),
    );
    const client = new CoinGeckoClient({ fetchFn: fetchFn as never });

    await expect(client.fetchBitcoinPrice('2026-06-10')).resolves.toBe(42000);
  });

  it('queues requests through the rate limiter', async () => {
    const queue = {
      add: jest.fn((task: () => Promise<unknown>) => task()),
    };
    const fetchFn = jest.fn().mockResolvedValue(
      createJsonResponse({
        market_data: {
          current_price: { usd: 100 },
        },
      }),
    );
    const client = new CoinGeckoClient({
      fetchFn: fetchFn as never,
      queue: queue as never,
    });

    await client.fetchBitcoinMarketData('2026-06-10');

    expect(queue.add).toHaveBeenCalledTimes(1);
  });

  it('logs request details and throws when CoinGecko responds with an error', async () => {
    const logger = { error: jest.fn() };
    const fetchFn = jest.fn().mockResolvedValue({
      ok: false,
      status: 429,
      json: jest.fn(),
    });
    const client = new CoinGeckoClient({
      fetchFn: fetchFn as never,
      logger,
      retryAttempts: 0,
    });

    await expect(client.fetchBitcoinMarketData('2026-06-10')).rejects.toMatchObject({
      statusCode: 429,
    } satisfies Partial<CoinGeckoClientError>);
    expect(logger.error).toHaveBeenCalledWith(
      'CoinGecko request failed',
      expect.objectContaining({
        timestamp: expect.any(String),
        request: expect.objectContaining({
          date: '2026-06-10',
        }),
        error: 'CoinGecko request failed with status 429',
      }),
    );
  });

  it('rejects dates that are not ISO calendar dates', async () => {
    const client = new CoinGeckoClient({
      fetchFn: jest.fn() as never,
      logger: { error: jest.fn() },
      retryAttempts: 0,
    });

    await expect(client.fetchBitcoinMarketData('10-06-2026')).rejects.toThrow(
      'Date must use YYYY-MM-DD format',
    );
  });

  it('throws when response does not include a USD price', async () => {
    const client = new CoinGeckoClient({
      fetchFn: jest.fn().mockResolvedValue(createJsonResponse({ market_data: {} })) as never,
      logger: { error: jest.fn() },
      retryAttempts: 0,
    });

    await expect(client.fetchBitcoinMarketData('2026-06-10')).rejects.toThrow(
      'CoinGecko response is missing USD price',
    );
  });

  it('retries 429 responses with exponential backoff before succeeding', async () => {
    const sleep = jest.fn().mockResolvedValue(undefined);
    const fetchFn = jest
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 429, json: jest.fn() })
      .mockResolvedValueOnce({ ok: false, status: 429, json: jest.fn() })
      .mockResolvedValue(
        createJsonResponse({
          market_data: {
            current_price: { usd: 67234.5 },
          },
        }),
      );
    const client = new CoinGeckoClient({
      fetchFn: fetchFn as never,
      logger: { error: jest.fn() },
      sleep,
    });

    await expect(client.fetchBitcoinMarketData('2026-06-10')).resolves.toMatchObject({
      priceUsd: 67234.5,
    });

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
