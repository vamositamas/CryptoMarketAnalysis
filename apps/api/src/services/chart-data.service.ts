import { BitcoinDataClient } from '@crypto-market-analysis/calculation-engines/data-sources';
import {
  ChartDataRepository,
  type ChartDataRow,
  type ChartTimeframe,
} from '../repositories/chart-data.repository';

export type ChartId = 'bitcoin-rainbow' | 'pi-cycle-top' | 'stock-to-flow' | 'mvrv-z-score' | 'puell-multiple' | 'vdd-multiple' | 'realized-price' | 'stock-to-income' | '2yr-ma-multiplier' | 'price-forecast-tools' | 'mayer-multiple' | '200-week-ma-heatmap' | 'fear-greed-index' | 'hash-ribbons' | 'difficulty-ribbon' | 'nvt-ratio' | 'thermocap-multiple' | 'excess-liquidity' | 'spx-liquidity' | 'midterm-cycles';

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

export interface TwoYrMaMultiplierChartResponse {
  chartId: '2yr-ma-multiplier';
  title: '2-Year MA Multiplier';
  timeframe: ChartTimeframe;
  dataPoints: {
    date: string;
    priceUsd: number;
    ma730: number | null;
    ma730x2: number | null;
    ma730x3: number | null;
    ma730x4: number | null;
    ma730x5: number | null;
  }[];
  lastUpdated: string | null;
}

export interface RealizePriceChartResponse {
  chartId: 'realized-price';
  title: 'Bitcoin Realized Price';
  timeframe: ChartTimeframe;
  dataPoints: {
    date: string;
    priceUsd: number;
    realizedPrice: number | null;
    mvrvRatio: number | null;
  }[];
  lastUpdated: string | null;
}

export interface StockToIncomeChartResponse {
  chartId: 'stock-to-income';
  title: 'Stock to Income Model';
  timeframe: ChartTimeframe;
  dataPoints: {
    date: string;
    priceUsd: number | null;
    modelPrice: number | null;
    upperBand: number | null;
    lowerBand: number | null;
    s2iRatio: number | null;
  }[];
  regressionA: number;
  regressionB: number;
  sigma: number;
  lastUpdated: string | null;
}

export interface PriceForecastToolsChartResponse {
  chartId: 'price-forecast-tools';
  title: 'Price Forecast Tools';
  timeframe: ChartTimeframe;
  dataPoints: {
    date: string;
    priceUsd: number;
    topCap: number | null;
    deltaTop: number | null;
    cvdd: number | null;
    balancedPrice: number | null;
    terminalPrice: number | null;
  }[];
  lastUpdated: string | null;
}

export interface MayerMultipleChartResponse {
  chartId: 'mayer-multiple';
  title: 'Mayer Multiple';
  timeframe: ChartTimeframe;
  dataPoints: { date: string; priceUsd: number; ma200: number | null; mayerMultiple: number | null; }[];
  lastUpdated: string | null;
}

export interface TwoHundredWeekMAHeatmapChartResponse {
  chartId: '200-week-ma-heatmap';
  title: '200-Week Moving Average Heatmap';
  timeframe: ChartTimeframe;
  dataPoints: { date: string; priceUsd: number; ma200w: number | null; multiplier: number | null; }[];
  lastUpdated: string | null;
}

export interface FearGreedIndexChartResponse {
  chartId: 'fear-greed-index';
  title: 'Fear & Greed Index';
  timeframe: ChartTimeframe;
  dataPoints: { date: string; priceUsd: number; fearGreedValue: number | null; }[];
  lastUpdated: string | null;
}

export interface HashRibbonsChartResponse {
  chartId: 'hash-ribbons';
  title: 'Hash Ribbons';
  timeframe: ChartTimeframe;
  dataPoints: { date: string; priceUsd: number; ma30: number | null; ma60: number | null; isBuySignal: boolean; }[];
  lastUpdated: string | null;
}

