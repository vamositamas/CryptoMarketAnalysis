import { retryWithBackoff, type RetryWithBackoffOptions } from './retry.util';

export interface CoinMetricsClientOptions {
  baseUrl?: string;
  fetchFn?: typeof fetch;
  logger?: Pick<Console, 'error'>;
  retryAttempts?: number;
  retryBaseDelayMs?: number;
  sleep?: RetryWithBackoffOptions['sleep'];
}

export interface CoinMetricsRealizedPricePoint {
  date: string;
  realizedPrice: number;
}

interface CoinMetricsRow {
  asset: string;
  time: string;
  CapMVRVCur: string | null;
  PriceUSD: string | null;
}

interface CoinMetricsResponse {
  data: CoinMetricsRow[];
  next_page_url: string | null;
}

const DEFAULT_BASE_URL = 'https://community-api.coinmetrics.io/v4';

export class CoinMetricsClient {
  private readonly baseUrl: string;
  private readonly fetchFn: typeof fetch;
  private readonly logger: Pick<Console, 'error'>;
  private readonly retryAttempts: number;
  private readonly retryBaseDelayMs: number;
  private readonly sleep: RetryWithBackoffOptions['sleep'];

  constructor(options: CoinMetricsClientOptions = {}) {
    this.baseUrl = options.baseUrl ?? DEFAULT_BASE_URL;
    this.fetchFn = options.fetchFn ?? fetch;
    this.logger = options.logger ?? console;
    this.retryAttempts = options.retryAttempts ?? 3;
    this.retryBaseDelayMs = options.retryBaseDelayMs ?? 1000;
    this.sleep = options.sleep;
  }

  async fetchMvrvRatioAndPriceHistory(): Promise<CoinMetricsRealizedPricePoint[]> {
    const results: CoinMetricsRealizedPricePoint[] = [];
    let url: string | null =
      `${this.baseUrl}/timeseries/asset-metrics?assets=btc&metrics=CapMVRVCur,PriceUSD&frequency=1d&page_size=10000`;

    while (url !== null) {
      const pageUrl: string = url;
      const page: CoinMetricsResponse = await retryWithBackoff(
        async (): Promise<CoinMetricsResponse> => {
          const response: Response = await this.fetchFn(pageUrl);
          if (!response.ok) {
            throw new CoinMetricsClientError(
              `CoinMetrics request failed with status ${response.status}`,
              response.status,
            );
          }
          return (await response.json()) as CoinMetricsResponse;
        },
        this.retryAttempts,
        this.retryBaseDelayMs,
        { sleep: this.sleep, shouldRetry: isRetryableCoinMetricsError },
      );

      for (const row of page.data) {
        const mvrv = Number(row.CapMVRVCur);
        const price = Number(row.PriceUSD);
        if (mvrv > 0 && price > 0 && Number.isFinite(mvrv) && Number.isFinite(price)) {
          results.push({
            date: row.time.slice(0, 10),
            realizedPrice: price / mvrv,
          });
        }
      }

      url = page.next_page_url ?? null;
    }

    return results;
  }
}

function isRetryableCoinMetricsError(error: unknown): boolean {
  if (!(error instanceof CoinMetricsClientError)) {
    return true;
  }

  return error.statusCode === undefined || error.statusCode === 429 || error.statusCode >= 500;
}

export class CoinMetricsClientError extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}
