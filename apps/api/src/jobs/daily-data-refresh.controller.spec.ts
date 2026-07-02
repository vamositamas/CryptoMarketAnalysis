import { createHash } from 'crypto';
import jwt from 'jsonwebtoken';
import type { Request, Response } from 'express';
import {
  DailyDataRefreshService,
  createDailyDataRefreshRouter,
  createQStashSignatureMiddleware,
} from './daily-data-refresh.controller';

type Handler = (req: Request, res: Response, next: jest.Mock) => Promise<void> | void;

describe('daily data refresh job', () => {
  it('returns 401 when QStash signature is missing', () => {
    const middleware = createQStashSignatureMiddleware({
      currentSigningKey: 'current',
      nextSigningKey: 'next',
      expectedUrl: 'https://example.com/api/jobs/daily-data-refresh',
    });
    const response = createResponse();
    const next = jest.fn();

    middleware(createRequest(), response, next);

    expect(response.statusCode).toBe(401);
    expect(response.body).toEqual({ error: 'Unauthorized' });
    expect(next).not.toHaveBeenCalled();
  });

  it('accepts valid QStash signatures from the legacy X-Qstash-Signature header', () => {
    const rawBody = JSON.stringify({ scheduled: true });
    const signature = createQStashSignature({
      body: rawBody,
      signingKey: 'current',
      url: 'https://example.com/api/jobs/daily-data-refresh',
    });
    const middleware = createQStashSignatureMiddleware({
      currentSigningKey: 'current',
      nextSigningKey: 'next',
      expectedUrl: 'https://example.com/api/jobs/daily-data-refresh',
    });
    const response = createResponse();
    const next = jest.fn();

    middleware(
      createRequest({
        rawBody,
        headers: {
          'x-qstash-signature': signature,
        },
      }),
      response,
      next,
    );

    expect(next).toHaveBeenCalledTimes(1);
  });

  it('fetches today from CoinGecko live price and upserts one data point', async () => {
    const database = {
      query: jest
        .fn()
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce({ rows: createPriceHistoryRows('2026-06-10') })
        .mockResolvedValueOnce(undefined),
    };
    const coinGeckoClient = {
      fetchCurrentBitcoinMarketData: jest.fn().mockResolvedValue({
        date: '2026-06-10',
        priceUsd: 67234.5,
        marketCapUsd: 1_320_000_000_000,
        circulatingSupply: 19_700_000,
      }),
      fetchBitcoinMarketData: jest.fn(),
    };
    const blockchainInfoClient = createBlockchainInfoClientStub();
    const service = new DailyDataRefreshService({
      coinGeckoClient,
      blockchainInfoClient,
      fearGreedClient: createFearGreedClientStub(),
      bitcoinDataClient: createBitcoinDataClientStub(),
      coinMetricsClient: createCoinMetricsClientStub(),
      binanceFuturesClient: createBinanceFuturesClientStub(),
      bybitClient: createBybitClientStub(),
      googleTrendsClient: createGoogleTrendsClientStub(),
      deribitClient: createDeribitClientStub(),
      database,
      emailService: { sendDailyDataRefreshFailureAlert: jest.fn() },
      alertEvaluationService: createAlertEvaluationServiceStub(),
      logger: createLogger(),
      now: () => new Date('2026-06-10T12:00:00.000Z'),
    });

    await expect(service.run()).resolves.toMatchObject({
      success: true,
      date: '2026-06-10',
      dataPoints: 1,
      source: 'coingecko',
    });
    expect(coinGeckoClient.fetchCurrentBitcoinMarketData).toHaveBeenCalledWith('2026-06-10');
    expect(coinGeckoClient.fetchBitcoinMarketData).not.toHaveBeenCalled();
    expect(blockchainInfoClient.fetchMarketPrice).not.toHaveBeenCalled();
    expect(database.query).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining('INSERT INTO bitcoin_price_daily'),
      ['2026-06-10', 67234.5, 1_320_000_000_000, 19_700_000],
    );
    expect(database.query).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('FROM bitcoin_price_daily'),
      ['2026-06-10'],
    );
    expect(database.query).toHaveBeenNthCalledWith(
      3,
      expect.stringContaining('INSERT INTO bitcoin_metrics_daily'),
      expect.arrayContaining([
        '2026-06-10',
        'ma_111_day',
        '2026-06-10',
        'ma_350_day',
        '2026-06-10',
        'stock_to_flow_ratio',
        '2026-06-10',
        'rainbow_band',
      ]),
    );
  });

  it('uses Blockchain.info fallback when all CoinGecko endpoints fail', async () => {
    const database = {
      query: jest
        .fn()
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce({ rows: createPriceHistoryRows('2026-06-10') })
        .mockResolvedValueOnce(undefined),
    };
    const blockchainInfoClient = createBlockchainInfoClientStub({
      fetchMarketPrice: jest.fn().mockResolvedValue([
        {
          date: '2026-06-10',
          priceUsd: 67000,
        },
      ]),
    });
    const service = new DailyDataRefreshService({
      coinGeckoClient: {
        fetchCurrentBitcoinMarketData: jest.fn().mockRejectedValue(new Error('rate limited')),
        fetchBitcoinMarketData: jest.fn().mockRejectedValue(new Error('rate limited')),
      },
      blockchainInfoClient,
      fearGreedClient: createFearGreedClientStub(),
      bitcoinDataClient: createBitcoinDataClientStub(),
      coinMetricsClient: createCoinMetricsClientStub(),
      binanceFuturesClient: createBinanceFuturesClientStub(),
      bybitClient: createBybitClientStub(),
      googleTrendsClient: createGoogleTrendsClientStub(),
      deribitClient: createDeribitClientStub(),
      database,
      emailService: { sendDailyDataRefreshFailureAlert: jest.fn() },
      alertEvaluationService: createAlertEvaluationServiceStub(),
      logger: createLogger(),
      now: () => new Date('2026-06-10T12:00:00.000Z'),
    });

    await expect(service.run()).resolves.toMatchObject({
      date: '2026-06-10',
      source: 'blockchain-info',
    });
    expect(blockchainInfoClient.fetchMarketPrice).toHaveBeenCalledWith(
      '2026-06-10',
      '2026-06-10',
    );
    expect(database.query).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining('INSERT INTO bitcoin_price_daily'),
      ['2026-06-10', 67000, null, null],
    );
    expect(database.query).toHaveBeenNthCalledWith(
      3,
      expect.stringContaining('INSERT INTO bitcoin_metrics_daily'),
      expect.any(Array),
    );
  });

  it('fetches and upserts Fear & Greed Index, MVRV Z-Score, Realized Price, Hash Rate, and Mining Difficulty alongside the price-derived metrics', async () => {
    const database = {
      query: jest
        .fn()
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce({ rows: createPriceHistoryRows('2026-06-10') })
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce(undefined),
    };
    const fearGreedClient = {
      fetchLatest: jest.fn().mockResolvedValue({ date: '2026-06-09', value: 42 }),
    };
    const bitcoinDataClient = {
      fetchMvrvZScore: jest.fn().mockResolvedValue({ date: '2026-06-09', value: 1.23 }),
      fetchRealizedPrice: jest.fn().mockResolvedValue({ date: '2026-06-09', value: 53020.27 }),
      fetchVddMultiple: jest.fn().mockRejectedValue(new Error('not available in test')),
      fetchCvdd: jest.fn().mockRejectedValue(new Error('not available in test')),
      fetchBalancedPrice: jest.fn().mockRejectedValue(new Error('not available in test')),
      fetchTerminalPrice: jest.fn().mockRejectedValue(new Error('not available in test')),
      fetchLthSopr: jest.fn().mockRejectedValue(new Error('not available in test')),
      fetchSthSopr: jest.fn().mockRejectedValue(new Error('not available in test')),
    };
    const blockchainInfoClient = createBlockchainInfoClientStub();
    const service = new DailyDataRefreshService({
      coinGeckoClient: {
        fetchCurrentBitcoinMarketData: jest.fn().mockResolvedValue({ date: '2026-06-10', priceUsd: 1 }),
        fetchBitcoinMarketData: jest.fn(),
      },
      blockchainInfoClient,
      fearGreedClient,
      bitcoinDataClient,
      coinMetricsClient: {
        fetchExchangeReserveLatest: jest.fn().mockRejectedValue(new Error('not available in test')),
        fetchExchangeNetflowLatest: jest.fn().mockRejectedValue(new Error('not available in test')),
        fetchActiveAddressesLatest: jest.fn().mockRejectedValue(new Error('not available in test')),
      },
      binanceFuturesClient: {
        fetchFundingRateLatest: jest.fn().mockRejectedValue(new Error('not available in test')),
      },
      bybitClient: {
        fetchOpenInterestLatest: jest.fn().mockRejectedValue(new Error('not available in test')),
      },
      googleTrendsClient: createGoogleTrendsClientStub(),
      deribitClient: {
        fetchBtcDvolLatest: jest.fn().mockRejectedValue(new Error('not available in test')),
      },
      database,
      emailService: { sendDailyDataRefreshFailureAlert: jest.fn() },
      alertEvaluationService: createAlertEvaluationServiceStub(),
      logger: createLogger(),
      now: () => new Date('2026-06-10T12:00:00.000Z'),
    });

    await service.run();

    expect(fearGreedClient.fetchLatest).toHaveBeenCalledTimes(1);
    expect(bitcoinDataClient.fetchMvrvZScore).toHaveBeenCalledTimes(1);
    expect(bitcoinDataClient.fetchRealizedPrice).toHaveBeenCalledTimes(1);
    expect(blockchainInfoClient.fetchHashRate).toHaveBeenCalledWith('2026-06-10', '2026-06-10');
    expect(blockchainInfoClient.fetchDifficulty).toHaveBeenCalledWith('2026-06-10', '2026-06-10');
    expect(database.query).toHaveBeenNthCalledWith(
      4,
      expect.stringContaining('INSERT INTO bitcoin_metrics_daily'),
      [
        '2026-06-09',
        'fear_greed_index',
        42,
        '2026-06-09',
        'mvrv_zscore',
        1.23,
        '2026-06-09',
        'realized_price',
        53020.27,
        '2026-06-10',
        'hash_rate',
        931513615.5806334,
        '2026-06-10',
        'mining_difficulty',
        138955357012247.48,
      ],
    );
  });

  it('skips a metric without failing the run when an external metric source errors', async () => {
    const database = {
      query: jest
        .fn()
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce({ rows: createPriceHistoryRows('2026-06-10') })
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce(undefined),
    };
    const bitcoinDataClient = createBitcoinDataClientStub();
    const logger = createLogger();
    const service = new DailyDataRefreshService({
      coinGeckoClient: {
        fetchCurrentBitcoinMarketData: jest.fn().mockResolvedValue({ date: '2026-06-10', priceUsd: 1 }),
        fetchBitcoinMarketData: jest.fn(),
      },
      blockchainInfoClient: createBlockchainInfoClientStub(),
      fearGreedClient: { fetchLatest: jest.fn().mockRejectedValue(new Error('service down')) },
      bitcoinDataClient,
      coinMetricsClient: createCoinMetricsClientStub(),
      binanceFuturesClient: createBinanceFuturesClientStub(),
      bybitClient: createBybitClientStub(),
      googleTrendsClient: createGoogleTrendsClientStub(),
      deribitClient: createDeribitClientStub(),
      database,
      emailService: { sendDailyDataRefreshFailureAlert: jest.fn() },
      alertEvaluationService: createAlertEvaluationServiceStub(),
      logger,
      now: () => new Date('2026-06-10T12:00:00.000Z'),
    });

    await expect(service.run()).resolves.toMatchObject({ success: true });

    expect(logger.warn).toHaveBeenCalledWith(
      'Failed to fetch fear_greed_index; skipping for this run',
      expect.objectContaining({ error: 'service down' }),
    );
    expect(database.query).toHaveBeenNthCalledWith(
      4,
      expect.stringContaining('INSERT INTO bitcoin_metrics_daily'),
      expect.arrayContaining(['2026-06-09', 'mvrv_zscore', 1.23]),
    );

  });

  it('sends an administrator alert on the final QStash retry failure', async () => {
    const emailService = { sendDailyDataRefreshFailureAlert: jest.fn().mockResolvedValue(undefined) };
    const service = new DailyDataRefreshService({
      database: { query: jest.fn() },
      emailService,
      logger: createLogger(),
      now: () => new Date('2026-06-10T12:00:00.000Z'),
    });

    await service.handleFailure(new Error('database offline'), 2);

    expect(emailService.sendDailyDataRefreshFailureAlert).toHaveBeenCalledWith({
      date: '2026-06-10',
      attempts: 3,
      error: 'database offline',
    });
  });

  it('wires POST /daily-data-refresh through the router', async () => {
    const rawBody = '';
    const signature = createQStashSignature({
      body: rawBody,
      signingKey: 'current',
      url: 'https://example.com/api/jobs/daily-data-refresh',
    });
    const router = createDailyDataRefreshRouter({
      qstash: {
        currentSigningKey: 'current',
        nextSigningKey: 'next',
        expectedUrl: 'https://example.com/api/jobs/daily-data-refresh',
      },
      coinGeckoClient: {
        fetchCurrentBitcoinMarketData: jest.fn().mockResolvedValue({
          date: '2026-06-10',
          priceUsd: 1,
        }),
        fetchBitcoinMarketData: jest.fn(),
      },
      blockchainInfoClient: createBlockchainInfoClientStub(),
      fearGreedClient: createFearGreedClientStub(),
      bitcoinDataClient: createBitcoinDataClientStub(),
      coinMetricsClient: createCoinMetricsClientStub(),
      binanceFuturesClient: createBinanceFuturesClientStub(),
      bybitClient: createBybitClientStub(),
      googleTrendsClient: createGoogleTrendsClientStub(),
      deribitClient: createDeribitClientStub(),
      database: {
        query: jest
          .fn()
          .mockResolvedValueOnce(undefined)
          .mockResolvedValueOnce({ rows: createPriceHistoryRows('2026-06-10') })
          .mockResolvedValueOnce(undefined),
      },
      emailService: { sendDailyDataRefreshFailureAlert: jest.fn() },
      alertEvaluationService: createAlertEvaluationServiceStub(),
      logger: createLogger(),
      now: () => new Date('2026-06-10T12:00:00.000Z'),
    });
    const handlers = getHandlers(router, '/daily-data-refresh', 'post');
    const response = createResponse();

    await runHandlers(
      handlers,
      createRequest({
        rawBody,
        headers: {
          'upstash-signature': signature,
        },
      }),
      response,
    );

    expect(response.statusCode).toBe(200);
    expect(response.body).toMatchObject({
      success: true,
      date: '2026-06-10',
      dataPoints: 1,
    });
  });
});

