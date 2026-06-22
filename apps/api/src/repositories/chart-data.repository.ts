import { BaseRepository } from './base.repository';

export type ChartTimeframe = '1m' | '3m' | '6m' | '1y' | '2y' | 'all';

export interface ChartDataRow {
  date: string;
  priceUsd: number;
  rainbowBand: number | null;
  ma111: number | null;
  ma350: number | null;
  stockToFlowRatio: number | null;
  mvrvZScore: number | null;
  coinDaysDestroyed: number | null;
  vddMultiple: number | null;
  realizedPrice: number | null;
  circulatingSupply: number | null;
  minerFees: number | null;
  cvdd: number | null;
  balancedPrice: number | null;
  terminalPrice: number | null;
  fearGreedIndex: number | null;
  hashRate: number | null;
  miningDifficulty: number | null;
  transactionVolumeUsd: number | null;
  minersRevenueUsd: number | null;
  lastUpdated: string | null;
}

interface ChartDataDbRow {
  date: string | Date;
  price_usd: string | number;
  rainbow_band: string | number | null;
  ma_111_day: string | number | null;
  ma_350_day: string | number | null;
  stock_to_flow_ratio: string | number | null;
  mvrv_zscore: string | number | null;
  coin_days_destroyed: string | number | null;
  vdd_multiple: string | number | null;
  realized_price: string | number | null;
  circulating_supply: string | number | null;
  miner_fees: string | number | null;
  cvdd: string | number | null;
  balanced_price: string | number | null;
  terminal_price: string | number | null;
  fear_greed_index: string | number | null;
  hash_rate: string | number | null;
  mining_difficulty: string | number | null;
  transaction_volume_usd: string | number | null;
  miners_revenue_usd: string | number | null;
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
          price.circulating_supply,
          rainbow.metric_value AS rainbow_band,
          ma111.metric_value AS ma_111_day,
          ma350.metric_value AS ma_350_day,
          stock_to_flow.metric_value AS stock_to_flow_ratio,
          mvrv.metric_value AS mvrv_zscore,
          cdd.metric_value AS coin_days_destroyed,
          vdd.metric_value AS vdd_multiple,
          rp.metric_value AS realized_price,
          mf.metric_value AS miner_fees,
          cvdd_m.metric_value AS cvdd,
          bp_m.metric_value AS balanced_price,
          tp_m.metric_value AS terminal_price,
          fg_m.metric_value AS fear_greed_index,
          hr_m.metric_value AS hash_rate,
          diff_m.metric_value AS mining_difficulty,
          txvol_m.metric_value AS transaction_volume_usd,
          minrev_m.metric_value AS miners_revenue_usd,
          GREATEST(
            price.created_at,
            COALESCE(rainbow.created_at, price.created_at),
            COALESCE(ma111.created_at, price.created_at),
            COALESCE(ma350.created_at, price.created_at),
            COALESCE(stock_to_flow.created_at, price.created_at),
            COALESCE(mvrv.created_at, price.created_at),
            COALESCE(cdd.created_at, price.created_at),
            COALESCE(vdd.created_at, price.created_at),
            COALESCE(rp.created_at, price.created_at),
            COALESCE(mf.created_at, price.created_at),
            COALESCE(cvdd_m.created_at, price.created_at),
            COALESCE(bp_m.created_at, price.created_at),
            COALESCE(tp_m.created_at, price.created_at),
            COALESCE(fg_m.created_at, price.created_at),
            COALESCE(hr_m.created_at, price.created_at),
            COALESCE(diff_m.created_at, price.created_at),
            COALESCE(txvol_m.created_at, price.created_at),
            COALESCE(minrev_m.created_at, price.created_at)
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
        LEFT JOIN bitcoin_metrics_daily mvrv
          ON mvrv.date = price.date
          AND mvrv.metric_name = 'mvrv_zscore'
        LEFT JOIN bitcoin_metrics_daily cdd
          ON cdd.date = price.date
          AND cdd.metric_name = 'coin_days_destroyed'
        LEFT JOIN bitcoin_metrics_daily vdd
          ON vdd.date = price.date
          AND vdd.metric_name = 'vdd_multiple'
        LEFT JOIN bitcoin_metrics_daily rp
          ON rp.date = price.date
          AND rp.metric_name = 'realized_price'
        LEFT JOIN bitcoin_metrics_daily mf
          ON mf.date = price.date
          AND mf.metric_name = 'miner_fees'
        LEFT JOIN bitcoin_metrics_daily cvdd_m
          ON cvdd_m.date = price.date
          AND cvdd_m.metric_name = 'cvdd'
        LEFT JOIN bitcoin_metrics_daily bp_m
          ON bp_m.date = price.date
          AND bp_m.metric_name = 'balanced_price'
        LEFT JOIN bitcoin_metrics_daily tp_m
          ON tp_m.date = price.date
          AND tp_m.metric_name = 'terminal_price'
        LEFT JOIN bitcoin_metrics_daily fg_m
          ON fg_m.date = price.date
          AND fg_m.metric_name = 'fear_greed_index'
        LEFT JOIN bitcoin_metrics_daily hr_m
          ON hr_m.date = price.date
          AND hr_m.metric_name = 'hash_rate'
        LEFT JOIN bitcoin_metrics_daily diff_m
          ON diff_m.date = price.date
          AND diff_m.metric_name = 'mining_difficulty'
        LEFT JOIN bitcoin_metrics_daily txvol_m
          ON txvol_m.date = price.date
          AND txvol_m.metric_name = 'transaction_volume_usd'
        LEFT JOIN bitcoin_metrics_daily minrev_m
          ON minrev_m.date = price.date
          AND minrev_m.metric_name = 'miners_revenue_usd'
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
    mvrvZScore: nullableNumber(row.mvrv_zscore),
    coinDaysDestroyed: nullableNumber(row.coin_days_destroyed),
    vddMultiple: nullableNumber(row.vdd_multiple),
    realizedPrice: nullableNumber(row.realized_price),
    circulatingSupply: nullableNumber(row.circulating_supply),
    minerFees: nullableNumber(row.miner_fees),
    cvdd: nullableNumber(row.cvdd),
    balancedPrice: nullableNumber(row.balanced_price),
    terminalPrice: nullableNumber(row.terminal_price),
    fearGreedIndex: nullableNumber(row.fear_greed_index),
    hashRate: nullableNumber(row.hash_rate),
    miningDifficulty: nullableNumber(row.mining_difficulty),
    transactionVolumeUsd: nullableNumber(row.transaction_volume_usd),
    minersRevenueUsd: nullableNumber(row.miners_revenue_usd),
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
