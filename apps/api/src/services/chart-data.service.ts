import { BitcoinDataClient } from '@crypto-market-analysis/calculation-engines/data-sources';
import {
  ChartDataRepository,
  type ChartDataRow,
  type ChartTimeframe,
} from '../repositories/chart-data.repository';

export type ChartId = 'bitcoin-rainbow' | 'pi-cycle-top' | 'stock-to-flow' | 'mvrv-z-score' | 'puell-multiple' | 'vdd-multiple';

export interface BitcoinRainbowChartResponse {
  chartId: 'bitcoin-rainbow';
  title: 'Bitcoin Rainbow Price Chart';
  timeframe: ChartTimeframe;
  dataPoints: {
    date: string;
    priceUsd: number;
    rainbowBand: number | null;
  }[];
  lastUpdated: string | null;
}

export interface PiCycleTopChartResponse {
  chartId: 'pi-cycle-top';
  title: 'Pi Cycle Top Indicator';
  timeframe: ChartTimeframe;
  dataPoints: {
    date: string;
    priceUsd: number;
    ma111: number | null;
    ma350x2: number | null;
  }[];
  lastUpdated: string | null;
}

export interface StockToFlowChartResponse {
  chartId: 'stock-to-flow';
  title: 'Stock-to-Flow Model';
  timeframe: ChartTimeframe;
  dataPoints: {
    date: string;
    priceUsd: number;
    stockToFlowRatio: number | null;
    modelPrice: number | null;
  }[];
  lastUpdated: string | null;
}

export interface MvrvZScoreChartResponse {
  chartId: 'mvrv-z-score';
  title: 'MVRV Z-Score';
  timeframe: ChartTimeframe;
  dataPoints: {
    date: string;
    priceUsd: number;
    mvrvZScore: number | null;
  }[];
  lastUpdated: string | null;
}

export interface PuellMultipleChartResponse {
  chartId: 'puell-multiple';
  title: 'Puell Multiple';
  timeframe: ChartTimeframe;
  dataPoints: {
    date: string;
    priceUsd: number;
  }[];
  lastUpdated: string | null;
}

export interface VddMultipleChartResponse {
  chartId: 'vdd-multiple';
  title: 'VDD Multiple';
  timeframe: ChartTimeframe;
  dataPoints: {
    date: string;
    priceUsd: number;
    vddMultiple: number | null;
  }[];
  lastUpdated: string | null;
}

export type ChartDataResponse =
  | BitcoinRainbowChartResponse
  | PiCycleTopChartResponse
  | StockToFlowChartResponse
  | MvrvZScoreChartResponse
  | PuellMultipleChartResponse
  | VddMultipleChartResponse;

export class ChartDataRequestError extends Error {
  constructor(
    message: string,
    readonly statusCode: number,
  ) {
    super(message);
  }
}

export class ChartDataService {
  constructor(
    private readonly repository: Pick<ChartDataRepository, 'findBitcoinChartData'>,
    private readonly now: () => Date = () => new Date(),
    private readonly bitcoinDataClient: Pick<BitcoinDataClient, 'fetchVddMultipleHistory'> = new BitcoinDataClient(),
  ) {}

