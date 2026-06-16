import { retryWithBackoff, type RetryWithBackoffOptions } from './retry.util';

export interface MvrvZScorePoint {
  date: string;
  value: number;
}

export interface MvrvZScoreClientOptions {
  baseUrl?: string;
  fetchFn?: typeof fetch;
  logger?: Pick<Console, 'error'>;
  retryAttempts?: number;
  retryBaseDelayMs?: number;
  sleep?: RetryWithBackoffOptions['sleep'];
}

interface MvrvZScoreApiResponse {
  d?: string;
  mvrvZscore?: number | string;
}

const DEFAULT_BASE_URL = 'https://bitcoin-data.com/v1';

export class MvrvZScoreClient {
  private readonly baseUrl: string;
  private readonly fetchFn: typeof fetch;
  private readonly logger: Pick<Console, 'error'>;
  private readonly retryAttempts: number;
  private readonly retryBaseDelayMs: number;
  private readonly sleep: RetryWithBackoffOptions['sleep'];

  constructor(options: MvrvZScoreClientOptions = {}) {
    this.baseUrl = options.baseUrl ?? DEFAULT_BASE_URL;
    this.fetchFn = options.fetchFn ?? fetch;
    this.logger = options.logger ?? console;
    this.retryAttempts = options.retryAttempts ?? 3;
    this.retryBaseDelayMs = options.retryBaseDelayMs ?? 1000;
    this.sleep = options.sleep;
  }

  async fetchLatest(): Promise<MvrvZScorePoint> {
    return retryWithBackoff(
      () => this.fetchLatestNow(),
      this.retryAttempts,
      this.retryBaseDelayMs,
      {
        sleep: this.sleep,
        shouldRetry: isRetryableMvrvZScoreError,
      },
    );
  }

  private async fetchLatestNow(): Promise<MvrvZScorePoint> {
    const url = this.createLatestUrl();

    try {
      const response = await this.fetchFn(url);

      if (!response.ok) {
        throw new MvrvZScoreClientError(
          `MVRV Z-Score request failed with status ${response.status}`,
          response.status,
        );
      }

      const payload = (await response.json()) as MvrvZScoreApiResponse;

      return normalizeMvrvZScoreResponse(payload);
    } catch (error) {
      this.logger.error('MVRV Z-Score request failed', {
        timestamp: new Date().toISOString(),
        request: { url },
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  private createLatestUrl(): string {
    return new URL('mvrv-zscore/last', ensureTrailingSlash(this.baseUrl)).toString();
  }
}

function isRetryableMvrvZScoreError(error: unknown): boolean {
  if (!(error instanceof MvrvZScoreClientError)) {
    return true;
  }

  return error.statusCode === undefined || error.statusCode === 429 || error.statusCode >= 500;
}

export class MvrvZScoreClientError extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}

function normalizeMvrvZScoreResponse(response: MvrvZScoreApiResponse): MvrvZScorePoint {
  if (!response.d) {
    throw new MvrvZScoreClientError('MVRV Z-Score response is missing a date');
  }

  const value = Number(response.mvrvZscore);

  if (!Number.isFinite(value)) {
    throw new MvrvZScoreClientError('MVRV Z-Score response has an invalid value');
  }

  return {
    date: response.d,
    value,
  };
}

function ensureTrailingSlash(value: string): string {
  return value.endsWith('/') ? value : `${value}/`;
}