export interface DifficultyRibbonChartResponse {
  chartId: 'difficulty-ribbon';
  title: 'Difficulty Ribbon';
  timeframe: ChartTimeframe;
  dataPoints: { date: string; priceUsd: number; ma9: number | null; ma14: number | null; ma25: number | null; ma40: number | null; ma60: number | null; ma90: number | null; ma128: number | null; ma200: number | null; }[];
  lastUpdated: string | null;
}

export interface NvtRatioChartResponse {
  chartId: 'nvt-ratio';
  title: 'NVT Ratio';
  timeframe: ChartTimeframe;
  dataPoints: { date: string; priceUsd: number; nvtRatio: number | null; nvtSignal: number | null; }[];
  lastUpdated: string | null;
}

export interface ThermocapMultipleChartResponse {
  chartId: 'thermocap-multiple';
  title: 'Thermocap Multiple';
  timeframe: ChartTimeframe;
  dataPoints: { date: string; priceUsd: number; thermocapMultiple: number | null; }[];
  lastUpdated: string | null;
}

export interface ExcessLiquidityChartResponse {
  chartId: 'excess-liquidity';
  title: 'Excess Liquidity Leading Indicator';
  timeframe: ChartTimeframe;
  dataPoints: { date: string; yieldCurve1yChange: number | null; excessLiquidityLeading: number | null; }[];
  lastUpdated: string | null;
}

export interface SpxLiquidityChartResponse {
  chartId: 'spx-liquidity';
  title: 'S&P 500 vs Excess Liquidity';
  timeframe: ChartTimeframe;
  dataPoints: { date: string; spxYoyChange: number | null; excessLiquidityLeading: number | null; }[];
  lastUpdated: string | null;
}

export interface MidtermCyclesChartResponse {
  chartId: 'midterm-cycles';
  title: 'Midterm Cycles';
  dataPoints: { date: string; btcRsi12m: number | null; spxRsi12m: number | null; ismPmi: number | null; }[];
  lastUpdated: string | null;
}