function createQStashSignature(input: {
  body: string;
  signingKey: string;
  url: string;
}): string {
  return jwt.sign(
    {
      iss: 'Upstash',
      sub: input.url,
      body: createHash('sha256').update(input.body).digest('base64url'),
    },
    input.signingKey,
  );
}

function createRequest(input: { rawBody?: string; headers?: Record<string, string> } = {}): Request {
  const headerMap = new Map(
    Object.entries(input.headers ?? {}).map(([key, value]) => [key.toLowerCase(), value]),
  );

  return {
    rawBody: input.rawBody,
    protocol: 'https',
    originalUrl: '/api/jobs/daily-data-refresh',
    headers: Object.fromEntries(headerMap),
    get(name: string) {
      return headerMap.get(name.toLowerCase());
    },
  } as unknown as Request;
}

function createResponse() {
  const response = {
    statusCode: 200,
    body: undefined as unknown,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(body: unknown) {
      this.body = body;
      return this;
    },
  };

  return response as Response & typeof response;
}

function createFearGreedClientStub() {
  return { fetchLatest: jest.fn().mockResolvedValue({ date: '2026-06-09', value: 42 }) };
}

function createBitcoinDataClientStub() {
  return {
    fetchMvrvZScore: jest.fn().mockResolvedValue({ date: '2026-06-09', value: 1.23 }),
    fetchRealizedPrice: jest.fn().mockResolvedValue({ date: '2026-06-09', value: 53020.27 }),
    fetchVddMultiple: jest.fn().mockRejectedValue(new Error('not available in test')),
    fetchCvdd: jest.fn().mockRejectedValue(new Error('not available in test')),
    fetchBalancedPrice: jest.fn().mockRejectedValue(new Error('not available in test')),
    fetchTerminalPrice: jest.fn().mockRejectedValue(new Error('not available in test')),
    fetchLthSopr: jest.fn().mockRejectedValue(new Error('not available in test')),
    fetchSthSopr: jest.fn().mockRejectedValue(new Error('not available in test')),
  };
}

