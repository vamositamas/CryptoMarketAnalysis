import PQueue from 'p-queue';

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

const DEFAULT_BASE_URL = 'https://api.coingecko.com/api/v3';

export class CoinGeckoClient {
  private readonly baseUrl: string;
  private readonly fetchFn: typeof fetch;
  private readonly logger: Pick<Console, 'error'>;
  private readonly queue: RateLimitQueue;

  constructor(options: CoinGeckoClientOptions = {}) {
    this.baseUrl = options.baseUrl ?? DEFAULT_BASE_URL;
    this.fetchFn = options.fetchFn ?? fetch;
    this.logger = options.logger ?? console;
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

  async fetchBitcoinMarketData(date: string): Promise<CoinGeckoBitcoinMarketData> {
    return this.queue.add(() => this.fetchBitcoinMarketDataNow(date));
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

export class CoinGeckoClientError extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}

function normalizeHistoryResponse(
  date: string,
  response: CoinGeckoHistoryResponse,
): CoinGeckoBitcoinMarketData {
  const marketData = response.market_data;
  const priceUsd = marketData?.current_price?.usd;

  if (typeof priceUsd !== 'number') {
    throw new CoinGeckoClientError('CoinGecko response is missing USD price');
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
