import { BaseRepository } from './base.repository';

export type ChartTimeframe = '1m' | '3m' | '6m' | '1y' | '2y' | 'all';

export interface ChartDataRow {
  date: string;
  priceUsd: number;
  rainbowBand: number | null;
  ma111: number | null;
  ma350: number | null;
  stockToFlowRatio: number | null;
  lastUpdated: string | null;
}

interface ChartDataDbRow {
  date: string | Date;
  price_usd: string | number;
  rainbow_band: string | number | null;
  ma_111_day: string | number | null;
  ma_350_day: string | number | null;
  stock_to_flow_ratio: string | number | null;
  last_updated: string | Date | null;
}

interface Queryable {
  query(sql: string, values?: unknown[]): Promise<{ rows: ChartDataDbRow[] }>;
}

const TIMEFRAME_DAYS: Record<Exclude<ChartTimeframe, 'all'>, number> = {
  '1m': 30,
  '3m': 90,
  '6m': 180,
  '1y': 365,
  '2y': 730,
};

export class ChartDataRepository extends BaseRepository {
  constructor(private readonly database: Queryable) {
    super();
  }

  async findBitcoinChartData(timeframe: ChartTimeframe, today = new Date()): Promise<ChartDataRow[]> {
    const startDate = timeframe === 'all' ? '2009-01-03' : getStartDate(today, TIMEFRAME_DAYS[timeframe]);
    const result = await this.database.query(
      `
        SELECT
          price.date,
          price.price_usd,
          rainbow.metric_value AS rainbow_band,
          ma111.metric_value AS ma_111_day,
          ma350.metric_value AS ma_350_day,
          stock_to_flow.metric_value AS stock_to_flow_ratio,
          GREATEST(
            price.created_at,
            COALESCE(rainbow.created_at, price.created_at),
            COALESCE(ma111.created_at, price.created_at),
            COALESCE(ma350.created_at, price.created_at),
            COALESCE(stock_to_flow.created_at, price.created_at)
          ) AS last_updated
        FROM bitcoin_price_daily price
        LEFT JOIN bitcoin_metrics_daily rainbow
          ON rainbow.date = price.date
          AND rainbow.metric_name = 'rainbow_band'
        LEFT JOIN bitcoin_metrics_daily ma111
          ON ma111.date = price.date
          AND ma111.metric_name = 'ma_111_day'
        LEFT JOIN bitcoin_metrics_daily ma350
          ON ma350.date = price.date
          AND ma350.metric_name = 'ma_350_day'
        LEFT JOIN bitcoin_metrics_daily stock_to_flow
          ON stock_to_flow.date = price.date
          AND stock_to_flow.metric_name = 'stock_to_flow_ratio'
        WHERE price.date >= $1::date
        ORDER BY price.date ASC
      `,
      [startDate],
    );

    return result.rows.map(toChartDataRow);
  }
}

function getStartDate(today: Date, days: number): string {
  const startDate = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  startDate.setUTCDate(startDate.getUTCDate() - days);

  return startDate.toISOString().slice(0, 10);
}

function toChartDataRow(row: ChartDataDbRow): ChartDataRow {
  return {
    date: formatDate(row.date),
    priceUsd: Number(row.price_usd),
    rainbowBand: nullableNumber(row.rainbow_band),
    ma111: nullableNumber(row.ma_111_day),
    ma350: nullableNumber(row.ma_350_day),
    stockToFlowRatio: nullableNumber(row.stock_to_flow_ratio),
    lastUpdated: row.last_updated === null ? null : formatTimestamp(row.last_updated),
  };
}

function nullableNumber(value: string | number | null): number | null {
  return value === null ? null : Number(value);
}

function formatDate(value: string | Date): string {
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }

  return value;
}

function formatTimestamp(value: string | Date): string {
  if (value instanceof Date) {
    return value.toISOString();
  }

  return new Date(value).toISOString();
}
