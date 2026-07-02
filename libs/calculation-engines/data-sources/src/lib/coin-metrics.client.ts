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

export interface CoinMetricsExchangeReservePoint {
  date: string;
  exchangeReserve: number;
}

export interface CoinMetricsExchangeNetflowPoint {
  date: string;
  netflow: number;
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

interface CoinMetricsSupplyRow {
  asset: string;
  time: string;
  SplyExNtv: string | null;
}

interface CoinMetricsSupplyResponse {
  data: CoinMetricsSupplyRow[];
  next_page_url: string | null;
}

interface CoinMetricsFlowRow {
  asset: string;
  time: string;
  FlowInExNtv: string | null;
  FlowOutExNtv: string | null;
}

interface CoinMetricsFlowResponse {
  data: CoinMetricsFlowRow[];
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

  // BTC supply held in known exchange wallets (aggregated across exchanges) — CoinMetrics
  // community tier metric SplyExNtv, freely available with full history since 2011-04-24.
  async fetchExchangeReserveHistory(): Promise<CoinMetricsExchangeReservePoint[]> {
    const results: CoinMetricsExchangeReservePoint[] = [];
    let url: string | null =
      `${this.baseUrl}/timeseries/asset-metrics?assets=btc&metrics=SplyExNtv&frequency=1d&page_size=10000`;

    while (url !== null) {
      const pageUrl: string = url;
      const page: CoinMetricsSupplyResponse = await retryWithBackoff(
        async (): Promise<CoinMetricsSupplyResponse> => {
          const response: Response = await this.fetchFn(pageUrl);
          if (!response.ok) {
            throw new CoinMetricsClientError(
              `CoinMetrics request failed with status ${response.status}`,
              response.status,
            );
          }
          return (await response.json()) as CoinMetricsSupplyResponse;
        },
        this.retryAttempts,
        this.retryBaseDelayMs,
        { sleep: this.sleep, shouldRetry: isRetryableCoinMetricsError },
      );

      for (const row of page.data) {
        const supply = Number(row.SplyExNtv);
        if (Number.isFinite(supply) && supply > 0) {
          results.push({ date: row.time.slice(0, 10), exchangeReserve: supply });
        }
      }

      url = page.next_page_url ?? null;
    }

    return results;
  }

  // Lightweight fetch of the most recent exchange-reserve reading, for the daily refresh job.
  async fetchExchangeReserveLatest(): Promise<{ date: string; value: number }> {
    const url = `${this.baseUrl}/timeseries/asset-metrics?assets=btc&metrics=SplyExNtv&frequency=1d&page_size=5`;

    const page = await retryWithBackoff(
      async (): Promise<CoinMetricsSupplyResponse> => {
        const response = await this.fetchFn(url);
        if (!response.ok) {
          throw new CoinMetricsClientError(
            `CoinMetrics request failed with status ${response.status}`,
            response.status,
          );
        }
        return (await response.json()) as CoinMetricsSupplyResponse;
      },
      this.retryAttempts,
      this.retryBaseDelayMs,
      { sleep: this.sleep, shouldRetry: isRetryableCoinMetricsError },
    );

    for (let i = page.data.length - 1; i >= 0; i--) {
      const row = page.data[i]!;
      const supply = Number(row.SplyExNtv);
      if (Number.isFinite(supply) && supply > 0) {
        return { date: row.time.slice(0, 10), value: supply };
      }
    }

    throw new CoinMetricsClientError('CoinMetrics exchange reserve response contained no valid data');
  }

  // Daily net exchange flow (inflow minus outflow), aggregated across known exchange wallets —
  // CoinMetrics community tier metrics FlowInExNtv / FlowOutExNtv. Netflow is computed client-side
  // since the community API doesn't expose a combined net metric.
  async fetchExchangeNetflowHistory(): Promise<CoinMetricsExchangeNetflowPoint[]> {
    const results: CoinMetricsExchangeNetflowPoint[] = [];
    let url: string | null =
      `${this.baseUrl}/timeseries/asset-metrics?assets=btc&metrics=FlowInExNtv,FlowOutExNtv&frequency=1d&page_size=10000`;

    while (url !== null) {
      const pageUrl: string = url;
      const page: CoinMetricsFlowResponse = await retryWithBackoff(
        async (): Promise<CoinMetricsFlowResponse> => {
          const response: Response = await this.fetchFn(pageUrl);
          if (!response.ok) {
            throw new CoinMetricsClientError(
              `CoinMetrics request failed with status ${response.status}`,
              response.status,
            );
          }
          return (await response.json()) as CoinMetricsFlowResponse;
        },
        this.retryAttempts,
        this.retryBaseDelayMs,
        { sleep: this.sleep, shouldRetry: isRetryableCoinMetricsError },
      );

      for (const row of page.data) {
        const flowIn = Number(row.FlowInExNtv);
        const flowOut = Number(row.FlowOutExNtv);
        if (Number.isFinite(flowIn) && Number.isFinite(flowOut)) {
          results.push({ date: row.time.slice(0, 10), netflow: flowIn - flowOut });
        }
      }

      url = page.next_page_url ?? null;
    }

    return results;
  }

  // Lightweight fetch of the most recent exchange-netflow reading, for the daily refresh job.
  async fetchExchangeNetflowLatest(): Promise<{ date: string; value: number }> {
    const url = `${this.baseUrl}/timeseries/asset-metrics?assets=btc&metrics=FlowInExNtv,FlowOutExNtv&frequency=1d&page_size=5`;

    const page = await retryWithBackoff(
      async (): Promise<CoinMetricsFlowResponse> => {
        const response = await this.fetchFn(url);
        if (!response.ok) {
          throw new CoinMetricsClientError(
            `CoinMetrics request failed with status ${response.status}`,
            response.status,
          );
        }
        return (await response.json()) as CoinMetricsFlowResponse;
      },
      this.retryAttempts,
      this.retryBaseDelayMs,
      { sleep: this.sleep, shouldRetry: isRetryableCoinMetricsError },
    );

    for (let i = page.data.length - 1; i >= 0; i--) {
      const row = page.data[i]!;
      const flowIn = Number(row.FlowInExNtv);
      const flowOut = Number(row.FlowOutExNtv);
      if (Number.isFinite(flowIn) && Number.isFinite(flowOut)) {
        return { date: row.time.slice(0, 10), value: flowIn - flowOut };
      }
    }

    throw new CoinMetricsClientError('CoinMetrics exchange netflow response contained no valid data');
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