function createGoogleTrendsClientStub() {
  return {
    fetchBitcoinSearchInterestLatest: jest.fn().mockRejectedValue(new Error('not available in test')),
  };
}

function createCoinMetricsClientStub() {
  return {
    fetchExchangeReserveLatest: jest.fn().mockResolvedValue({ date: '2026-06-09', value: 2_600_000 }),
    fetchExchangeNetflowLatest: jest.fn().mockResolvedValue({ date: '2026-06-09', value: -350 }),
    fetchActiveAddressesLatest: jest.fn().mockResolvedValue({ date: '2026-06-09', value: 950_000 }),
  };
}

function createDeribitClientStub() {
  return {
    fetchBtcDvolLatest: jest.fn().mockResolvedValue({ date: '2026-06-09', value: 55.2 }),
  };
}

function createBinanceFuturesClientStub() {
  return {
    fetchFundingRateLatest: jest.fn().mockResolvedValue({ date: '2026-06-09', value: 0.0001 }),
  };
}

function createBybitClientStub() {
  return {
    fetchOpenInterestLatest: jest.fn().mockResolvedValue({ date: '2026-06-09', value: 6_200_000_000 }),
  };
}

function createBlockchainInfoClientStub(overrides: { fetchMarketPrice?: jest.Mock } = {}) {
  return {
    fetchMarketPrice: overrides.fetchMarketPrice ?? jest.fn(),
    fetchHashRate: jest
      .fn()
      .mockResolvedValue([{ date: '2026-06-10', value: 931513615.5806334 }]),
    fetchDifficulty: jest
      .fn()
      .mockResolvedValue([{ date: '2026-06-10', value: 138955357012247.48 }]),
    fetchCoinDaysDestroyed: jest.fn().mockRejectedValue(new Error('not available in test')),
    fetchTransactionFees: jest.fn().mockRejectedValue(new Error('not available in test')),
    fetchTransactionVolumeUsd: jest.fn().mockRejectedValue(new Error('not available in test')),
    fetchMinersRevenueUsd: jest.fn().mockRejectedValue(new Error('not available in test')),
  };
}

