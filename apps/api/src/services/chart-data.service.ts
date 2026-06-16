import {
  ChartDataRepository,
  type ChartDataRow,
  type ChartTimeframe,
} from '../repositories/chart-data.repository';

export type ChartId = 'bitcoin-rainbow' | 'pi-cycle-top' | 'stock-to-flow';

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

export type ChartDataResponse =
  | BitcoinRainbowChartResponse
  | PiCycleTopChartResponse
  | StockToFlowChartResponse;

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

    return {
      chartId,
      title: 'Stock-to-Flow Model',
      timeframe,
      dataPoints: rows.map((row) => ({
        date: row.date,
        priceUsd: row.priceUsd,
        stockToFlowRatio: row.stockToFlowRatio,
        modelPrice: row.stockToFlowRatio === null ? null : row.stockToFlowRatio * 1000,
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
