import { retryWithBackoff, type RetryWithBackoffOptions } from './retry.util';

export interface BlockchainInfoMarketPricePoint {
  date: string;
  priceUsd: number;
}

export interface BlockchainInfoChartPoint {
  date: string;
  value: number;
}

export interface BlockchainInfoClientOptions {
  baseUrl?: string;
  fetchFn?: typeof fetch;
  logger?: Pick<Console, 'error'>;
  retryAttempts?: number;
  retryBaseDelayMs?: number;
  sleep?: RetryWithBackoffOptions['sleep'];
}

interface BlockchainInfoChartResponse {
  values?: Array<{
    x?: number;
    y?: number;
  }>;
}

const DEFAULT_BASE_URL = 'https://api.blockchain.info/charts';
const MARKET_PRICE_CHART = 'market-price';
const HASH_RATE_CHART = 'hash-rate';
const DIFFICULTY_CHART = 'difficulty';

export class BlockchainInfoClient {
  private readonly baseUrl: string;
  private readonly fetchFn: typeof fetch;
  private readonly logger: Pick<Console, 'error'>;
  private readonly retryAttempts: number;
  private readonly retryBaseDelayMs: number;
  private readonly sleep: RetryWithBackoffOptions['sleep'];

  constructor(options: BlockchainInfoClientOptions = {}) {
    this.baseUrl = options.baseUrl ?? DEFAULT_BASE_URL;
    this.fetchFn = options.fetchFn ?? fetch;
    this.logger = options.logger ?? console;
    this.retryAttempts = options.retryAttempts ?? 3;
    this.retryBaseDelayMs = options.retryBaseDelayMs ?? 1000;
    this.sleep = options.sleep;
  }

  async fetchMarketPrice(
    startDate: string,
    endDate: string,
  ): Promise<BlockchainInfoMarketPricePoint[]> {
    const points = await this.fetchChart(MARKET_PRICE_CHART, startDate, endDate);

    return points.map((point) => ({ date: point.date, priceUsd: point.value }));
  }

  async fetchHashRate(startDate: string, endDate: string): Promise<BlockchainInfoChartPoint[]> {
    return this.fetchChart(HASH_RATE_CHART, startDate, endDate);
  }

  async fetchDifficulty(startDate: string, endDate: string): Promise<BlockchainInfoChartPoint[]> {
    return this.fetchChart(DIFFICULTY_CHART, startDate, endDate);
  }

  private async fetchChart(
    chartName: string,
    startDate: string,
    endDate: string,
  ): Promise<BlockchainInfoChartPoint[]> {
    return retryWithBackoff(
      () => this.fetchChartNow(chartName, startDate, endDate),
      this.retryAttempts,
      this.retryBaseDelayMs,
      {
        sleep: this.sleep,
        shouldRetry: isRetryableBlockchainInfoError,
      },
    );
  }

  private async fetchChartNow(
    chartName: string,
    startDate: string,
    endDate: string,
  ): Promise<BlockchainInfoChartPoint[]> {
    const url = this.createChartUrl(chartName, startDate, endDate);

    try {
      const response = await this.fetchFn(url);

      if (!response.ok) {
        throw new BlockchainInfoClientError(
          `Blockchain.info request failed with status ${response.status}`,
          response.status,
        );
      }

      const payload = (await response.json()) as BlockchainInfoChartResponse;

      return normalizeChartResponse(startDate, endDate, payload);
    } catch (error) {
      this.logger.error('Blockchain.info request failed', {
        timestamp: new Date().toISOString(),
        request: {
          chartName,
          startDate,
          endDate,
          url,
        },
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  private createChartUrl(chartName: string, startDate: string, endDate: string): string {
    const timespanDays = calculateInclusiveTimespanDays(startDate, endDate);
    const url = new URL(`${ensureTrailingSlash(this.baseUrl)}${chartName}`);
    url.searchParams.set('start', startDate);
    url.searchParams.set('timespan', `${timespanDays}days`);
    url.searchParams.set('format', 'json');

    return url.toString();
  }
}

function isRetryableBlockchainInfoError(error: unknown): boolean {
  if (!(error instanceof BlockchainInfoClientError)) {
    return true;
  }

  return error.statusCode === undefined || error.statusCode === 429 || error.statusCode >= 500;
}

export class BlockchainInfoClientError extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}

function normalizeChartResponse(
  startDate: string,
  endDate: string,
  response: BlockchainInfoChartResponse,
): BlockchainInfoChartPoint[] {
  const values = response.values;

  if (!Array.isArray(values)) {
    throw new BlockchainInfoClientError('Blockchain.info response is missing chart values');
  }

  return values
    .map((value) => normalizeChartValue(value))
    .filter((value): value is BlockchainInfoChartPoint => value !== undefined)
    .filter((value) => value.date >= startDate && value.date <= endDate);
}

function normalizeChartValue(value: { x?: number; y?: number }): BlockchainInfoChartPoint | undefined {
  if (typeof value.x !== 'number' || typeof value.y !== 'number') {
    return undefined;
  }

  return {
    date: unixSecondsToIsoDate(value.x),
    value: value.y,
  };
}

function calculateInclusiveTimespanDays(startDate: string, endDate: string): number {
  const start = parseIsoDate(startDate, 'Start date');
  const end = parseIsoDate(endDate, 'End date');

  if (end.getTime() < start.getTime()) {
    throw new BlockchainInfoClientError('End date must be on or after start date');
  }

  const millisecondsPerDay = 24 * 60 * 60 * 1000;

  return Math.floor((end.getTime() - start.getTime()) / millisecondsPerDay) + 1;
}

function parseIsoDate(date: string, label: string): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);

  if (!match) {
    throw new BlockchainInfoClientError(`${label} must use YYYY-MM-DD format`);
  }

  const parsedDate = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));

  if (unixSecondsToIsoDate(parsedDate.getTime() / 1000) !== date) {
    throw new BlockchainInfoClientError(`${label} must be a valid calendar date`);
  }

  return parsedDate;
}

function unixSecondsToIsoDate(seconds: number): string {
  return new Date(seconds * 1000).toISOString().slice(0, 10);
}

function ensureTrailingSlash(value: string): string {
  return value.endsWith('/') ? value : `${value}/`;
}
