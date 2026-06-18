import { getDatabasePool } from '../config/database.config';
import {
  BlockchainInfoClient,
  CoinGeckoClient,
  type CoinGeckoBitcoinMarketData,
} from '@crypto-market-analysis/calculation-engines/data-sources';

interface BitcoinPriceDailyRecord {
  date: string;
  priceUsd: number;
  marketCapUsd?: number;
  circulatingSupply?: number;
}

interface FailedDateRange {
  startDate: string;
  endDate: string;
  error: string;
}

interface DateRange {
  startDate: string;
  endDate: string;
}

interface Queryable {
  query(sql: string, values?: unknown[]): Promise<unknown>;
}

interface HistoricalDataInitializationOptions {
  startDate?: string;
  endDate?: string;
  chunkDays?: number;
  retryAttempts?: number;
  retryDelayMs?: number;
  coinGeckoClient?: Pick<CoinGeckoClient, 'fetchBitcoinMarketData'>;
  blockchainInfoClient?: Pick<BlockchainInfoClient, 'fetchMarketPrice'>;
  database?: Queryable;
  logger?: Pick<Console, 'error' | 'log' | 'warn'>;
  sleep?: (milliseconds: number) => Promise<void>;
}

export interface HistoricalDataInitializationSummary {
  startDate: string;
  endDate: string;
  totalDays: number;
  fetchedDays: number;
  failedRanges: FailedDateRange[];
}

const BITCOIN_GENESIS_DATE = '2009-01-03';
const DEFAULT_CHUNK_DAYS = 90;
const DEFAULT_RETRY_ATTEMPTS = 3;
const DEFAULT_RETRY_DELAY_MS = 60_000;

export async function runHistoricalDataInitialization(
  options: HistoricalDataInitializationOptions = {},
): Promise<HistoricalDataInitializationSummary> {
  const logger = options.logger ?? console;
  const startDate = options.startDate ?? BITCOIN_GENESIS_DATE;
  const endDate = options.endDate ?? todayUtcIsoDate();
  const chunkDays = options.chunkDays ?? DEFAULT_CHUNK_DAYS;
  const retryAttempts = options.retryAttempts ?? DEFAULT_RETRY_ATTEMPTS;
  const retryDelayMs = options.retryDelayMs ?? DEFAULT_RETRY_DELAY_MS;
  const sleep = options.sleep ?? delay;
  const database = options.database ?? getDatabasePool();

  if (!database) {
    throw new Error('SUPABASE_DATABASE_URL is required to initialize historical data');
  }

  const ranges = splitIntoDateRanges(startDate, endDate, chunkDays);
  const totalDays = countInclusiveDays(startDate, endDate);
  const coinGeckoClient = options.coinGeckoClient ?? new CoinGeckoClient();
  const blockchainInfoClient = options.blockchainInfoClient ?? new BlockchainInfoClient();
  const failedRanges: FailedDateRange[] = [];
  let fetchedDays = 0;

  for (const range of ranges) {
    try {
      const records = await fetchChunkWithRetries({
        range,
        retryAttempts,
        retryDelayMs,
        coinGeckoClient,
        blockchainInfoClient,
        logger,
        sleep,
      });

      await insertBitcoinPriceDaily(database, records);
      fetchedDays += records.length;
      logger.log(
        `Fetched ${fetchedDays}/${totalDays} days (${formatProgressPercentage(
          fetchedDays,
          totalDays,
        )}% complete)`,
      );
    } catch (error) {
      const failedRange = {
        startDate: range.startDate,
        endDate: range.endDate,
        error: error instanceof Error ? error.message : String(error),
      };
      failedRanges.push(failedRange);
      logger.error('Failed to fetch historical Bitcoin data range', failedRange);
    }
  }

  logger.log('Derived metrics calculation deferred to Story 4.6.');

  if (failedRanges.length > 0) {
    logger.error('Historical data initialization completed with failed ranges', {
      failedRanges,
    });
  } else {
    logger.log(
      `Historical data initialization complete. Fetched ${fetchedDays} days from ${startDate} to ${endDate}.`,
    );
  }

  return {
    startDate,
    endDate,
    totalDays,
    fetchedDays,
    failedRanges,
  };
}

async function fetchChunkWithRetries(options: {
  range: DateRange;
  retryAttempts: number;
  retryDelayMs: number;
  coinGeckoClient: Pick<CoinGeckoClient, 'fetchBitcoinMarketData'>;
  blockchainInfoClient: Pick<BlockchainInfoClient, 'fetchMarketPrice'>;
  logger: Pick<Console, 'error' | 'log' | 'warn'>;
  sleep: (milliseconds: number) => Promise<void>;
}): Promise<BitcoinPriceDailyRecord[]> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= options.retryAttempts; attempt += 1) {
    try {
      return await fetchChunkPriceData(
        options.range,
        options.coinGeckoClient,
        options.blockchainInfoClient,
        options.logger,
      );
    } catch (error) {
      lastError = error;
      options.logger.error('Historical data chunk attempt failed', {
        startDate: options.range.startDate,
        endDate: options.range.endDate,
        attempt,
        retryAttempts: options.retryAttempts,
        error: error instanceof Error ? error.message : String(error),
      });

      if (attempt < options.retryAttempts) {
        await options.sleep(options.retryDelayMs);
      }
    }
  }

  throw lastError;
}

async function fetchChunkPriceData(
  range: DateRange,
  coinGeckoClient: Pick<CoinGeckoClient, 'fetchBitcoinMarketData'>,
  blockchainInfoClient: Pick<BlockchainInfoClient, 'fetchMarketPrice'>,
  logger: Pick<Console, 'warn'>,
): Promise<BitcoinPriceDailyRecord[]> {
  try {
    return await fetchCoinGeckoRange(range, coinGeckoClient);
  } catch (error) {
    logger.warn('CoinGecko historical chunk fetch failed; trying Blockchain.info fallback', {
      startDate: range.startDate,
      endDate: range.endDate,
      error: error instanceof Error ? error.message : String(error),
    });

    return blockchainInfoClient.fetchMarketPrice(range.startDate, range.endDate);
  }
}

