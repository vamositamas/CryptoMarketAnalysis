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

  it('fetches yesterday from CoinGecko and upserts one data point', async () => {
    const database = {
      query: jest
        .fn()
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce({ rows: createPriceHistoryRows('2026-06-09') })
        .mockResolvedValueOnce(undefined),
    };
    const coinGeckoClient = {
      fetchBitcoinMarketData: jest.fn().mockResolvedValue({
        date: '2026-06-09',
        priceUsd: 67234.5,
        marketCapUsd: 1_320_000_000_000,
        circulatingSupply: 19_700_000,
      }),
    };
    const blockchainInfoClient = { fetchMarketPrice: jest.fn() };
    const service = new DailyDataRefreshService({
      coinGeckoClient,
      blockchainInfoClient,
      fearGreedClient: createFearGreedClientStub(),
      mvrvZScoreClient: createMvrvZScoreClientStub(),
      database,
      emailService: { sendDailyDataRefreshFailureAlert: jest.fn() },
      logger: createLogger(),
      now: () => new Date('2026-06-10T12:00:00.000Z'),
    });

    await expect(service.run()).resolves.toMatchObject({
      success: true,
      date: '2026-06-09',
      dataPoints: 1,
      source: 'coingecko',
    });
    expect(coinGeckoClient.fetchBitcoinMarketData).toHaveBeenCalledWith('2026-06-09');
    expect(blockchainInfoClient.fetchMarketPrice).not.toHaveBeenCalled();
    expect(database.query).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining('INSERT INTO bitcoin_price_daily'),
      ['2026-06-09', 67234.5, 1_320_000_000_000, 19_700_000],
    );
    expect(database.query).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('FROM bitcoin_price_daily'),
      ['2026-06-09'],
    );
    expect(database.query).toHaveBeenNthCalledWith(
      3,
      expect.stringContaining('INSERT INTO bitcoin_metrics_daily'),
      expect.arrayContaining([
        '2026-06-09',
        'ma_111_day',
        '2026-06-09',
        'ma_350_day',
        '2026-06-09',
        'stock_to_flow_ratio',
        '2026-06-09',
        'rainbow_band',
      ]),
    );
  });

  it('uses Blockchain.info fallback when CoinGecko fails', async () => {
    const database = {
      query: jest
        .fn()
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce({ rows: createPriceHistoryRows('2026-06-09') })
        .mockResolvedValueOnce(undefined),
    };
    const blockchainInfoClient = {
      fetchMarketPrice: jest.fn().mockResolvedValue([
        {
          date: '2026-06-09',
          priceUsd: 67000,
        },
      ]),
    };
    const service = new DailyDataRefreshService({
      coinGeckoClient: {
        fetchBitcoinMarketData: jest.fn().mockRejectedValue(new Error('rate limited')),
      },
      blockchainInfoClient,
      fearGreedClient: createFearGreedClientStub(),
      mvrvZScoreClient: createMvrvZScoreClientStub(),
      database,
      emailService: { sendDailyDataRefreshFailureAlert: jest.fn() },
      logger: createLogger(),
      now: () => new Date('2026-06-10T12:00:00.000Z'),
    });

    await expect(service.run()).resolves.toMatchObject({
      date: '2026-06-09',
      source: 'blockchain-info',
    });
    expect(blockchainInfoClient.fetchMarketPrice).toHaveBeenCalledWith(
      '2026-06-09',
      '2026-06-09',
    );
    expect(database.query).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining('INSERT INTO bitcoin_price_daily'),
      ['2026-06-09', 67000, null, null],
    );
    expect(database.query).toHaveBeenNthCalledWith(
      3,
      expect.stringContaining('INSERT INTO bitcoin_metrics_daily'),
      expect.any(Array),
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
      date: '2026-06-09',
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
        fetchBitcoinMarketData: jest.fn().mockResolvedValue({
          date: '2026-06-09',
          priceUsd: 1,
        }),
      },
      blockchainInfoClient: { fetchMarketPrice: jest.fn() },
      fearGreedClient: createFearGreedClientStub(),
      mvrvZScoreClient: createMvrvZScoreClientStub(),
      database: {
        query: jest
          .fn()
          .mockResolvedValueOnce(undefined)
          .mockResolvedValueOnce({ rows: createPriceHistoryRows('2026-06-09') })
          .mockResolvedValueOnce(undefined),
      },
      emailService: { sendDailyDataRefreshFailureAlert: jest.fn() },
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
      date: '2026-06-09',
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
  const headers = new Map(
    Object.entries(input.headers ?? {}).map(([key, value]) => [key.toLowerCase(), value]),
  );

  return {
    rawBody: input.rawBody,
    protocol: 'https',
    originalUrl: '/api/jobs/daily-data-refresh',
    get(name: string) {
      return headers.get(name.toLowerCase());
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