  async getChartData(chartId: ChartId, timeframeInput: unknown): Promise<ChartDataResponse> {
    const timeframe = parseTimeframe(timeframeInput);
    const rows = await this.repository.findBitcoinChartData(timeframe, this.now());
    const lastUpdated = getLastUpdated(rows);

    if (chartId === 'bitcoin-rainbow') {
      return {
        chartId,
        title: 'Bitcoin Rainbow Price Chart',
        timeframe,
        dataPoints: rows.map((row) => ({
          date: row.date,
          priceUsd: row.priceUsd,
          rainbowBand: row.rainbowBand,
        })),
        lastUpdated,
      };
    }

    if (chartId === 'pi-cycle-top') {
      return {
        chartId,
        title: 'Pi Cycle Top Indicator',
        timeframe,
        dataPoints: rows.map((row) => ({
          date: row.date,
          priceUsd: row.priceUsd,
          ma111: row.ma111,
          ma350x2: row.ma350 === null ? null : row.ma350 * 2,
        })),
        lastUpdated,
      };
    }

    if (chartId === 'stock-to-flow') {
      return {
        chartId,
        title: 'Stock-to-Flow Model',
        timeframe,
        dataPoints: rows.map((row) => {
          const s2f = calculateS2F(row.date);
          return {
            date: row.date,
            priceUsd: row.priceUsd,
            stockToFlowRatio: s2f.ratio,
            modelPrice: s2f.modelPrice,
          };
        }),
        lastUpdated,
      };
    }

    if (chartId === 'mvrv-z-score') {
      return {
        chartId,
        title: 'MVRV Z-Score',
        timeframe,
        dataPoints: rows.map((row) => ({
          date: row.date,
          priceUsd: row.priceUsd,
          mvrvZScore: row.mvrvZScore,
        })),
        lastUpdated,
      };
    }

    if (chartId === 'vdd-multiple') {
      const lastUpdated = getLastUpdated(rows);

      // Use VDD stored in DB; fall back to bitcoin-data.com only when DB has no values yet
      let vddByDate = new Map<string, number>(
        rows
          .filter((r): r is ChartDataRow & { vddMultiple: number } => r.vddMultiple !== null)
          .map((r) => [r.date, r.vddMultiple]),
      );

      if (vddByDate.size === 0) {
        let vddPoints: { date: string; value: number }[] = [];
        try {
          vddPoints = await this.bitcoinDataClient.fetchVddMultipleHistory();
        } catch {
          // leave vddPoints empty; vddMultiple values will be null
        }
        vddByDate = new Map(vddPoints.map((p) => [p.date, p.value]));
      }

      // For "all", start from the first date we have VDD data (not BTC genesis)
      const firstVddDate = [...vddByDate.keys()].sort()[0] ?? '2022-01-01';
      const startDate = timeframe === 'all' ? firstVddDate : getTimeframeStartDate(timeframe, this.now());
      const filteredDataPoints: VddMultipleChartResponse['dataPoints'] = rows
        .filter((row) => row.date >= startDate)
        .map((row) => ({
          date: row.date,
          priceUsd: row.priceUsd,
          vddMultiple: vddByDate.get(row.date) ?? null,
        }));

      return {
        chartId: 'vdd-multiple',
        title: 'VDD Multiple',
        timeframe,
        dataPoints: filteredDataPoints,
        lastUpdated,
      };
    }

    return {
      chartId: 'puell-multiple',
      title: 'Puell Multiple',
      timeframe,
      dataPoints: rows.map((row) => ({
        date: row.date,
        priceUsd: row.priceUsd,
      })),
      lastUpdated,
    };
  }
}

export function parseTimeframe(value: unknown): ChartTimeframe {
  if (value === undefined) {
    return 'all';
  }

  if (
    value === '1m' ||
    value === '3m' ||
    value === '6m' ||
    value === '1y' ||
    value === '2y' ||
    value === 'all'
  ) {
    return value;
  }

  throw new ChartDataRequestError('Unsupported timeframe', 400);
}

function getLastUpdated(rows: ChartDataRow[]): string | null {
  return rows.reduce<string | null>((latest, row) => {
    if (row.lastUpdated === null) {
      return latest;
    }

    return latest === null || row.lastUpdated > latest ? row.lastUpdated : latest;
  }, null);
}

// Each entry: date of halving, new block reward (BTC), cumulative supply at that block
const S2F_HALVINGS = [
  { date: '2009-01-03', blockReward: 50,    supplyAtStart: 0 },
  { date: '2012-11-28', blockReward: 25,    supplyAtStart: 10_500_000 },
  { date: '2016-07-09', blockReward: 12.5,  supplyAtStart: 15_750_000 },
  { date: '2020-05-11', blockReward: 6.25,  supplyAtStart: 18_375_000 },
  { date: '2024-04-19', blockReward: 3.125, supplyAtStart: 19_687_500 },
];

const TIMEFRAME_DAYS: Record<string, number> = { '1m': 30, '3m': 90, '6m': 180, '1y': 365, '2y': 730 };

function getTimeframeStartDate(timeframe: string, now: Date): string {
  const days = TIMEFRAME_DAYS[timeframe] ?? 365;
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

function calculateS2F(date: string): { ratio: number; modelPrice: number } {
  let era = S2F_HALVINGS[0];
  for (const h of S2F_HALVINGS) {
    if (date >= h.date) era = h;
  }

  const eraMs = new Date(`${era.date}T00:00:00.000Z`).getTime();
  const dateMs = new Date(`${date}T00:00:00.000Z`).getTime();
  const daysSinceEra = Math.floor((dateMs - eraMs) / 86_400_000);

  const stock = era.supplyAtStart + era.blockReward * 144 * daysSinceEra;
  const flow = era.blockReward * 144 * 365.25;

  const ratio = stock / flow;
  // PlanB S2F price model: calibrated to match BTC price history across halvings
  const modelPrice = 0.4 * Math.pow(ratio, 3);

  return { ratio, modelPrice };
}