async function fetchCoinGeckoRange(
  range: DateRange,
  coinGeckoClient: Pick<CoinGeckoClient, 'fetchBitcoinMarketData'>,
): Promise<CoinGeckoBitcoinMarketData[]> {
  const records: CoinGeckoBitcoinMarketData[] = [];

  for (const date of enumerateIsoDates(range.startDate, range.endDate)) {
    records.push(await coinGeckoClient.fetchBitcoinMarketData(date));
  }

  return records;
}

export async function insertBitcoinPriceDaily(
  database: Queryable,
  records: BitcoinPriceDailyRecord[],
): Promise<void> {
  if (records.length === 0) {
    return;
  }

  const columnsPerRecord = 4;
  const values = records.flatMap((record) => [
    record.date,
    record.priceUsd,
    record.marketCapUsd != null ? Math.round(record.marketCapUsd) : null,
    record.circulatingSupply != null ? Math.round(record.circulatingSupply) : null,
  ]);
  const placeholders = records
    .map((_, recordIndex) => {
      const offset = recordIndex * columnsPerRecord;

      return `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4})`;
    })
    .join(', ');

  await database.query(
    `
      INSERT INTO bitcoin_price_daily (
        date,
        price_usd,
        market_cap_usd,
        circulating_supply
      )
      VALUES ${placeholders}
      ON CONFLICT (date) DO UPDATE SET
        price_usd = EXCLUDED.price_usd,
        market_cap_usd = COALESCE(EXCLUDED.market_cap_usd, bitcoin_price_daily.market_cap_usd),
        circulating_supply = COALESCE(
          EXCLUDED.circulating_supply,
          bitcoin_price_daily.circulating_supply
        )
    `,
    values,
  );
}

export function splitIntoDateRanges(
  startDate: string,
  endDate: string,
  chunkDays = DEFAULT_CHUNK_DAYS,
): DateRange[] {
  if (chunkDays < 1) {
    throw new Error('Chunk days must be greater than 0');
  }

  const start = parseIsoDate(startDate);
  const end = parseIsoDate(endDate);

  if (end.getTime() < start.getTime()) {
    throw new Error('End date must be on or after start date');
  }

  const ranges: DateRange[] = [];
  let rangeStart = start;

  while (rangeStart.getTime() <= end.getTime()) {
    const rangeEnd = minDate(addUtcDays(rangeStart, chunkDays - 1), end);
    ranges.push({
      startDate: formatUtcDate(rangeStart),
      endDate: formatUtcDate(rangeEnd),
    });
    rangeStart = addUtcDays(rangeEnd, 1);
  }

  return ranges;
}

function enumerateIsoDates(startDate: string, endDate: string): string[] {
  const dates: string[] = [];
  let current = parseIsoDate(startDate);
  const end = parseIsoDate(endDate);

  while (current.getTime() <= end.getTime()) {
    dates.push(formatUtcDate(current));
    current = addUtcDays(current, 1);
  }

  return dates;
}

function countInclusiveDays(startDate: string, endDate: string): number {
  const millisecondsPerDay = 24 * 60 * 60 * 1000;

  return (
    Math.floor((parseIsoDate(endDate).getTime() - parseIsoDate(startDate).getTime()) / millisecondsPerDay) +
    1
  );
}

function parseIsoDate(date: string): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);

  if (!match) {
    throw new Error('Date must use YYYY-MM-DD format');
  }

  const parsedDate = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));

  if (formatUtcDate(parsedDate) !== date) {
    throw new Error('Date must be a valid calendar date');
  }

  return parsedDate;
}

function addUtcDays(date: Date, days: number): Date {
  const nextDate = new Date(date);
  nextDate.setUTCDate(nextDate.getUTCDate() + days);

  return nextDate;
}

function minDate(left: Date, right: Date): Date {
  return left.getTime() <= right.getTime() ? left : right;
}

function formatUtcDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function todayUtcIsoDate(): string {
  return formatUtcDate(new Date());
}

function formatProgressPercentage(fetchedDays: number, totalDays: number): string {
  return ((fetchedDays / totalDays) * 100).toFixed(1);
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function parseCliOptions(argv: string[]): HistoricalDataInitializationOptions {
  const options: HistoricalDataInitializationOptions = {};

  for (const arg of argv) {
    const [name, value] = arg.split('=');

    if (name === '--start-date') {
      options.startDate = value;
    }

    if (name === '--end-date') {
      options.endDate = value;
    }

    if (name === '--chunk-days' && value) {
      options.chunkDays = Number(value);
    }

    if (name === '--retry-attempts' && value) {
      options.retryAttempts = Number(value);
    }

    if (name === '--retry-delay-ms' && value) {
      options.retryDelayMs = Number(value);
    }
  }

  return options;
}

export async function runHistoricalDataInitializationCli(argv = process.argv.slice(2)): Promise<void> {
  const summary = await runHistoricalDataInitialization(parseCliOptions(argv));

  if (summary.failedRanges.length > 0) {
    process.exitCode = 1;
  }
}

export function reportHistoricalDataInitializationCliFailure(error: unknown): void {
  console.error('Historical data initialization failed', {
    error: error instanceof Error ? error.message : String(error),
  });
  process.exitCode = 1;
}

if (require.main === module) {
  runHistoricalDataInitializationCli()
    .then((summary) => {
      return summary;
    })
    .catch(reportHistoricalDataInitializationCliFailure);
}
