import PQueue from 'p-queue';
import { retryWithBackoff, type RetryWithBackoffOptions } from './retry.util';

export interface CoinGeckoBitcoinMarketData {
  date: string;
  priceUsd: number;
  marketCapUsd?: number;
  circulatingSupply?: number;
}

export interface CoinGeckoClientOptions {
  baseUrl?: string;
  fetchFn?: typeof fetch;
  logger?: Pick<Console, 'error'>;
  queue?: RateLimitQueue;
  retryAttempts?: number;
  retryBaseDelayMs?: number;
  sleep?: RetryWithBackoffOptions['sleep'];
}

interface RateLimitQueue {
  add<T>(task: () => Promise<T>): Promise<T>;
}

interface CoinGeckoHistoryResponse {
  market_data?: {
    current_price?: {
      usd?: number;
    };
    market_cap?: {
      usd?: number;
    };
    circulating_supply?: number;
  };
}

interface CoinGeckoSimplePriceResponse {
  bitcoin?: {
    usd?: number;
    usd_market_cap?: number;
  };
}

const DEFAULT_BASE_URL = 'https://api.coingecko.com/api/v3';

export class CoinGeckoClient {
  private readonly baseUrl: string;
  private readonly fetchFn: typeof fetch;
  private readonly logger: Pick<Console, 'error'>;
  private readonly queue: RateLimitQueue;
  private readonly retryAttempts: number;
  private readonly retryBaseDelayMs: number;
  private readonly sleep: RetryWithBackoffOptions['sleep'];

  constructor(options: CoinGeckoClientOptions = {}) {
    this.baseUrl = options.baseUrl ?? DEFAULT_BASE_URL;
    this.fetchFn = options.fetchFn ?? fetch;
    this.logger = options.logger ?? console;
    this.retryAttempts = options.retryAttempts ?? 3;
    this.retryBaseDelayMs = options.retryBaseDelayMs ?? 1000;
    this.sleep = options.sleep;
    this.queue =
      options.queue ??
      new PQueue({
        concurrency: 1,
        intervalCap: 1,
        interval: 1200,
      });
  }

  async fetchBitcoinPrice(date: string): Promise<number> {
    const marketData = await this.fetchBitcoinMarketData(date);

    return marketData.priceUsd;
  }

  async fetchCurrentBitcoinMarketData(date: string): Promise<CoinGeckoBitcoinMarketData> {
    return this.queue.add(() =>
      retryWithBackoff(
        () => this.fetchCurrentBitcoinMarketDataNow(date),
        this.retryAttempts,
        this.retryBaseDelayMs,
        { sleep: this.sleep, shouldRetry: isRetryableCoinGeckoError },
      ),
    );
  }

  async fetchBitcoinMarketData(date: string): Promise<CoinGeckoBitcoinMarketData> {
    return this.queue.add(() =>
      retryWithBackoff(
        () => this.fetchBitcoinMarketDataNow(date),
        this.retryAttempts,
        this.retryBaseDelayMs,
        {
          sleep: this.sleep,
          shouldRetry: isRetryableCoinGeckoError,
        },
      ),
    );
  }

  private async fetchCurrentBitcoinMarketDataNow(date: string): Promise<CoinGeckoBitcoinMarketData> {
    const url = new URL('/api/v3/simple/price', ensureTrailingSlash(this.baseUrl));
    url.searchParams.set('ids', 'bitcoin');
    url.searchParams.set('vs_currencies', 'usd');
    url.searchParams.set('include_market_cap', 'true');
    const urlStr = url.toString();

    try {
      const response = await this.fetchFn(urlStr);

      if (!response.ok) {
        throw new CoinGeckoClientError(
          `CoinGecko simple price request failed with status ${response.status}`,
          response.status,
        );
      }

      const payload = (await response.json()) as CoinGeckoSimplePriceResponse;

      return normalizeSimplePriceResponse(date, payload);
    } catch (error) {
      this.logger.error('CoinGecko simple price request failed', {
        timestamp: new Date().toISOString(),
        request: { date, url: urlStr },
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  private async fetchBitcoinMarketDataNow(
    date: string,
  ): Promise<CoinGeckoBitcoinMarketData> {
    const url = this.createHistoryUrl(date);

    try {
      const response = await this.fetchFn(url);

      if (!response.ok) {
        throw new CoinGeckoClientError(
          `CoinGecko request failed with status ${response.status}`,
          response.status,
        );
      }

      const payload = (await response.json()) as CoinGeckoHistoryResponse;

      return normalizeHistoryResponse(date, payload);
    } catch (error) {
      this.logger.error('CoinGecko request failed', {
        timestamp: new Date().toISOString(),
        request: {
          date,
          url,
        },
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  private createHistoryUrl(date: string): string {
    const url = new URL('/api/v3/coins/bitcoin/history', ensureTrailingSlash(this.baseUrl));
    url.searchParams.set('date', toCoinGeckoDate(date));

    return url.toString();
  }
}

function isRetryableCoinGeckoError(error: unknown): boolean {
  if (!(error instanceof CoinGeckoClientError)) {
    return true;
  }

  return error.statusCode === undefined || error.statusCode === 429 || error.statusCode >= 500;
}

export class CoinGeckoClientError extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}

function normalizeSimplePriceResponse(
  date: string,
  response: CoinGeckoSimplePriceResponse,
): CoinGeckoBitcoinMarketData {
  const priceUsd = response.bitcoin?.usd;
  const marketCapUsd = response.bitcoin?.usd_market_cap;

  if (typeof priceUsd !== 'number') {
    throw new CoinGeckoClientError('CoinGecko simple price response is missing USD price');
  }

  const circulatingSupply =
    typeof marketCapUsd === 'number' && priceUsd > 0
      ? Math.round(marketCapUsd / priceUsd)
      : undefined;

  return { date, priceUsd, marketCapUsd, circulatingSupply };
}

function normalizeHistoryResponse(
  date: string,
  response: CoinGeckoHistoryResponse,
): CoinGeckoBitcoinMarketData {
  const marketData = response.market_data;
  const priceUsd = marketData?.current_price?.usd;

  if (typeof priceUsd !== 'number') {
    // 404 signals "no data for this date" — not a transient error, should not be retried
    throw new CoinGeckoClientError('CoinGecko response is missing USD price', 404);
  }

  return {
    date,
    priceUsd,
    marketCapUsd: marketData?.market_cap?.usd,
    circulatingSupply: marketData?.circulating_supply,
  };
}

function toCoinGeckoDate(date: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);

  if (!match) {
    throw new CoinGeckoClientError('Date must use YYYY-MM-DD format');
  }

  return `${match[3]}-${match[2]}-${match[1]}`;
}

function ensureTrailingSlash(value: string): string {
  return value.endsWith('/') ? value : `${value}/`;
}
