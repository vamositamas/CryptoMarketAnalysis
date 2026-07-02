import { retryWithBackoff, type RetryWithBackoffOptions } from './retry.util';

export interface DeribitClientOptions {
  baseUrl?: string;
  fetchFn?: typeof fetch;
  logger?: Pick<Console, 'error'>;
  retryAttempts?: number;
  retryBaseDelayMs?: number;
  sleep?: RetryWithBackoffOptions['sleep'];
  now?: () => Date;
}

export interface DeribitDvolPoint {
  date: string;
  dvol: number;
}

// [timestamp_ms, open, high, low, close]
type DeribitVolatilityCandle = [number, number, number, number, number];

interface DeribitVolatilityIndexResponse {
  result: {
    data: DeribitVolatilityCandle[];
    continuation: number | null;
  };
}

const DEFAULT_BASE_URL = 'https://www.deribit.com/api/v2';
const MAX_CANDLES_PER_REQUEST = 1000;

// DVOL (BTC implied volatility index) history only goes back to launch on 2021-03-24 —
// requests for earlier dates simply return an empty data array, not an error.
const DVOL_HISTORY_START_MS = Date.UTC(2021, 2, 24);

export class DeribitClient {
  private readonly baseUrl: string;
  private readonly fetchFn: typeof fetch;
  private readonly logger: Pick<Console, 'error'>;
  private readonly retryAttempts: number;
  private readonly retryBaseDelayMs: number;
  private readonly sleep: RetryWithBackoffOptions['sleep'];
  private readonly now: () => Date;

  constructor(options: DeribitClientOptions = {}) {
    this.baseUrl = options.baseUrl ?? DEFAULT_BASE_URL;
    this.fetchFn = options.fetchFn ?? fetch;
    this.logger = options.logger ?? console;
    this.retryAttempts = options.retryAttempts ?? 3;
    this.retryBaseDelayMs = options.retryBaseDelayMs ?? 1000;
    this.sleep = options.sleep;
    this.now = options.now ?? (() => new Date());
  }

  // Full BTC DVOL history. Deribit's get_volatility_index_data endpoint caps each response
  // at 1000 daily candles and paginates *backward in time* via a `continuation` timestamp
  // (the cutoff to use as the next request's end_timestamp), unlike every other client in
  // this app which paginates forward via a next-page URL/cursor.
  async fetchBtcDvolHistory(): Promise<DeribitDvolPoint[]> {
    const results: DeribitDvolPoint[] = [];
    const seenDates = new Set<string>();
    let endTimestampMs = this.now().getTime();

    while (endTimestampMs > DVOL_HISTORY_START_MS) {
      const url = `${this.baseUrl}/public/get_volatility_index_data?currency=BTC&start_timestamp=${DVOL_HISTORY_START_MS}&end_timestamp=${endTimestampMs}&resolution=1D`;
      const page: DeribitVolatilityIndexResponse = await retryWithBackoff(
        async (): Promise<DeribitVolatilityIndexResponse> => {
          const response: Response = await this.fetchFn(url);
          if (!response.ok) {
            throw new DeribitClientError(
              `Deribit request failed with status ${response.status}`,
              response.status,
            );
          }
          return (await response.json()) as DeribitVolatilityIndexResponse;
        },
        this.retryAttempts,
        this.retryBaseDelayMs,
        { sleep: this.sleep, shouldRetry: isRetryableDeribitError },
      );

      for (const [timestampMs, , , , close] of page.result.data) {
        const date = new Date(timestampMs).toISOString().slice(0, 10);
        if (Number.isFinite(close) && close > 0 && !seenDates.has(date)) {
          seenDates.add(date);
          results.push({ date, dvol: close });
        }
      }

      const continuation = page.result.continuation;
      if (
        continuation === null ||
        continuation === undefined ||
        page.result.data.length < MAX_CANDLES_PER_REQUEST
      ) {
        break;
      }
      endTimestampMs = continuation;
    }

    return results.sort((a, b) => a.date.localeCompare(b.date));
  }

  // Lightweight fetch of the most recent BTC DVOL reading, for the daily refresh job.
  async fetchBtcDvolLatest(): Promise<{ date: string; value: number }> {
    const endTimestampMs = this.now().getTime();
    const startTimestampMs = endTimestampMs - 5 * 86_400_000;
    const url = `${this.baseUrl}/public/get_volatility_index_data?currency=BTC&start_timestamp=${startTimestampMs}&end_timestamp=${endTimestampMs}&resolution=1D`;

    const page = await retryWithBackoff(
      async (): Promise<DeribitVolatilityIndexResponse> => {
        const response = await this.fetchFn(url);
        if (!response.ok) {
          throw new DeribitClientError(
            `Deribit request failed with status ${response.status}`,
            response.status,
          );
        }
        return (await response.json()) as DeribitVolatilityIndexResponse;
      },
      this.retryAttempts,
      this.retryBaseDelayMs,
      { sleep: this.sleep, shouldRetry: isRetryableDeribitError },
    );

    for (let i = page.result.data.length - 1; i >= 0; i--) {
      const candle = page.result.data[i]!;
      const [timestampMs, , , , close] = candle;
      if (Number.isFinite(close) && close > 0) {
        return { date: new Date(timestampMs).toISOString().slice(0, 10), value: close };
      }
    }

    throw new DeribitClientError('Deribit DVOL response contained no valid data');
  }
}

function isRetryableDeribitError(error: unknown): boolean {
  if (!(error instanceof DeribitClientError)) {
    return true;
  }

  return error.statusCode === undefined || error.statusCode === 429 || error.statusCode >= 500;
}

export class DeribitClientError extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}
