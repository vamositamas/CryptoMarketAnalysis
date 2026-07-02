import { retryWithBackoff, type RetryWithBackoffOptions } from './retry.util';

export interface BinanceFuturesClientOptions {
  baseUrl?: string;
  symbol?: string;
  fetchFn?: typeof fetch;
  logger?: Pick<Console, 'error'>;
  retryAttempts?: number;
  retryBaseDelayMs?: number;
  sleep?: RetryWithBackoffOptions['sleep'];
}

export interface FundingRatePoint {
  date: string;
  fundingRate: number;
}

interface FundingRateApiRow {
  symbol: string;
  fundingTime: number;
  fundingRate: string;
}

const DEFAULT_BASE_URL = 'https://fapi.binance.com';
const DEFAULT_SYMBOL = 'BTCUSDT';
const PAGE_SIZE = 1000;
// BTCUSDT perpetual funding history starts here — used as the pagination floor.
const FUNDING_HISTORY_START_MS = Date.parse('2019-09-08T00:00:00.000Z');

export class BinanceFuturesClient {
  private readonly baseUrl: string;
  private readonly symbol: string;
  private readonly fetchFn: typeof fetch;
  private readonly logger: Pick<Console, 'error'>;
  private readonly retryAttempts: number;
  private readonly retryBaseDelayMs: number;
  private readonly sleep: RetryWithBackoffOptions['sleep'];

  constructor(options: BinanceFuturesClientOptions = {}) {
    this.baseUrl = options.baseUrl ?? DEFAULT_BASE_URL;
    this.symbol = options.symbol ?? DEFAULT_SYMBOL;
    this.fetchFn = options.fetchFn ?? fetch;
    this.logger = options.logger ?? console;
    this.retryAttempts = options.retryAttempts ?? 3;
    this.retryBaseDelayMs = options.retryBaseDelayMs ?? 1000;
    this.sleep = options.sleep;
  }

  // Full funding-rate history since the BTCUSDT perpetual launched (2019-09-08).
  // One row roughly every 8 hours; grouped by UTC day and averaged by the caller.
  async fetchFundingRateHistory(): Promise<{ date: string; value: number }[]> {
    const rows: FundingRateApiRow[] = [];
    let startTime = FUNDING_HISTORY_START_MS;
    const now = Date.now();

    while (startTime < now) {
      const page = await this.fetchFundingRatePage(startTime);
      if (page.length === 0) break;

      rows.push(...page);
      const lastFundingTime = page[page.length - 1]!.fundingTime;
      if (page.length < PAGE_SIZE || lastFundingTime <= startTime) break;
      startTime = lastFundingTime + 1;
    }

    return averageByUtcDay(rows);
  }

  // Lightweight fetch of the most recent funding readings, for the daily refresh job.
  async fetchFundingRateLatest(): Promise<{ date: string; value: number }> {
    const url = `${this.baseUrl}/fapi/v1/fundingRate?symbol=${this.symbol}&limit=3`;
    const rows = await this.getJson<FundingRateApiRow[]>(url, 'Funding rate');
    const averaged = averageByUtcDay(rows);
    const latest = averaged[averaged.length - 1];

    if (!latest) {
      throw new BinanceFuturesClientError('Funding rate response contained no valid data');
    }

    return latest;
  }

  private async fetchFundingRatePage(startTime: number): Promise<FundingRateApiRow[]> {
    const url = `${this.baseUrl}/fapi/v1/fundingRate?symbol=${this.symbol}&startTime=${startTime}&limit=${PAGE_SIZE}`;
    return this.getJson<FundingRateApiRow[]>(url, 'Funding rate');
  }

  private async getJson<T>(url: string, label: string): Promise<T> {
    return retryWithBackoff(
      async () => {
        const response = await this.fetchFn(url);
        if (!response.ok) {
          throw new BinanceFuturesClientError(
            `${label} request failed with status ${response.status}`,
            response.status,
          );
        }
        return (await response.json()) as T;
      },
      this.retryAttempts,
      this.retryBaseDelayMs,
      { sleep: this.sleep, shouldRetry: isRetryableBinanceError },
    );
  }
}

function averageByUtcDay(rows: FundingRateApiRow[]): { date: string; value: number }[] {
  const byDay = new Map<string, number[]>();

  for (const row of rows) {
    const rate = Number(row.fundingRate);
    if (!Number.isFinite(rate)) continue;
    const date = new Date(row.fundingTime).toISOString().slice(0, 10);
    const existing = byDay.get(date);
    if (existing) {
      existing.push(rate);
    } else {
      byDay.set(date, [rate]);
    }
  }

  return [...byDay.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([date, rates]) => ({
      date,
      value: rates.reduce((sum, r) => sum + r, 0) / rates.length,
    }));
}

function isRetryableBinanceError(error: unknown): boolean {
  if (!(error instanceof BinanceFuturesClientError)) {
    return true;
  }

  return error.statusCode === undefined || error.statusCode === 429 || error.statusCode >= 500;
}

export class BinanceFuturesClientError extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}
