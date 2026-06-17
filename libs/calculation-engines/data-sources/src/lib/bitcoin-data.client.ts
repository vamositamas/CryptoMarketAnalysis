import { retryWithBackoff, type RetryWithBackoffOptions } from './retry.util';

export interface BitcoinDataPoint {
  date: string;
  value: number;
}

export interface BitcoinDataClientOptions {
  baseUrl?: string;
  fetchFn?: typeof fetch;
  logger?: Pick<Console, 'error'>;
  retryAttempts?: number;
  retryBaseDelayMs?: number;
  sleep?: RetryWithBackoffOptions['sleep'];
}

interface BitcoinDataApiResponse {
  d?: string;
  [field: string]: unknown;
}

const DEFAULT_BASE_URL = 'https://bitcoin-data.com/v1';

export class BitcoinDataClient {
  private readonly baseUrl: string;
  private readonly fetchFn: typeof fetch;
  private readonly logger: Pick<Console, 'error'>;
  private readonly retryAttempts: number;
  private readonly retryBaseDelayMs: number;
  private readonly sleep: RetryWithBackoffOptions['sleep'];

  constructor(options: BitcoinDataClientOptions = {}) {
    this.baseUrl = options.baseUrl ?? DEFAULT_BASE_URL;
    this.fetchFn = options.fetchFn ?? fetch;
    this.logger = options.logger ?? console;
    this.retryAttempts = options.retryAttempts ?? 3;
    this.retryBaseDelayMs = options.retryBaseDelayMs ?? 1000;
    this.sleep = options.sleep;
  }

  async fetchMvrvZScore(): Promise<BitcoinDataPoint> {
    return this.fetchLatest('mvrv-zscore', 'mvrvZscore', 'MVRV Z-Score');
  }

  async fetchRealizedPrice(): Promise<BitcoinDataPoint> {
    return this.fetchLatest('realized-price', 'realizedPrice', 'Realized Price');
  }

  private async fetchLatest(
    endpoint: string,
    valueField: string,
    label: string,
  ): Promise<BitcoinDataPoint> {
    return retryWithBackoff(
      () => this.fetchLatestNow(endpoint, valueField, label),
      this.retryAttempts,
      this.retryBaseDelayMs,
      {
        sleep: this.sleep,
        shouldRetry: isRetryableBitcoinDataError,
      },
    );
  }

  private async fetchLatestNow(
    endpoint: string,
    valueField: string,
    label: string,
  ): Promise<BitcoinDataPoint> {
    const url = this.createLatestUrl(endpoint);

    try {
      const response = await this.fetchFn(url);

      if (!response.ok) {
        throw new BitcoinDataClientError(
          `${label} request failed with status ${response.status}`,
          response.status,
        );
      }

      const payload = (await response.json()) as BitcoinDataApiResponse;

      return normalizeBitcoinDataResponse(payload, valueField, label);
    } catch (error) {
      this.logger.error(`${label} request failed`, {
        timestamp: new Date().toISOString(),
        request: { url },
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  private createLatestUrl(endpoint: string): string {
    return new URL(`${endpoint}/last`, ensureTrailingSlash(this.baseUrl)).toString();
  }
}

function isRetryableBitcoinDataError(error: unknown): boolean {
  if (!(error instanceof BitcoinDataClientError)) {
    return true;
  }

  return error.statusCode === undefined || error.statusCode === 429 || error.statusCode >= 500;
}

export class BitcoinDataClientError extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}

function normalizeBitcoinDataResponse(
  response: BitcoinDataApiResponse,
  valueField: string,
  label: string,
): BitcoinDataPoint {
  if (!response.d) {
    throw new BitcoinDataClientError(`${label} response is missing a date`);
  }

  const value = Number(response[valueField]);

  if (!Number.isFinite(value)) {
    throw new BitcoinDataClientError(`${label} response has an invalid value`);
  }

  return {
    date: response.d,
    value,
  };
}

function ensureTrailingSlash(value: string): string {
  return value.endsWith('/') ? value : `${value}/`;
}
