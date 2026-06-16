import type { ChartTimeframe } from '@crypto-market-analysis/data-access/api-client';

export const DEFAULT_CHART_TIMEFRAME: ChartTimeframe = 'all';

const VALID_TIMEFRAMES: readonly ChartTimeframe[] = ['1m', '3m', '6m', '1y', '2y', 'all'];

export function isChartTimeframe(value: string | null): value is ChartTimeframe {
  return value !== null && (VALID_TIMEFRAMES as readonly string[]).includes(value);
}

export function parseChartTimeframe(value: string | null): ChartTimeframe {
  return isChartTimeframe(value) ? value : DEFAULT_CHART_TIMEFRAME;
}
