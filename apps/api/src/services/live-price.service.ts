import type { CoinGeckoClient } from '@crypto-market-analysis/calculation-engines/data-sources';

export interface LivePrice {
  priceUsd: number;
  change24hPercent: number | null;
  fetchedAt: string;
}

interface Queryable {
  query<Row>(sql: string, values?: unknown[]): Promise<{ rows: Row[] }>;
}

interface PriceRow {
  price_usd: string | number;
}

const CACHE_TTL_MS = 60_000;

export class LivePriceService {
  private cache: LivePrice | null = null;
  private cacheExpiresAt = 0;
  private inflight: Promise<LivePrice> | null = null;

  constructor(
    private readonly coinGeckoClient: Pick<CoinGeckoClient, 'fetchCurrentBitcoinMarketData'>,
    private readonly database: Queryable,
  ) {}

  async getLivePrice(): Promise<LivePrice> {
    if (this.cache && Date.now() < this.cacheExpiresAt) {
      return this.cache;
    }
    // Deduplicate concurrent callers — only one upstream fetch at a time
    this.inflight ??= this.fetchAndCache().finally(() => { this.inflight = null; });
    return this.inflight;
  }

  private async fetchAndCache(): Promise<LivePrice> {
    const today = new Date().toISOString().slice(0, 10);
    const [record, yesterdayRows] = await Promise.all([
      this.coinGeckoClient.fetchCurrentBitcoinMarketData(today),
      this.database.query<PriceRow>(
        `SELECT price_usd FROM bitcoin_price_daily ORDER BY date DESC OFFSET 1 LIMIT 1`,
      ),
    ]);

    const yesterdayPrice = yesterdayRows.rows[0] ? Number(yesterdayRows.rows[0].price_usd) : null;
    const change24hPercent =
      yesterdayPrice && yesterdayPrice > 0
        ? ((record.priceUsd - yesterdayPrice) / yesterdayPrice) * 100
        : null;

    this.cache = { priceUsd: record.priceUsd, change24hPercent, fetchedAt: new Date().toISOString() };
    this.cacheExpiresAt = Date.now() + CACHE_TTL_MS;
    return this.cache;
  }
}
