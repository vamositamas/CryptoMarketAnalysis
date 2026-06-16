import { createHash } from 'crypto';
import { Router, type NextFunction, type Request, type Response } from 'express';
import jwt, { type JwtPayload } from 'jsonwebtoken';
import {
  BlockchainInfoClient,
  CoinGeckoClient,
  FearGreedClient,
  MvrvZScoreClient,
  RetryExhaustedError,
} from '@crypto-market-analysis/calculation-engines/data-sources';
import {
  selectLatestBitcoinDailyIndicators,
  type BitcoinDailyIndicatorInput,
} from '@crypto-market-analysis/calculation-engines/indicators';
import { insertBitcoinPriceDaily } from './init-historical-data';
import { getDatabasePool } from '../config/database.config';
import { ResendEmailService, type DailyDataRefreshFailureEmailSender } from '../services/email.service';

interface DailyDataRefreshSummary {
  success: true;
  date: string;
  dataPoints: number;
  source: 'coingecko' | 'blockchain-info';
  executionTimeMs: number;
}

interface BitcoinPriceRecord {
  date: string;
  priceUsd: number;
  marketCapUsd?: number;
  circulatingSupply?: number;
}

interface QueryResult<Row> {
  rows: Row[];
}

interface BitcoinPriceHistoryRow {
  date: string | Date;
  price_usd: string | number;
  circulating_supply: string | number | null;
}

interface BitcoinMetricRecord {
  date: string;
  metricName: string;
  metricValue: number;
}

interface DailyDataRefreshOptions {
  coinGeckoClient?: Pick<CoinGeckoClient, 'fetchBitcoinMarketData'>;
  blockchainInfoClient?: Pick<BlockchainInfoClient, 'fetchMarketPrice'>;
  fearGreedClient?: Pick<FearGreedClient, 'fetchLatest'>;
  mvrvZScoreClient?: Pick<MvrvZScoreClient, 'fetchLatest'>;
  database?: Parameters<typeof insertBitcoinPriceDaily>[0];
  emailService?: DailyDataRefreshFailureEmailSender;
  logger?: Pick<Console, 'error' | 'log' | 'warn'>;
  now?: () => Date;
}

interface QStashVerifierOptions {
  currentSigningKey?: string;
  nextSigningKey?: string;
  expectedUrl?: string;
  logger?: Pick<Console, 'warn'>;
}

type RequestWithRawBody = Request & {
  rawBody?: string;
};

const QSTASH_SIGNATURE_HEADERS = ['Upstash-Signature', 'X-Qstash-Signature'];
const FINAL_QSTASH_ATTEMPT_INDEX = 2;

export function createDailyDataRefreshRouter(
  options: DailyDataRefreshOptions & { qstash?: QStashVerifierOptions } = {},
): Router {
  const router = Router();
  const service = new DailyDataRefreshService(options);

  router.post(
    '/daily-data-refresh',
    createQStashSignatureMiddleware(options.qstash),
    async (req, res, next) => {
      try {
        const summary = await service.run();
        res.status(200).json(summary);
      } catch (error) {
        await service.handleFailure(error, getQStashRetryCount(req));
        next(error);
      }
    },
  );

  return router;
}

export class DailyDataRefreshService {
  private readonly coinGeckoClient: Pick<CoinGeckoClient, 'fetchBitcoinMarketData'>;
  private readonly blockchainInfoClient: Pick<BlockchainInfoClient, 'fetchMarketPrice'>;
  private readonly fearGreedClient: Pick<FearGreedClient, 'fetchLatest'>;
  private readonly mvrvZScoreClient: Pick<MvrvZScoreClient, 'fetchLatest'>;
  private readonly database: Parameters<typeof insertBitcoinPriceDaily>[0] | undefined;
  private readonly emailService: DailyDataRefreshFailureEmailSender;
  private readonly logger: Pick<Console, 'error' | 'log' | 'warn'>;
  private readonly now: () => Date;