export type ChartDataResponse =
  | BitcoinRainbowChartResponse
  | PiCycleTopChartResponse
  | StockToFlowChartResponse
  | MvrvZScoreChartResponse
  | PuellMultipleChartResponse
  | VddMultipleChartResponse
  | RealizePriceChartResponse
  | StockToIncomeChartResponse
  | TwoYrMaMultiplierChartResponse
  | PriceForecastToolsChartResponse
  | MayerMultipleChartResponse
  | TwoHundredWeekMAHeatmapChartResponse
  | FearGreedIndexChartResponse
  | HashRibbonsChartResponse
  | DifficultyRibbonChartResponse
  | NvtRatioChartResponse
  | ThermocapMultipleChartResponse
  | ExcessLiquidityChartResponse
  | SpxLiquidityChartResponse
  | MidtermCyclesChartResponse;

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
    private readonly repository: Pick<ChartDataRepository, 'findBitcoinChartData' | 'findExcessLiquidityData' | 'findSpxLiquidityData' | 'findMidtermCyclesData'>,
    private readonly now: () => Date = () => new Date(),
    private readonly bitcoinDataClient: Pick<BitcoinDataClient, 'fetchVddMultipleHistory'> = new BitcoinDataClient(),
  ) {}

  async getChartData(chartId: ChartId, timeframeInput: unknown): Promise<ChartDataResponse> {
    const timeframe = parseTimeframe(timeframeInput);

    if (chartId === 'excess-liquidity') {
      const rows = await this.repository.findExcessLiquidityData(timeframe, this.now());
      const lastUpdated = rows.reduce<string | null>((acc, r) => {
        if (!r.lastUpdated) return acc;
        return !acc || r.lastUpdated > acc ? r.lastUpdated : acc;
      }, null);
      return {
        chartId: 'excess-liquidity',
        title: 'Excess Liquidity Leading Indicator',
        timeframe,
        dataPoints: rows.map((r) => ({
          date: r.date,
          yieldCurve1yChange: r.yieldCurve1yChange,
          excessLiquidityLeading: r.excessLiquidityLeading,
        })),
        lastUpdated,
      };
    }

    if (chartId === 'spx-liquidity') {
      const rows = await this.repository.findSpxLiquidityData(timeframe, this.now());
      const lastUpdated = rows.reduce<string | null>((acc, r) => {
        if (!r.lastUpdated) return acc;
        return !acc || r.lastUpdated > acc ? r.lastUpdated : acc;
      }, null);
      return {
        chartId: 'spx-liquidity',
        title: 'S&P 500 vs Excess Liquidity',
        timeframe,
        dataPoints: rows.map((r) => ({
          date: r.date,
          spxYoyChange: r.spxYoyChange,
          excessLiquidityLeading: r.excessLiquidityLeading,
        })),
        lastUpdated,
      };
    }

    if (chartId === 'midterm-cycles') {
      const rows = await this.repository.findMidtermCyclesData();
      const lastUpdated = rows.reduce<string | null>((acc, r) => {
        if (!r.lastUpdated) return acc;
        return !acc || r.lastUpdated > acc ? r.lastUpdated : acc;
      }, null);
      return {
        chartId: 'midterm-cycles',
        title: 'Midterm Cycles',
        dataPoints: rows.map((r) => ({
          date: r.date,
          btcRsi12m: r.btcRsi12m,
          spxRsi12m: r.spxRsi12m,
          ismPmi: r.ismPmi,
        })),
        lastUpdated,
      };
    }

    if (chartId === 'mayer-multiple') {
      const allRows = await this.repository.findBitcoinChartData('all', this.now());
      const prices = allRows.map((r) => r.priceUsd);
      const ma200: (number | null)[] = prices.map((_, i) => {
        if (i < 199) return null;
        let sum = 0;
        for (let j = i - 199; j <= i; j++) sum += prices[j]!;
        return sum / 200;
      });
      const allPoints = allRows.map((r, i) => {
        const ma = ma200[i] ?? null;
        return { date: r.date, priceUsd: r.priceUsd, ma200: ma, mayerMultiple: ma !== null && ma > 0 ? r.priceUsd / ma : null };
      });
      const startDate = timeframe === 'all' ? null : getTimeframeStartDate(timeframe, this.now());
      return { chartId: 'mayer-multiple', title: 'Mayer Multiple', timeframe, dataPoints: startDate ? allPoints.filter((p) => p.date >= startDate) : allPoints, lastUpdated: getLastUpdated(allRows) };
    }

    if (chartId === '200-week-ma-heatmap') {
      const allRows = await this.repository.findBitcoinChartData('all', this.now());
      const prices = allRows.map((r) => r.priceUsd);
      const ma1400: (number | null)[] = prices.map((_, i) => {
        if (i < 1399) return null;
        let sum = 0;
        for (let j = i - 1399; j <= i; j++) sum += prices[j]!;
        return sum / 1400;
      });
      const allPoints = allRows.map((r, i) => {
        const ma = ma1400[i] ?? null;
        return { date: r.date, priceUsd: r.priceUsd, ma200w: ma, multiplier: ma !== null && ma > 0 ? r.priceUsd / ma : null };
      });
      const startDate = timeframe === 'all' ? null : getTimeframeStartDate(timeframe, this.now());
      return { chartId: '200-week-ma-heatmap', title: '200-Week Moving Average Heatmap', timeframe, dataPoints: startDate ? allPoints.filter((p) => p.date >= startDate) : allPoints, lastUpdated: getLastUpdated(allRows) };
    }

    if (chartId === 'fear-greed-index') {
      const allRows = await this.repository.findBitcoinChartData('all', this.now());
      const firstFgDate = allRows.find((r) => r.fearGreedIndex !== null)?.date ?? '2018-02-01';
      const startDate = timeframe === 'all' ? firstFgDate : getTimeframeStartDate(timeframe, this.now());
      return { chartId: 'fear-greed-index', title: 'Fear & Greed Index', timeframe, dataPoints: allRows.filter((r) => r.date >= startDate).map((r) => ({ date: r.date, priceUsd: r.priceUsd, fearGreedValue: r.fearGreedIndex })), lastUpdated: getLastUpdated(allRows) };
    }

    if (chartId === 'hash-ribbons') {
      const allRows = await this.repository.findBitcoinChartData('all', this.now());
      const hr = allRows.map((r) => r.hashRate);
      const rollingMA = (data: (number | null)[], w: number): (number | null)[] =>
        data.map((_, i) => { const s = data.slice(Math.max(0, i - w + 1), i + 1).filter((v): v is number => v !== null); return s.length >= w ? s.reduce((a, b) => a + b, 0) / s.length : null; });
      const ma30 = rollingMA(hr, 30);
      const ma60 = rollingMA(hr, 60);
      const allPoints = allRows.map((r, i) => {
        const c30 = ma30[i] ?? null, c60 = ma60[i] ?? null, p30 = ma30[i - 1] ?? null, p60 = ma60[i - 1] ?? null;
        const isBuySignal = i > 0 && c30 !== null && c60 !== null && p30 !== null && p60 !== null && p30 <= p60 && c30 > c60;
        return { date: r.date, priceUsd: r.priceUsd, ma30: c30, ma60: c60, isBuySignal };
      });
      const firstDate = allRows.find((r) => r.hashRate !== null)?.date ?? '2009-01-03';
      const startDate = timeframe === 'all' ? firstDate : getTimeframeStartDate(timeframe, this.now());
      return { chartId: 'hash-ribbons', title: 'Hash Ribbons', timeframe, dataPoints: allPoints.filter((p) => p.date >= startDate), lastUpdated: getLastUpdated(allRows) };
    }

    if (chartId === 'difficulty-ribbon') {
      const allRows = await this.repository.findBitcoinChartData('all', this.now());
      const diff = allRows.map((r) => r.miningDifficulty);
      const rollingMA = (data: (number | null)[], w: number): (number | null)[] =>
        data.map((_, i) => { const s = data.slice(Math.max(0, i - w + 1), i + 1).filter((v): v is number => v !== null); return s.length >= w ? s.reduce((a, b) => a + b, 0) / s.length : null; });
      const [ma9, ma14, ma25, ma40, ma60, ma90, ma128, ma200] = [9, 14, 25, 40, 60, 90, 128, 200].map((w) => rollingMA(diff, w));
      const allPoints = allRows.map((r, i) => ({ date: r.date, priceUsd: r.priceUsd, ma9: ma9![i] ?? null, ma14: ma14![i] ?? null, ma25: ma25![i] ?? null, ma40: ma40![i] ?? null, ma60: ma60![i] ?? null, ma90: ma90![i] ?? null, ma128: ma128![i] ?? null, ma200: ma200![i] ?? null }));
      const firstDate = allRows.find((r) => r.miningDifficulty !== null)?.date ?? '2009-01-03';
      const startDate = timeframe === 'all' ? firstDate : getTimeframeStartDate(timeframe, this.now());
      return { chartId: 'difficulty-ribbon', title: 'Difficulty Ribbon', timeframe, dataPoints: allPoints.filter((p) => p.date >= startDate), lastUpdated: getLastUpdated(allRows) };
    }

    if (chartId === 'nvt-ratio') {
      const allRows = await this.repository.findBitcoinChartData('all', this.now());
      const nvtRaw = allRows.map((r) => {
        const supply = r.circulatingSupply ?? estimateSupplyFromHalvings(r.date);
        return r.transactionVolumeUsd && r.transactionVolumeUsd > 0 ? (r.priceUsd * supply) / r.transactionVolumeUsd : null;
      });
      const nvtSignal = nvtRaw.map((_, i) => { const s = nvtRaw.slice(Math.max(0, i - 89), i + 1).filter((v): v is number => v !== null); return s.length >= 90 ? s.reduce((a, b) => a + b, 0) / s.length : null; });
      const allPoints = allRows.map((r, i) => ({ date: r.date, priceUsd: r.priceUsd, nvtRatio: nvtRaw[i] ?? null, nvtSignal: nvtSignal[i] ?? null }));
      const firstDate = allRows.find((r) => r.transactionVolumeUsd !== null)?.date ?? '2010-08-28';
      const startDate = timeframe === 'all' ? firstDate : getTimeframeStartDate(timeframe, this.now());
      return { chartId: 'nvt-ratio', title: 'NVT Ratio', timeframe, dataPoints: allPoints.filter((p) => p.date >= startDate), lastUpdated: getLastUpdated(allRows) };
    }

    if (chartId === 'thermocap-multiple') {
      const allRows = await this.repository.findBitcoinChartData('all', this.now());
      let thermocap = 0;
      const allPoints = allRows.map((r) => {
        if (r.minersRevenueUsd !== null) thermocap += r.minersRevenueUsd;
        const supply = r.circulatingSupply ?? estimateSupplyFromHalvings(r.date);
        return { date: r.date, priceUsd: r.priceUsd, thermocapMultiple: thermocap > 0 ? (r.priceUsd * supply) / thermocap : null };
      });
      const firstDate = allRows.find((r) => r.minersRevenueUsd !== null)?.date ?? '2009-01-17';
      const startDate = timeframe === 'all' ? firstDate : getTimeframeStartDate(timeframe, this.now());
      return { chartId: 'thermocap-multiple', title: 'Thermocap Multiple', timeframe, dataPoints: allPoints.filter((p) => p.date >= startDate), lastUpdated: getLastUpdated(allRows) };
    }

    if (chartId === 'price-forecast-tools') {
      const allRows = await this.repository.findBitcoinChartData('all', this.now());
      const GENESIS_MS = new Date('2009-01-03T00:00:00Z').getTime();
      let cumulativeMarketCap = 0;
      const allPoints = allRows.map((r) => {
        const ageDays = Math.max(1, (new Date(`${r.date}T00:00:00Z`).getTime() - GENESIS_MS) / 86_400_000);
        const supply = r.circulatingSupply !== null ? r.circulatingSupply : estimateSupplyFromHalvings(r.date);
        cumulativeMarketCap += r.priceUsd * supply;
        const averageCap = cumulativeMarketCap / ageDays;
        const topCap = supply > 0 ? (averageCap * 35) / supply : null;
        let deltaTop: number | null = null;
        if (r.realizedPrice !== null && supply > 0) {
          const deltaCap = r.realizedPrice * supply - averageCap;
          deltaTop = deltaCap > 0 ? (deltaCap * 7) / supply : null;
        }
        return {
          date: r.date,
          priceUsd: r.priceUsd,
          topCap,
          deltaTop,
          cvdd: r.cvdd,
          balancedPrice: r.balancedPrice,
          terminalPrice: r.terminalPrice,
        };
      });
      const startDate = timeframe === 'all' ? null : getTimeframeStartDate(timeframe, this.now());
      return {
        chartId: 'price-forecast-tools',
        title: 'Price Forecast Tools',
        timeframe,
        dataPoints: startDate ? allPoints.filter((p) => p.date >= startDate) : allPoints,
        lastUpdated: getLastUpdated(allRows),
      };
    }

    if (chartId === '2yr-ma-multiplier') {
      // Always load all historical data for MA computation regardless of requested timeframe
      const allRows = await this.repository.findBitcoinChartData('all', this.now());

      // Compute 730-day rolling average
      const prices = allRows.map((r) => r.priceUsd);
      const ma730: (number | null)[] = prices.map((_, i) => {
        if (i < 729) return null;
        let sum = 0;
        for (let j = i - 729; j <= i; j++) sum += prices[j]!;
        return sum / 730;
      });

      const lastUpdated = getLastUpdated(allRows);

      // Build all data points
      const allPoints = allRows.map((r, i) => {
        const ma = ma730[i];
        return {
          date: r.date,
          priceUsd: r.priceUsd,
          ma730: ma,
          ma730x2: ma !== null ? ma * 2 : null,
          ma730x3: ma !== null ? ma * 3 : null,
          ma730x4: ma !== null ? ma * 4 : null,
          ma730x5: ma !== null ? ma * 5 : null,
        };
      });

      // Apply timeframe filter
      const startDate = timeframe === 'all' ? null : getTimeframeStartDate(timeframe, this.now());
      const dataPoints = startDate
        ? allPoints.filter((p) => p.date >= startDate)
        : allPoints;

      return {
        chartId: '2yr-ma-multiplier',
        title: '2-Year MA Multiplier',
        timeframe,
        dataPoints,
        lastUpdated,
      };
    }

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

    if (chartId === 'realized-price') {
      const firstRpDate = rows.find((r) => r.realizedPrice !== null)?.date ?? '2010-07-18';
      const startDate = timeframe === 'all' ? firstRpDate : getTimeframeStartDate(timeframe, this.now());
      return {
        chartId: 'realized-price',
        title: 'Bitcoin Realized Price',
        timeframe,
        dataPoints: rows
          .filter((r) => r.date >= startDate)
          .map((r) => ({
            date: r.date,
            priceUsd: r.priceUsd,
            realizedPrice: r.realizedPrice,
            mvrvRatio: r.realizedPrice !== null && r.realizedPrice > 0
              ? r.priceUsd / r.realizedPrice
              : null,
          })),
        lastUpdated,
      };
    }

    if (chartId === 'stock-to-income') {
      return buildStockToIncomeResponse(rows, timeframe, this.now);
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

// ── Stock-to-Income ────────────────────────────────────────────────────────────

interface S2IHalvingEntry { date: string; reward: number }

const S2I_HALVINGS: S2IHalvingEntry[] = [
  { date: '2009-01-03', reward: 50 },
  { date: '2012-11-28', reward: 25 },
  { date: '2016-07-09', reward: 12.5 },
  { date: '2020-05-11', reward: 6.25 },
  { date: '2024-04-19', reward: 3.125 },
  { date: '2028-04-21', reward: 1.5625 },
  { date: '2032-04-01', reward: 0.78125 },
  { date: '2036-04-01', reward: 0.390625 },
  { date: '2040-04-01', reward: 0.1953125 },
  { date: '2044-04-01', reward: 0.09765625 },
  { date: '2048-04-01', reward: 0.048828125 },
];

function blockRewardForDate(date: string): number {
  let reward = S2I_HALVINGS[0]!.reward;
  for (const h of S2I_HALVINGS) {
    if (date >= h.date) reward = h.reward;
    else break;
  }
  return reward;
}

function estimateSupplyFromHalvings(date: string): number {
  const genesis = new Date(`${S2I_HALVINGS[0]!.date}T00:00:00Z`).getTime();
  const target = new Date(`${date}T00:00:00Z`).getTime();
  let supply = 0;
  let prevMs = genesis;
  for (let i = 0; i < S2I_HALVINGS.length; i++) {
    const entry = S2I_HALVINGS[i]!;
    const nextEntry = S2I_HALVINGS[i + 1];
    const eraEndMs = nextEntry ? Math.min(target, new Date(`${nextEntry.date}T00:00:00Z`).getTime()) : target;
    if (eraEndMs <= prevMs) break;
    supply += ((eraEndMs - prevMs) / 86_400_000) * 144 * entry.reward;
    prevMs = eraEndMs;
    if (eraEndMs >= target) break;
  }
  return Math.min(supply, 21_000_000);
}

function buildStockToIncomeResponse(
  rows: ChartDataRow[],
  timeframe: ChartTimeframe,
  now: () => Date,
): StockToIncomeChartResponse {
  // 1. Attach supply (use DB value or estimate)
  const rowsWithSupply = rows.map((r) => ({
    ...r,
    supply: r.circulatingSupply !== null ? r.circulatingSupply : estimateSupplyFromHalvings(r.date),
  }));

  // 2. Compute 365-day rolling average of miner fees
  const feeValues = rowsWithSupply.map((r) => r.minerFees ?? 0);
  const fees365ma: (number | null)[] = feeValues.map((_, i) => {
    const window = feeValues.slice(Math.max(0, i - 364), i + 1);
    if (window.length < 30) return null;
    return window.reduce((s, v) => s + v, 0) / window.length;
  });

  // 3. Compute S2I ratio
  const rowsWithS2I = rowsWithSupply.map((r, i) => {
    const subsidy = 144 * blockRewardForDate(r.date);
    const ma = fees365ma[i];
    const flow = ma !== null ? subsidy + ma : null;
    const s2i = flow !== null && flow > 0 ? r.supply / (flow * 365) : null;
    return { ...r, fees365ma: ma, flow, s2i };
  });

  // 4. OLS regression ln(price) ~ ln(s2i) from 2012-01-01
  const regrRows = rowsWithS2I.filter(
    (r) => r.date >= '2012-01-01' && r.priceUsd > 0 && r.s2i !== null && r.s2i > 0,
  );
  let regrA = 0;
  let regrB = 1;
  let sigma = 0;
  if (regrRows.length >= 2) {
    const n = regrRows.length;
    let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
    for (const r of regrRows) {
      const x = Math.log(r.s2i!);
      const y = Math.log(r.priceUsd);
      sumX += x; sumY += y; sumXY += x * y; sumX2 += x * x;
    }
    regrB = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    regrA = (sumY - regrB * sumX) / n;
    let sumResiduals2 = 0;
    for (const r of regrRows) {
      const predicted = regrA + regrB * Math.log(r.s2i!);
      const resid = Math.log(r.priceUsd) - predicted;
      sumResiduals2 += resid * resid;
    }
    sigma = Math.sqrt(sumResiduals2 / n);
  }

  // 5. Historical data points
  const historicalPoints: StockToIncomeChartResponse['dataPoints'] = rowsWithS2I
    .map((r) => {
      const priceUsd = r.priceUsd > 0 ? r.priceUsd : null;
      if (r.s2i === null || r.s2i <= 0) {
        return priceUsd !== null
          ? { date: r.date, priceUsd, modelPrice: null, upperBand: null, lowerBand: null, s2iRatio: null }
          : null;
      }
      const modelPrice = Math.exp(regrA + regrB * Math.log(r.s2i));
      return {
        date: r.date,
        priceUsd,
        modelPrice,
        upperBand: modelPrice * Math.exp(sigma),
        lowerBand: modelPrice * Math.exp(-sigma),
        s2iRatio: r.s2i,
      };
    })
    .filter((p): p is NonNullable<typeof p> => p !== null);

  // 6. Future projection to 2050
  const todayStr = now().toISOString().slice(0, 10);
  const lastRow = rowsWithS2I[rowsWithS2I.length - 1];
  let cumulativeSupply = lastRow?.supply ?? estimateSupplyFromHalvings(todayStr);
  const lastFeesMA = fees365ma[fees365ma.length - 1] ?? 0;
  const lastHistDate = lastRow?.date ?? todayStr;
  const futurePoints: StockToIncomeChartResponse['dataPoints'] = [];
  const endMs = new Date('2050-12-31T00:00:00Z').getTime();
  for (
    let ms = new Date(`${lastHistDate}T00:00:00Z`).getTime() + 86_400_000;
    ms <= endMs;
    ms += 86_400_000
  ) {
    const date = new Date(ms).toISOString().slice(0, 10);
    const subsidy = 144 * blockRewardForDate(date);
    cumulativeSupply = Math.min(cumulativeSupply + subsidy, 21_000_000);
    const flow = subsidy + lastFeesMA;
    const s2i = flow > 0 ? cumulativeSupply / (flow * 365) : null;
    if (s2i === null || s2i <= 0) {
      futurePoints.push({ date, priceUsd: null, modelPrice: null, upperBand: null, lowerBand: null, s2iRatio: null });
      continue;
    }
    const modelPrice = Math.exp(regrA + regrB * Math.log(s2i));
    futurePoints.push({
      date,
      priceUsd: null,
      modelPrice,
      upperBand: modelPrice * Math.exp(sigma),
      lowerBand: modelPrice * Math.exp(-sigma),
      s2iRatio: s2i,
    });
  }

  // 7. Combine and filter
  const allPoints = [...historicalPoints, ...futurePoints];
  const startDate = timeframe === 'all' ? null : getTimeframeStartDate(timeframe, now());
  const dataPoints = startDate
    ? allPoints.filter((p) => p.date >= startDate || p.priceUsd === null)
    : allPoints;

  return {
    chartId: 'stock-to-income',
    title: 'Stock to Income Model',
    timeframe,
    dataPoints,
    regressionA: regrA,
    regressionB: regrB,
    sigma,
    lastUpdated: getLastUpdated(rows),
  };
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
