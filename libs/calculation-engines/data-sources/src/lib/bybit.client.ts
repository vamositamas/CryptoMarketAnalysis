import { retryWithBackoff, type RetryWithBackoffOptions } from './retry.util';

export interface BybitClientOptions {
  baseUrl?: string;
  symbol?: string;
  fetchFn?: typeof fetch;
  logger?: Pick<Console, 'error'>;
  retryAttempts?: number;
  retryBaseDelayMs?: number;
  sleep?: RetryWithBackoffOptions['sleep'];
}

export interface OpenInterestPoint {
  date: string;
  openInterestBtc: number;
}

interface BybitOpenInterestRow {
  openInterest: string;
  timestamp: string;
}

interface BybitOpenInterestResponse {
  retCode: number;
  retMsg: string;
  result?: {
    list: BybitOpenInterestRow[];
    nextPageCursor?: string;
  };
}

interface BybitTickerResponse {
  retCode: number;
  retMsg: string;
  result?: {
    list: { lastPrice: string; openInterest: string }[];
  };
}

const DEFAULT_BASE_URL = 'https://api.bybit.com';
const DEFAULT_SYMBOL = 'BTCUSDT';
const PAGE_SIZE = 200;
const MAX_PAGES = 30; // ~16 years of daily data at 200/page — well beyond BTCUSDT's actual listing date

export class BybitClient {
  private readonly baseUrl: string;
  private readonly symbol: string;
  private readonly fetchFn: typeof fetch;
  private readonly logger: Pick<Console, 'error'>;
  private readonly retryAttempts: number;
  private readonly retryBaseDelayMs: number;
  private readonly sleep: RetryWithBackoffOptions['sleep'];

  constructor(options: BybitClientOptions = {}) {
    this.baseUrl = options.baseUrl ?? DEFAULT_BASE_URL;
    this.symbol = options.symbol ?? DEFAULT_SYMBOL;
    this.fetchFn = options.fetchFn ?? fetch;
    this.logger = options.logger ?? console;
    this.retryAttempts = options.retryAttempts ?? 3;
    this.retryBaseDelayMs = options.retryBaseDelayMs ?? 1000;
    this.sleep = options.sleep;
  }

  // Full daily open-interest history for the BTCUSDT linear perpetual, in BTC (base
  // currency) terms — Bybit retains this back to 2020-08-05, unlike Binance's 30-day
  // cap. Caller is expected to convert to USD using the BTC price for each date.
  async fetchOpenInterestHistory(): Promise<OpenInterestPoint[]> {
    const points = new Map<string, number>();
    let cursor: string | undefined;
    let pageCount = 0;

    while (pageCount < MAX_PAGES) {
      const page = await this.fetchOpenInterestPage(cursor);
      const rows = page.result?.list ?? [];
      if (rows.length === 0) break;

      for (const row of rows) {
        const value = Number(row.openInterest);
        if (!Number.isFinite(value)) continue;
        const date = new Date(Number(row.timestamp)).toISOString().slice(0, 10);
        points.set(date, value);
      }

      cursor = page.result?.nextPageCursor;
      pageCount += 1;
      if (!cursor) break;
    }

    return [...points.entries()]
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([date, openInterestBtc]) => ({ date, openInterestBtc }));
  }

  // Latest open interest converted to USD using Bybit's own current mark price —
  // used by the daily refresh job.
  async fetchOpenInterestLatest(): Promise<{ date: string; value: number }> {
    const [page, ticker] = await Promise.all([
      this.fetchOpenInterestPage(),
      this.fetchTicker(),
    ]);
    const row = page.result?.list?.[0];
    const price = Number(ticker.result?.list?.[0]?.lastPrice);

    if (!row || !Number.isFinite(price) || price <= 0) {
      throw new BybitClientError('Open interest response contained no valid data');
    }

    const openInterestBtc = Number(row.openInterest);
    if (!Number.isFinite(openInterestBtc) || openInterestBtc <= 0) {
      throw new BybitClientError('Open interest response contained no valid data');
    }

    return {
      date: new Date(Number(row.timestamp)).toISOString().slice(0, 10),
      value: openInterestBtc * price,
    };
  }

  private async fetchOpenInterestPage(cursor?: string): Promise<BybitOpenInterestResponse> {
    const url = new URL(`${this.baseUrl}/v5/market/open-interest`);
    url.searchParams.set('category', 'linear');
    url.searchParams.set('symbol', this.symbol);
    url.searchParams.set('intervalTime', '1d');
    url.searchParams.set('limit', String(PAGE_SIZE));
    if (cursor) url.searchParams.set('cursor', cursor);

    return this.getJson<BybitOpenInterestResponse>(url.toString(), 'Open interest');
  }

  private async fetchTicker(): Promise<BybitTickerResponse> {
    const url = new URL(`${this.baseUrl}/v5/market/tickers`);
    url.searchParams.set('category', 'linear');
    url.searchParams.set('symbol', this.symbol);

    return this.getJson<BybitTickerResponse>(url.toString(), 'Ticker');
  }

  private async getJson<T extends { retCode: number; retMsg: string }>(
    url: string,
    label: string,
  ): Promise<T> {
    return retryWithBackoff(
      async () => {
        const response = await this.fetchFn(url);
        if (!response.ok) {
          throw new BybitClientError(
            `${label} request failed with status ${response.status}`,
            response.status,
          );
        }
        const payload = (await response.json()) as T;
        if (payload.retCode !== 0) {
          throw new BybitClientError(`${label} request failed: ${payload.retMsg}`);
        }
        return payload;
      },
      this.retryAttempts,
      this.retryBaseDelayMs,
      { sleep: this.sleep, shouldRetry: isRetryableBybitError },
    );
  }
}

function isRetryableBybitError(error: unknown): boolean {
  if (!(error instanceof BybitClientError)) {
    return true;
  }

  return error.statusCode === undefined || error.statusCode === 429 || error.statusCode >= 500;
}

export class BybitClientError extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}