function createAlertEvaluationServiceStub() {
  return {
    evaluateAlerts: jest.fn().mockResolvedValue({ evaluated: 0, triggered: 0, skipped: 0 }),
  };
}

function createLogger(): Pick<Console, 'error' | 'log' | 'warn'> {
  return {
    error: jest.fn(),
    log: jest.fn(),
    warn: jest.fn(),
  };
}

function createPriceHistoryRows(endDate: string): Array<{
  date: string;
  price_usd: number;
  circulating_supply: number;
}> {
  const end = new Date(`${endDate}T00:00:00.000Z`);

  return Array.from({ length: 350 }, (_, index) => {
    const date = new Date(end);
    date.setUTCDate(end.getUTCDate() - 349 + index);

    return {
      date: date.toISOString().slice(0, 10),
      price_usd: index + 1,
      circulating_supply: 19_700_000,
    };
  });
}

function getHandlers(
  router: ReturnType<typeof createDailyDataRefreshRouter>,
  path: string,
  method: string,
): Handler[] {
  const layer = router.stack.find(
    (entry) =>
      entry.route?.path === path &&
      ((entry.route as unknown as { methods: Record<string, boolean> }).methods[method]),
  );

  if (!layer?.route?.stack) {
    throw new Error(`${path} route not found`);
  }

  return layer.route.stack.map((entry) => entry.handle as Handler);
}

async function runHandlers(handlers: Handler[], req: Request, res: Response): Promise<void> {
  for (const handler of handlers) {
    let shouldContinue = false;
    await handler(req, res, jest.fn(() => (shouldContinue = true)));

    if (!shouldContinue) {
      return;
    }
  }
}