  constructor(options: DailyDataRefreshOptions = {}) {
    this.coinGeckoClient = options.coinGeckoClient ?? new CoinGeckoClient();
    this.blockchainInfoClient = options.blockchainInfoClient ?? new BlockchainInfoClient();
    this.fearGreedClient = options.fearGreedClient ?? new FearGreedClient();
    this.mvrvZScoreClient = options.mvrvZScoreClient ?? new MvrvZScoreClient();
    this.database = options.database ?? getDatabasePool();
    this.emailService = options.emailService ?? new ResendEmailService();
    this.logger = options.logger ?? console;
    this.now = options.now ?? (() => new Date());
  }

  async run(): Promise<DailyDataRefreshSummary> {
    const startedAt = Date.now();
    const date = getYesterdayUtcIsoDate(this.now());
    const database = this.database;

    if (!database) {
      throw new Error('SUPABASE_DATABASE_URL is required to refresh daily Bitcoin data');
    }

    const { record, source } = await this.fetchDailyPriceRecord(date);
    await insertBitcoinPriceDaily(database, [record]);
    const metrics = await calculateAndInsertDailyMetrics(database, date);
    const externalMetrics = await this.fetchAndInsertExternalMetrics(database);
    await updateLastRefreshStatus(database, this.now(), 'success');
    this.logger.log('Daily data refresh metrics calculated', {
      date,
      metrics: [...metrics, ...externalMetrics].map((metric) => metric.metricName),
    });
    this.logger.log('Alert evaluation deferred to Epic 7.', { date });

    const summary = {
      success: true,
      date,
      dataPoints: 1,
      source,
      executionTimeMs: Date.now() - startedAt,
    } satisfies DailyDataRefreshSummary;
    this.logger.log('Daily data refresh completed', summary);

    return summary;
  }

