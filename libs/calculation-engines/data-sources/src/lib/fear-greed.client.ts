import { retryWithBackoff, type RetryWithBackoffOptions } from './retry.util';

export interface FearGreedIndexPoint {
  date: string;
  value: number;
}

export interface FearGreedClientOptions {
  baseUrl?: string;
  fetchFn?: typeof fetch;
  logger?: Pick<Console, 'error'>;
  retryAttempts?: number;
  retryBaseDelayMs?: number;
  sleep?: RetryWithBackoffOptions['sleep'];
}

interface FearGreedApiResponse {
  data?: Array<{
    value?: string;
    timestamp?: string;
  }>;
}

const DEFAULT_BASE_URL = 'https://api.alternative.me/fng/';

export class FearGreedClient {
  private readonly baseUrl: string;
  private readonly fetchFn: typeof fetch;
  private readonly logger: Pick<Console, 'error'>;
  private readonly retryAttempts: number;
  private readonly retryBaseDelayMs: number;
  private readonly sleep: RetryWithBackoffOptions['sleep'];

  constructor(options: FearGreedClientOptions = {}) {
    this.baseUrl = options.baseUrl ?? DEFAULT_BASE_URL;
    this.fetchFn = options.fetchFn ?? fetch;
    this.logger = options.logger ?? console;
    this.retryAttempts = options.retryAttempts ?? 3;
    this.retryBaseDelayMs = options.retryBaseDelayMs ?? 1000;
    this.sleep = options.sleep;
  }

  async fetchLatest(): Promise<FearGreedIndexPoint> {
    return retryWithBackoff(
      () => this.fetchLatestNow(),
      this.retryAttempts,
      this.retryBaseDelayMs,
      {
        sleep: this.sleep,
        shouldRetry: isRetryableFearGreedError,
      },
    );
  }

  private async fetchLatestNow(): Promise<FearGreedIndexPoint> {
    const url = this.createLatestUrl();

    try {
      const response = await this.fetchFn(url);

      if (!response.ok) {
        throw new FearGreedClientError(
          `Fear & Greed Index request failed with status ${response.status}`,
          response.status,
        );
      }

      const payload = (await response.json()) as FearGreedApiResponse;

      return normalizeFearGreedResponse(payload);
    } catch (error) {
      this.logger.error('Fear & Greed Index request failed', {
        timestamp: new Date().toISOString(),
        request: { url },
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  private createLatestUrl(): string {
    const url = new URL(this.baseUrl);
    url.searchParams.set('limit', '1');
    url.searchParams.set('format', 'json');

    return url.toString();
  }
}

function isRetryableFearGreedError(error: unknown): boolean {
  if (!(error instanceof FearGreedClientError)) {
    return true;
  }

  return error.statusCode === undefined || error.statusCode === 429 || error.statusCode >= 500;
}

export class FearGreedClientError extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}

function normalizeFearGreedResponse(response: FearGreedApiResponse): FearGreedIndexPoint {
  const point = response.data?.[0];

  if (!point) {
    throw new FearGreedClientError('Fear & Greed Index response is missing data');
  }

  const value = Number(point.value);

  if (!Number.isFinite(value)) {
    throw new FearGreedClientError('Fear & Greed Index response has an invalid value');
  }

  const timestampSeconds = Number(point.timestamp);

  if (!Number.isFinite(timestampSeconds)) {
    throw new FearGreedClientError('Fear & Greed Index response has an invalid timestamp');
  }

  return {
    date: unixSecondsToIsoDate(timestampSeconds),
    value,
  };
}

function unixSecondsToIsoDate(seconds: number): string {
  return new Date(seconds * 1000).toISOString().slice(0, 10);
}
