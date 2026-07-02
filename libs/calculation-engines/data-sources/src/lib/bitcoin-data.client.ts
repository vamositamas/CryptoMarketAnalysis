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

  async fetchVddMultiple(): Promise<BitcoinDataPoint> {
    return this.fetchLatest('vdd-multiple', 'vddMultiple', 'VDD Multiple');
  }

  async fetchCvdd(): Promise<BitcoinDataPoint> {
    return this.fetchLatest('cvdd', 'cvdd', 'CVDD');
  }

  async fetchBalancedPrice(): Promise<BitcoinDataPoint> {
    return this.fetchLatest('balanced-price', 'balancedPrice', 'Balanced Price');
  }

  async fetchTerminalPrice(): Promise<BitcoinDataPoint> {
    return this.fetchLatest('terminal-price', 'terminalPrice', 'Terminal Price');
  }

  async fetchLthSopr(): Promise<BitcoinDataPoint> {
    return this.fetchLatest('lth-sopr', 'lthSopr', 'LTH SOPR');
  }

  async fetchSthSopr(): Promise<BitcoinDataPoint> {
    return this.fetchLatest('sth-sopr', 'sthSopr', 'STH SOPR');
  }

  async fetchMvrvZScoreHistory(): Promise<BitcoinDataPoint[]> {
    return retryWithBackoff(
      async () => {
        const url = new URL('mvrv-zscore', ensureTrailingSlash(this.baseUrl)).toString();
        const response = await this.fetchFn(url);
        if (!response.ok) {
          throw new BitcoinDataClientError(
            `MVRV Z-Score history request failed with status ${response.status}`,
            response.status,
          );
        }
        const rows = (await response.json()) as { d: string; mvrvZscore: number }[];
        return rows
          .filter((r) => typeof r.d === 'string' && Number.isFinite(r.mvrvZscore))
          .map((r) => ({ date: r.d, value: r.mvrvZscore }));
      },
      this.retryAttempts,
      this.retryBaseDelayMs,
      { sleep: this.sleep, shouldRetry: isRetryableBitcoinDataError },
    );
  }

  async fetchVddMultipleHistory(): Promise<BitcoinDataPoint[]> {
    return retryWithBackoff(
      async () => {
        const url = new URL('vdd-multiple', ensureTrailingSlash(this.baseUrl)).toString();
        const response = await this.fetchFn(url);
        if (!response.ok) {
          throw new BitcoinDataClientError(
            `VDD Multiple history request failed with status ${response.status}`,
            response.status,
          );
        }
        const rows = (await response.json()) as { d: string; vddMultiple: number }[];
        return rows
          .filter((r) => typeof r.d === 'string' && Number.isFinite(r.vddMultiple))
          .map((r) => ({ date: r.d, value: r.vddMultiple }));
      },
      this.retryAttempts,
      this.retryBaseDelayMs,
      { sleep: this.sleep, shouldRetry: isRetryableBitcoinDataError },
    );
  }

  async fetchRealizedPriceHistory(): Promise<BitcoinDataPoint[]> {
    return retryWithBackoff(
      async () => {
        const url = new URL('realized-price', ensureTrailingSlash(this.baseUrl)).toString();
        const response = await this.fetchFn(url);
        if (!response.ok) {
          throw new BitcoinDataClientError(
            `Realized Price history request failed with status ${response.status}`,
            response.status,
          );
        }
        const rows = (await response.json()) as { d: string; realizedPrice: number }[];
        return rows
          .filter((r) => typeof r.d === 'string' && Number.isFinite(r.realizedPrice))
          .map((r) => ({ date: r.d, value: r.realizedPrice }));
      },
      this.retryAttempts,
      this.retryBaseDelayMs,
      { sleep: this.sleep, shouldRetry: isRetryableBitcoinDataError },
    );
  }

  async fetchCvddHistory(): Promise<BitcoinDataPoint[]> {
    return retryWithBackoff(
      async () => {
        const url = new URL('cvdd', ensureTrailingSlash(this.baseUrl)).toString();
        const response = await this.fetchFn(url);
        if (!response.ok) {
          throw new BitcoinDataClientError(`CVDD history request failed with status ${response.status}`, response.status);
        }
        const rows = (await response.json()) as BitcoinDataApiResponse[];
        return rows
          .map((r) => normalizeHistoryPoint(r, ['cvdd']))
          .filter((p): p is BitcoinDataPoint => p !== null);
      },
      this.retryAttempts,
      this.retryBaseDelayMs,
      { sleep: this.sleep, shouldRetry: isRetryableBitcoinDataError },
    );
  }

  async fetchBalancedPriceHistory(): Promise<BitcoinDataPoint[]> {
    return retryWithBackoff(
      async () => {
        const url = new URL('balanced-price', ensureTrailingSlash(this.baseUrl)).toString();
        const response = await this.fetchFn(url);
        if (!response.ok) {
          throw new BitcoinDataClientError(`Balanced Price history request failed with status ${response.status}`, response.status);
        }
        const rows = (await response.json()) as BitcoinDataApiResponse[];
        return rows
          .map((r) => normalizeHistoryPoint(r, ['balancedPrice', 'balanced_price', 'balanced-price']))
          .filter((p): p is BitcoinDataPoint => p !== null);
      },
      this.retryAttempts,
      this.retryBaseDelayMs,
      { sleep: this.sleep, shouldRetry: isRetryableBitcoinDataError },
    );
  }

  async fetchTerminalPriceHistory(): Promise<BitcoinDataPoint[]> {
    return retryWithBackoff(
      async () => {
        const url = new URL('terminal-price', ensureTrailingSlash(this.baseUrl)).toString();
        const response = await this.fetchFn(url);
        if (!response.ok) {
          throw new BitcoinDataClientError(`Terminal Price history request failed with status ${response.status}`, response.status);
        }
        const rows = (await response.json()) as BitcoinDataApiResponse[];
        return rows
          .map((r) => normalizeHistoryPoint(r, ['terminalPrice', 'terminal_price', 'terminal-price']))
          .filter((p): p is BitcoinDataPoint => p !== null);
      },
      this.retryAttempts,
      this.retryBaseDelayMs,
      { sleep: this.sleep, shouldRetry: isRetryableBitcoinDataError },
    );
  }

  async fetchLthSoprHistory(): Promise<BitcoinDataPoint[]> {
    return retryWithBackoff(
      async () => {
        const url = new URL('lth-sopr', ensureTrailingSlash(this.baseUrl)).toString();
        const response = await this.fetchFn(url);
        if (!response.ok) {
          throw new BitcoinDataClientError(`LTH SOPR history request failed with status ${response.status}`, response.status);
        }
        const rows = (await response.json()) as BitcoinDataApiResponse[];
        return rows
          .map((r) => normalizeHistoryPoint(r, ['lthSopr']))
          .filter((p): p is BitcoinDataPoint => p !== null);
      },
      this.retryAttempts,
      this.retryBaseDelayMs,
      { sleep: this.sleep, shouldRetry: isRetryableBitcoinDataError },
    );
  }

  async fetchSthSoprHistory(): Promise<BitcoinDataPoint[]> {
    return retryWithBackoff(
      async () => {
        const url = new URL('sth-sopr', ensureTrailingSlash(this.baseUrl)).toString();
        const response = await this.fetchFn(url);
        if (!response.ok) {
          throw new BitcoinDataClientError(`STH SOPR history request failed with status ${response.status}`, response.status);
        }
        const rows = (await response.json()) as BitcoinDataApiResponse[];
        return rows
          .map((r) => normalizeHistoryPoint(r, ['sthSopr']))
          .filter((p): p is BitcoinDataPoint => p !== null);
      },
      this.retryAttempts,
      this.retryBaseDelayMs,
      { sleep: this.sleep, shouldRetry: isRetryableBitcoinDataError },
    );
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

function normalizeHistoryPoint(
  response: BitcoinDataApiResponse,
  valueFields: string[],
): BitcoinDataPoint | null {
  if (typeof response.d !== 'string') {
    return null;
  }

  for (const field of valueFields) {
    const value = Number(response[field]);
    if (Number.isFinite(value)) {
      return { date: response.d, value };
    }
  }

  return null;
}

function ensureTrailingSlash(value: string): string {
  return value.endsWith('/') ? value : `${value}/`;
}