  async handleFailure(error: unknown, retryCount: number | undefined): Promise<void> {
    this.logger.error('Daily data refresh failed', {
      retryCount,
      error: error instanceof Error ? error.stack ?? error.message : String(error),
    });

    if (retryCount !== undefined && retryCount >= FINAL_QSTASH_ATTEMPT_INDEX) {
      await this.emailService.sendDailyDataRefreshFailureAlert({
        date: getYesterdayUtcIsoDate(this.now()),
        attempts: retryCount + 1,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private async fetchDailyPriceRecord(
    date: string,
  ): Promise<{ record: BitcoinPriceRecord; source: 'coingecko' | 'blockchain-info' }> {
    try {
      return {
        record: await this.coinGeckoClient.fetchBitcoinMarketData(date),
        source: 'coingecko',
      };
    } catch (coinGeckoError) {
      this.logger.warn('CoinGecko daily refresh failed; trying Blockchain.info fallback', {
        date,
        error: coinGeckoError instanceof Error ? coinGeckoError.message : String(coinGeckoError),
      });

      try {
        const fallbackRecords = await this.blockchainInfoClient.fetchMarketPrice(date, date);
        const fallbackRecord = fallbackRecords.find((record) => record.date === date);

        if (!fallbackRecord) {
          throw new Error(`Blockchain.info fallback did not return a price for ${date}`);
        }

        return {
          record: fallbackRecord,
          source: 'blockchain-info',
        };
      } catch (blockchainInfoError) {
        const message = `Failed to fetch data for ${date} after trying CoinGecko (${formatAttemptCount(
          coinGeckoError,
        )}) and Blockchain.info (${formatAttemptCount(blockchainInfoError)})`;
        this.logger.error(message, {
          date,
          coinGeckoError:
            coinGeckoError instanceof Error ? coinGeckoError.message : String(coinGeckoError),
          blockchainInfoError:
            blockchainInfoError instanceof Error
              ? blockchainInfoError.message
              : String(blockchainInfoError),
        });
        throw new Error(message);
      }
    }
  }

  private async fetchAndInsertExternalMetrics(
    database: Parameters<typeof insertBitcoinPriceDaily>[0],
  ): Promise<BitcoinMetricRecord[]> {
    const records = [
      ...(await this.fetchExternalMetric('fear_greed_index', () =>
        this.fearGreedClient.fetchLatest(),
      )),
      ...(await this.fetchExternalMetric('mvrv_zscore', () => this.mvrvZScoreClient.fetchLatest())),
    ];

    if (records.length > 0) {
      await insertBitcoinMetricsDaily(database, records);
    }

    return records;
  }

  private async fetchExternalMetric(
    metricName: string,
    fetcher: () => Promise<{ date: string; value: number }>,
  ): Promise<BitcoinMetricRecord[]> {
    try {
      const point = await fetcher();

      return [{ date: point.date, metricName, metricValue: point.value }];
    } catch (error) {
      this.logger.warn(`Failed to fetch ${metricName}; skipping for this run`, {
        error: error instanceof Error ? error.message : String(error),
      });

      return [];
    }
  }
}

function formatAttemptCount(error: unknown): string {
  if (error instanceof RetryExhaustedError) {
    return `${error.retryCount} attempts`;
  }

  return '1 attempt';
}

export function createQStashSignatureMiddleware(
  options: QStashVerifierOptions = {},
): (req: Request, res: Response, next: NextFunction) => void {
  return (req, res, next) => {
    const signature = getQStashSignature(req);
    const currentSigningKey = options.currentSigningKey ?? process.env.QSTASH_CURRENT_SIGNING_KEY;
    const nextSigningKey = options.nextSigningKey ?? process.env.QSTASH_NEXT_SIGNING_KEY;
    const expectedUrl = options.expectedUrl ?? process.env.QSTASH_DAILY_REFRESH_URL ?? getRequestUrl(req);

    if (!signature || !currentSigningKey || !nextSigningKey) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    if (
      !verifyQStashSignature({
        signature,
        body: (req as RequestWithRawBody).rawBody ?? '',
        expectedUrl,
        signingKeys: [currentSigningKey, nextSigningKey],
      })
    ) {
      options.logger?.warn('Rejected invalid QStash signature', { expectedUrl });
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    next();
  };
}

export async function calculateAndInsertDailyMetrics(
  database: Parameters<typeof insertBitcoinPriceDaily>[0],
  date: string,
): Promise<BitcoinMetricRecord[]> {
  const priceHistory = await fetchBitcoinPriceHistoryForIndicators(database, date);
  const latestIndicators = selectLatestBitcoinDailyIndicators(priceHistory);

  if (!latestIndicators) {
    return [];
  }

  const metricRecords = toBitcoinMetricRecords(date, latestIndicators);
  await insertBitcoinMetricsDaily(database, metricRecords);

  return metricRecords;
}

async function fetchBitcoinPriceHistoryForIndicators(
  database: Parameters<typeof insertBitcoinPriceDaily>[0],
  date: string,
): Promise<BitcoinDailyIndicatorInput[]> {
  const result = (await database.query(
    `
      SELECT date, price_usd, circulating_supply
      FROM bitcoin_price_daily
      WHERE date <= $1::date
        AND date >= ($1::date - INTERVAL '349 days')
      ORDER BY date ASC
    `,
    [date],
  )) as QueryResult<BitcoinPriceHistoryRow>;

  return result.rows.map((row) => ({
    date: normalizeDate(row.date),
    priceUsd: Number(row.price_usd),
    circulatingSupply:
      row.circulating_supply === null ? undefined : Number(row.circulating_supply),
  }));
}

export async function insertBitcoinMetricsDaily(
  database: Parameters<typeof insertBitcoinPriceDaily>[0],
  records: BitcoinMetricRecord[],
): Promise<void> {
  if (records.length === 0) {
    return;
  }

  const columnsPerRecord = 3;
  const values = records.flatMap((record) => [
    record.date,
    record.metricName,
    record.metricValue,
  ]);
  const placeholders = records
    .map((_, recordIndex) => {
      const offset = recordIndex * columnsPerRecord;

      return `($${offset + 1}, $${offset + 2}, $${offset + 3})`;
    })
    .join(', ');

  await database.query(
    `
      INSERT INTO bitcoin_metrics_daily (
        date,
        metric_name,
        metric_value
      )
      VALUES ${placeholders}
      ON CONFLICT (date, metric_name) DO UPDATE SET
        metric_value = EXCLUDED.metric_value
    `,
    values,
  );
}

async function updateLastRefreshStatus(
  database: Parameters<typeof insertBitcoinPriceDaily>[0],
  timestamp: Date,
  status: 'success' | 'failed',
): Promise<void> {
  await database.query(
    `
      INSERT INTO system_configuration (key, value, updated_at)
      VALUES
        ('last_refresh_timestamp', $1, CURRENT_TIMESTAMP),
        ('last_refresh_status', $2, CURRENT_TIMESTAMP)
      ON CONFLICT (key)
      DO UPDATE SET value = EXCLUDED.value, updated_at = CURRENT_TIMESTAMP
    `,
    [timestamp.toISOString(), status],
  );
}

function toBitcoinMetricRecords(
  date: string,
  indicators: NonNullable<ReturnType<typeof selectLatestBitcoinDailyIndicators>>,
): BitcoinMetricRecord[] {
  const records: BitcoinMetricRecord[] = [
    {
      date,
      metricName: 'rainbow_band',
      metricValue: indicators.rainbowBand,
    },
  ];

  if (indicators.ma111Day !== null) {
    records.push({
      date,
      metricName: 'ma_111_day',
      metricValue: indicators.ma111Day,
    });
  }

  if (indicators.ma350Day !== null) {
    records.push({
      date,
      metricName: 'ma_350_day',
      metricValue: indicators.ma350Day,
    });
  }

  if (indicators.stockToFlowRatio !== null) {
    records.push({
      date,
      metricName: 'stock_to_flow_ratio',
      metricValue: indicators.stockToFlowRatio,
    });
  }

  return records;
}

function normalizeDate(value: string | Date): Date {
  if (value instanceof Date) {
    return value;
  }

  return new Date(`${value}T00:00:00.000Z`);
}

function verifyQStashSignature(input: {
  signature: string;
  body: string;
  expectedUrl: string;
  signingKeys: string[];
}): boolean {
  for (const signingKey of input.signingKeys) {
    try {
      const claims = jwt.verify(input.signature, signingKey) as JwtPayload;

      if (
        claims.iss === 'Upstash' &&
        claims.sub === input.expectedUrl &&
        isValidBodyHash(input.body, claims.body)
      ) {
        return true;
      }
    } catch {
      // Try the next signing key.
    }
  }

  return false;
}

function isValidBodyHash(body: string, claim: unknown): boolean {
  if (typeof claim !== 'string') {
    return false;
  }

  const hash = createHash('sha256').update(body).digest();

  return claim === hash.toString('base64url') || claim === hash.toString('hex');
}

function getQStashSignature(req: Request): string | undefined {
  for (const header of QSTASH_SIGNATURE_HEADERS) {
    const value = req.get(header);

    if (value) {
      return value;
    }
  }

  return undefined;
}

function getQStashRetryCount(req: Request): number | undefined {
  const retryCount = req.get('Upstash-Retried') ?? req.get('X-Qstash-Retry-Count');

  if (!retryCount) {
    return undefined;
  }

  const parsedRetryCount = Number(retryCount);

  return Number.isFinite(parsedRetryCount) ? parsedRetryCount : undefined;
}

function getRequestUrl(req: Request): string {
  const protocol = req.protocol;
  const host = req.get('host') ?? 'localhost';

  return `${protocol}://${host}${req.originalUrl}`;
}

function getYesterdayUtcIsoDate(now: Date): string {
  const yesterday = new Date(now);
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);

  return yesterday.toISOString().slice(0, 10);
}
