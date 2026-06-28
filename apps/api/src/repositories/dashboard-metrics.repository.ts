export interface MetricPoint {
  date: string;
  value: number;
}

export interface FormulaVariableValues {
  [key: string]: number | null;
  btc_price: number | null;
  btc_price_24h_change: number | null;
  market_cap: number | null;
  circulating_supply: number | null;
  stock_to_flow: number | null;
  mvrv_zscore: number | null;
  nupl: number | null;
  fear_greed_index: number | null;
  global_m2_yoy: number | null;
}

interface MetricPointRow {
  date: string | Date;
  value: string | number;
}

interface PriceRow {
  date: string | Date;
  price_usd: string | number;
  market_cap_usd: string | number | null;
  circulating_supply: string | number | null;
}

interface MetricNameValueRow {
  metric_name: string;
  metric_value: string | number;
}

interface Queryable {
  query<Row = MetricPointRow>(sql: string, values?: unknown[]): Promise<{ rows: Row[] }>;
}

interface SystemConfigRow {
  value: string;
}

export class DashboardMetricsRepository {
  constructor(private readonly database: Queryable) {}

  async getLastRefreshTimestamp(): Promise<string | null> {
    const result = await this.database.query<SystemConfigRow>(
      `SELECT value FROM system_configuration WHERE key = 'last_refresh_timestamp' LIMIT 1`,
    );
    return result.rows[0]?.value ?? null;
  }

  async getLatestPrices(limit = 2): Promise<MetricPoint[]> {
    const result = await this.database.query(
      `
        SELECT date, price_usd AS value
        FROM bitcoin_price_daily
        ORDER BY date DESC
        LIMIT $1
      `,
      [limit],
    );

    return result.rows.map(toMetricPoint);
  }

  async getLatestMetricValues(metricName: string, limit = 2): Promise<MetricPoint[]> {
    const result = await this.database.query(
      `
        SELECT date, metric_value AS value
        FROM bitcoin_metrics_daily
        WHERE metric_name = $1
        ORDER BY date DESC
        LIMIT $2
      `,
      [metricName, limit],
    );

    return result.rows.map(toMetricPoint);
  }

  async getLatestCirculatingSupply(limit = 2): Promise<MetricPoint[]> {
    const result = await this.database.query(
      `
        SELECT date, circulating_supply AS value
        FROM bitcoin_price_daily
        WHERE circulating_supply IS NOT NULL
        ORDER BY date DESC
        LIMIT $1
      `,
      [limit],
    );

    return result.rows.map(toMetricPoint);
  }

  async getLatestMarketCap(limit = 2): Promise<MetricPoint[]> {
    const result = await this.database.query(
      `
        SELECT date, market_cap_usd AS value
        FROM bitcoin_price_daily
        WHERE market_cap_usd IS NOT NULL
        ORDER BY date DESC
        LIMIT $1
      `,
      [limit],
    );

    return result.rows.map(toMetricPoint);
  }

  async getLatestFormulaVariables(): Promise<FormulaVariableValues> {
    const [priceResult, metricsResult] = await Promise.all([
      this.database.query<PriceRow>(
        `
          SELECT date, price_usd, market_cap_usd, circulating_supply
          FROM bitcoin_price_daily
          ORDER BY date DESC
          LIMIT 2
        `,
      ),
      this.database.query<MetricNameValueRow>(
        `
          SELECT DISTINCT ON (metric_name) metric_name, metric_value
          FROM bitcoin_metrics_daily
          WHERE metric_name IN ('stock_to_flow_ratio', 'mvrv_zscore', 'fear_greed_index', 'realized_price', 'global_m2_yoy')
          ORDER BY metric_name, date DESC
        `,
      ),
    ]);

    const latest = priceResult.rows[0] ?? null;
    const previous = priceResult.rows[1] ?? null;

    const btcPrice = latest ? Number(latest.price_usd) : null;
    const prevPrice = previous ? Number(previous.price_usd) : null;
    let btcPrice24hChange: number | null = null;

    if (btcPrice !== null && prevPrice !== null && prevPrice !== 0) {
      btcPrice24hChange = ((btcPrice - prevPrice) / Math.abs(prevPrice)) * 100;
    }

    const metricMap = new Map<string, number>();

    for (const row of metricsResult.rows) {
      metricMap.set(row.metric_name, Number(row.metric_value));
    }

    return {
      btc_price: btcPrice,
      btc_price_24h_change: btcPrice24hChange,
      market_cap: latest?.market_cap_usd != null ? Number(latest.market_cap_usd) : null,
      circulating_supply: latest?.circulating_supply != null ? Number(latest.circulating_supply) : null,
      stock_to_flow: metricMap.get('stock_to_flow_ratio') ?? null,
      mvrv_zscore: metricMap.get('mvrv_zscore') ?? null,
      nupl: btcPrice !== null && metricMap.get('realized_price') != null
        ? ((btcPrice - metricMap.get('realized_price')!) / btcPrice) * 100
        : null,
      fear_greed_index: metricMap.get('fear_greed_index') ?? null,
      global_m2_yoy: metricMap.get('global_m2_yoy') ?? null,
    };
  }
}

function toMetricPoint(row: MetricPointRow): MetricPoint {
  return {
    date: row.date instanceof Date ? row.date.toISOString().slice(0, 10) : row.date,
    value: Number(row.value),
  };
}
