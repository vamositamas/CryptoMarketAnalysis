import {
  insertBitcoinPriceDaily,
  runHistoricalDataInitialization,
  splitIntoDateRanges,
} from './init-historical-data';

describe('historical data initialization job', () => {
  it('splits date ranges into 90-day chunks', () => {
    expect(splitIntoDateRanges('2026-01-01', '2026-04-05', 90)).toEqual([
      { startDate: '2026-01-01', endDate: '2026-03-31' },
      { startDate: '2026-04-01', endDate: '2026-04-05' },
    ]);
  });

  it('fetches CoinGecko data, batch inserts it, and logs progress', async () => {
    const database = { query: jest.fn().mockResolvedValue(undefined) };
    const logger = createLogger();
    const coinGeckoClient = {
      fetchBitcoinMarketData: jest.fn(async (date: string) => ({
        date,
        priceUsd: 100,
        marketCapUsd: 1_000,
        circulatingSupply: 21,
      })),
    };
    const blockchainInfoClient = {
      fetchMarketPrice: jest.fn(),
    };

    await expect(
      runHistoricalDataInitialization({
        startDate: '2026-06-01',
        endDate: '2026-06-03',
        database,
        logger,
        coinGeckoClient,
        blockchainInfoClient,
        sleep: jest.fn(),
      }),
    ).resolves.toMatchObject({
      fetchedDays: 3,
      failedRanges: [],
    });

    expect(coinGeckoClient.fetchBitcoinMarketData).toHaveBeenCalledTimes(3);
    expect(blockchainInfoClient.fetchMarketPrice).not.toHaveBeenCalled();
    expect(database.query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO bitcoin_price_daily'),
      [
        '2026-06-01',
        100,
        1_000,
        21,
        '2026-06-02',
        100,
        1_000,
        21,
        '2026-06-03',
        100,
        1_000,
        21,
      ],
    );
    expect(logger.log).toHaveBeenCalledWith('Fetched 3/3 days (100.0% complete)');
  });

  it('uses Blockchain.info fallback when CoinGecko fails for a chunk', async () => {
    const database = { query: jest.fn().mockResolvedValue(undefined) };
    const logger = createLogger();
    const coinGeckoClient = {
      fetchBitcoinMarketData: jest.fn().mockRejectedValue(new Error('rate limited')),
    };
    const blockchainInfoClient = {
      fetchMarketPrice: jest.fn().mockResolvedValue([
        { date: '2026-06-01', priceUsd: 98 },
        { date: '2026-06-02', priceUsd: 99 },
      ]),
    };

    const summary = await runHistoricalDataInitialization({
      startDate: '2026-06-01',
      endDate: '2026-06-02',
      database,
      logger,
      coinGeckoClient,
      blockchainInfoClient,
      sleep: jest.fn(),
    });

    expect(summary.fetchedDays).toBe(2);
    expect(blockchainInfoClient.fetchMarketPrice).toHaveBeenCalledWith(
      '2026-06-01',
      '2026-06-02',
    );
    expect(logger.warn).toHaveBeenCalledWith(
      'CoinGecko historical chunk fetch failed; trying Blockchain.info fallback',
      expect.objectContaining({
        startDate: '2026-06-01',
        endDate: '2026-06-02',
      }),
    );
  });

  it('retries failed chunks three times and records the failed range', async () => {
    const database = { query: jest.fn().mockResolvedValue(undefined) };
    const logger = createLogger();
    const sleep = jest.fn().mockResolvedValue(undefined);
    const coinGeckoClient = {
      fetchBitcoinMarketData: jest.fn().mockRejectedValue(new Error('primary failed')),
    };
    const blockchainInfoClient = {
      fetchMarketPrice: jest.fn().mockRejectedValue(new Error('fallback failed')),
    };

    const summary = await runHistoricalDataInitialization({
      startDate: '2026-06-01',
      endDate: '2026-06-01',
      database,
      logger,
      coinGeckoClient,
      blockchainInfoClient,
      sleep,
    });

    expect(summary).toMatchObject({
      fetchedDays: 0,
      failedRanges: [
        {
          startDate: '2026-06-01',
          endDate: '2026-06-01',
          error: 'fallback failed',
        },
      ],
    });
    expect(blockchainInfoClient.fetchMarketPrice).toHaveBeenCalledTimes(3);
    expect(sleep).toHaveBeenCalledTimes(2);
    expect(database.query).not.toHaveBeenCalled();
  });

  it('skips inserts for empty record sets', async () => {
    const database = { query: jest.fn() };

    await insertBitcoinPriceDaily(database, []);

    expect(database.query).not.toHaveBeenCalled();
  });
});

function createLogger(): Pick<Console, 'error' | 'log' | 'warn'> {
  return {
    error: jest.fn(),
    log: jest.fn(),
    warn: jest.fn(),
  };
}
