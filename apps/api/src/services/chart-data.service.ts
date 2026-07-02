import { BinanceFuturesClient, BitcoinDataClient, BybitClient, CoinMetricsClient, DeribitClient, GoogleTrendsClient } from '@crypto-market-analysis/calculation-engines/data-sources';
import {
  ChartDataRepository,
  type ChartDataRow,
  type ChartTimeframe,
} from '../repositories/chart-data.repository';

export type ChartId = 'bitcoin-rainbow' | 'pi-cycle-top' | 'stock-to-flow' | 'mvrv-z-score' | 'puell-multiple' | 'vdd-multiple' | 'realized-price' | 'stock-to-income' | '2yr-ma-multiplier' | 'price-forecast-tools' | 'mayer-multiple' | '200-week-ma-heatmap' | 'fear-greed-index' | 'hash-ribbons' | 'difficulty-ribbon' | 'nvt-ratio' | 'thermocap-multiple' | 'excess-liquidity' | 'spx-liquidity' | 'midterm-cycles' | 'global-m2-bitcoin' | 'dxy-bitcoin' | 'exchange-reserve' | 'funding-rate-oi' | 'exchange-netflow' | 'realized-cap' | 'google-trends-bitcoin' | 'lth-sth-sopr-split' | 'realized-volatility' | 'active-addresses' | 'hash-rate' | 'btc-dvol';

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
  dataPoints: { date: string; btcRsi12m: number | null; spxRsi12m: number | null; cfnai: number | null; }[];
  lastUpdated: string | null;
}

export interface GlobalM2BitcoinChartResponse {
  chartId: 'global-m2-bitcoin';
  title: 'Global M2 vs BTC YoY';
  timeframe: ChartTimeframe;
  dataPoints: { date: string; globalM2YoY: number | null; btcYoYReturn: number | null; }[];
  lastUpdated: string | null;
}

export interface DxyBitcoinChartResponse {
  chartId: 'dxy-bitcoin';
  title: 'DXY vs Bitcoin';
  timeframe: ChartTimeframe;
  dataPoints: { date: string; dxyYoYChange: number | null; priceUsd: number | null; }[];
  lastUpdated: string | null;
}

export interface ExchangeReserveChartResponse {
  chartId: 'exchange-reserve';
  title: 'Bitcoin Exchange Reserve';
  timeframe: ChartTimeframe;
  dataPoints: { date: string; priceUsd: number; exchangeReserve: number | null; }[];
  lastUpdated: string | null;
}

export interface FundingRateOpenInterestChartResponse {
  chartId: 'funding-rate-oi';
  title: 'Bitcoin Funding Rate & Open Interest';
  timeframe: ChartTimeframe;
  dataPoints: { date: string; priceUsd: number; fundingRate: number | null; openInterestUsd: number | null; }[];
  lastUpdated: string | null;
}

export interface ExchangeNetflowChartResponse {
  chartId: 'exchange-netflow';
  title: 'Bitcoin Exchange Netflow';
  timeframe: ChartTimeframe;
  dataPoints: { date: string; priceUsd: number; exchangeNetflow: number | null; }[];
  lastUpdated: string | null;
}

export interface RealizedCapChartResponse {
  chartId: 'realized-cap';
  title: 'Bitcoin Realized Cap';
  timeframe: ChartTimeframe;
  dataPoints: { date: string; priceUsd: number; marketCap: number | null; realizedCap: number | null; }[];
  lastUpdated: string | null;
}

export interface GoogleTrendsBitcoinChartResponse {
  chartId: 'google-trends-bitcoin';
  title: 'Google Trends: Bitcoin Search Interest';
  timeframe: ChartTimeframe;
  dataPoints: { date: string; priceUsd: number; searchInterest: number | null; }[];
  lastUpdated: string | null;
}

export interface LthSthSoprSplitChartResponse {
  chartId: 'lth-sth-sopr-split';
  title: 'LTH-SOPR / STH-SOPR Split';
  timeframe: ChartTimeframe;
  dataPoints: { date: string; priceUsd: number; lthSopr: number | null; sthSopr: number | null; }[];
  lastUpdated: string | null;
}

export interface RealizedVolatilityChartResponse {
  chartId: 'realized-volatility';
  title: 'Bitcoin Realized Volatility';
  timeframe: ChartTimeframe;
  dataPoints: { date: string; priceUsd: number; volatility30d: number | null; volatility90d: number | null; }[];
  lastUpdated: string | null;
}

export interface ActiveAddressesChartResponse {
  chartId: 'active-addresses';
  title: 'Bitcoin Active Addresses';
  timeframe: ChartTimeframe;
  dataPoints: { date: string; priceUsd: number; activeAddresses: number | null; }[];
  lastUpdated: string | null;
}

export interface HashRateChartResponse {
  chartId: 'hash-rate';
  title: 'Bitcoin Hash Rate';
  timeframe: ChartTimeframe;
  dataPoints: { date: string; priceUsd: number; hashRate: number | null; }[];
  lastUpdated: string | null;
}

export interface BtcDvolChartResponse {
  chartId: 'btc-dvol';
  title: 'Bitcoin Implied Volatility (DVOL)';
  timeframe: ChartTimeframe;
  dataPoints: { date: string; priceUsd: number; dvol: number | null; }[];
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
  | FundingRateOpenInterestChartResponse
  | ExcessLiquidityChartResponse
  | SpxLiquidityChartResponse
  | MidtermCyclesChartResponse
  | GlobalM2BitcoinChartResponse
  | DxyBitcoinChartResponse
  | ExchangeReserveChartResponse
  | ExchangeNetflowChartResponse
  | RealizedCapChartResponse
  | GoogleTrendsBitcoinChartResponse
  | LthSthSoprSplitChartResponse
  | RealizedVolatilityChartResponse
  | ActiveAddressesChartResponse
  | HashRateChartResponse
  | BtcDvolChartResponse;

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
    private readonly repository: Pick<ChartDataRepository, 'findBitcoinChartData' | 'findExcessLiquidityData' | 'findSpxLiquidityData' | 'findMidtermCyclesData' | 'findGlobalM2BitcoinData' | 'findDxyBitcoinData'>,
    private readonly now: () => Date = () => new Date(),
    private readonly bitcoinDataClient: Pick<BitcoinDataClient, 'fetchVddMultipleHistory' | 'fetchCvddHistory' | 'fetchBalancedPriceHistory' | 'fetchTerminalPriceHistory' | 'fetchLthSoprHistory' | 'fetchSthSoprHistory'> = new BitcoinDataClient(),
    private readonly coinMetricsClient: Pick<CoinMetricsClient, 'fetchMvrvRatioAndPriceHistory' | 'fetchExchangeReserveHistory' | 'fetchExchangeNetflowHistory' | 'fetchActiveAddressesHistory'> = new CoinMetricsClient(),
    private readonly binanceFuturesClient: Pick<BinanceFuturesClient, 'fetchFundingRateHistory'> = new BinanceFuturesClient(),
    private readonly bybitClient: Pick<BybitClient, 'fetchOpenInterestHistory'> = new BybitClient(),
    private readonly googleTrendsClient: Pick<GoogleTrendsClient, 'fetchBitcoinSearchInterestHistory'> = new GoogleTrendsClient(),
    private readonly deribitClient: Pick<DeribitClient, 'fetchBtcDvolHistory'> = new DeribitClient(),
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
          cfnai: r.cfnai,
        })),
        lastUpdated,
      };
    }

    if (chartId === 'global-m2-bitcoin') {
      const rows = await this.repository.findGlobalM2BitcoinData(timeframe, this.now());
      const lastUpdated = rows.reduce<string | null>((acc, r) => {
        if (!r.lastUpdated) return acc;
        return !acc || r.lastUpdated > acc ? r.lastUpdated : acc;
      }, null);
      return {
        chartId: 'global-m2-bitcoin',
        title: 'Global M2 vs BTC YoY',
        timeframe,
        dataPoints: rows.map((r) => ({
          date: r.date,
          globalM2YoY: r.globalM2YoY,
          btcYoYReturn: r.btcYoYReturn,
        })),
        lastUpdated,
      };
    }

    if (chartId === 'dxy-bitcoin') {
      const rows = await this.repository.findDxyBitcoinData(timeframe, this.now());
      const lastUpdated = rows.reduce<string | null>((acc, r) => {
        if (!r.lastUpdated) return acc;
        return !acc || r.lastUpdated > acc ? r.lastUpdated : acc;
      }, null);
      return {
        chartId: 'dxy-bitcoin',
        title: 'DXY vs Bitcoin',
        timeframe,
        dataPoints: rows.map((r) => ({
          date: r.date,
          dxyYoYChange: r.dxyYoYChange,
          priceUsd: r.priceUsd,
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
      const [realizedPriceByDate, cvddByDate, balancedPriceByDate, terminalPriceByDate] = await Promise.all([
        this.getRealizedPriceHistory(allRows),
        this.getForecastMetricHistory(allRows, 'cvdd', () => this.bitcoinDataClient.fetchCvddHistory()),
        this.getForecastMetricHistory(allRows, 'balancedPrice', () => this.bitcoinDataClient.fetchBalancedPriceHistory()),
        this.getForecastMetricHistory(allRows, 'terminalPrice', () => this.bitcoinDataClient.fetchTerminalPriceHistory()),
      ]);
      const GENESIS_MS = new Date('2009-01-03T00:00:00Z').getTime();
      let cumulativeMarketCap = 0;
      const allPoints = allRows.map((r) => {
        const ageDays = Math.max(1, (new Date(`${r.date}T00:00:00Z`).getTime() - GENESIS_MS) / 86_400_000);
        const supply = r.circulatingSupply !== null ? r.circulatingSupply : estimateSupplyFromHalvings(r.date);
        cumulativeMarketCap += r.priceUsd * supply;
        const averageCap = cumulativeMarketCap / ageDays;
        const topCap = supply > 0 ? (averageCap * 35) / supply : null;
        let deltaTop: number | null = null;
        const realizedPrice = realizedPriceByDate.get(r.date) ?? null;
        if (realizedPrice !== null && supply > 0) {
          const deltaCap = realizedPrice * supply - averageCap;
          deltaTop = deltaCap > 0 ? (deltaCap * 7) / supply : null;
        }
        return {
          date: r.date,
          priceUsd: r.priceUsd,
          topCap,
          deltaTop,
          cvdd: cvddByDate.get(r.date) ?? null,
          balancedPrice: balancedPriceByDate.get(r.date) ?? null,
          terminalPrice: terminalPriceByDate.get(r.date) ?? null,
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
      const realizedPriceByDate = await this.getRealizedPriceHistory(rows);
      const firstRpDate = [...realizedPriceByDate.keys()].sort()[0] ?? '2010-07-18';
      const startDate = timeframe === 'all' ? firstRpDate : getTimeframeStartDate(timeframe, this.now());
      return {
        chartId: 'realized-price',
        title: 'Bitcoin Realized Price',
        timeframe,
        dataPoints: rows
          .filter((r) => r.date >= startDate)
          .map((r) => {
            const realizedPrice = realizedPriceByDate.get(r.date) ?? null;
            return {
              date: r.date,
              priceUsd: r.priceUsd,
              realizedPrice,
              mvrvRatio: realizedPrice !== null && realizedPrice > 0
                ? r.priceUsd / realizedPrice
                : null,
            };
          }),
        lastUpdated,
      };
    }

    if (chartId === 'exchange-reserve') {
      const exchangeReserveByDate = await this.getExchangeReserveHistory(rows);
      const firstErDate = [...exchangeReserveByDate.keys()].sort()[0] ?? '2011-04-24';
      const startDate = timeframe === 'all' ? firstErDate : getTimeframeStartDate(timeframe, this.now());
      return {
        chartId: 'exchange-reserve',
        title: 'Bitcoin Exchange Reserve',
        timeframe,
        dataPoints: rows
          .filter((r) => r.date >= startDate)
          .map((r) => ({
            date: r.date,
            priceUsd: r.priceUsd,
            exchangeReserve: exchangeReserveByDate.get(r.date) ?? null,
          })),
        lastUpdated,
      };
    }

    if (chartId === 'funding-rate-oi') {
      const [fundingRateByDate, openInterestByDate] = await Promise.all([
        this.getFundingRateHistory(rows),
        this.getOpenInterestHistory(rows),
      ]);
      const firstFundingDate = [...fundingRateByDate.keys()].sort()[0] ?? '2019-09-10';
      const startDate = timeframe === 'all' ? firstFundingDate : getTimeframeStartDate(timeframe, this.now());
      return {
        chartId: 'funding-rate-oi',
        title: 'Bitcoin Funding Rate & Open Interest',
        timeframe,
        dataPoints: rows
          .filter((r) => r.date >= startDate)
          .map((r) => ({
            date: r.date,
            priceUsd: r.priceUsd,
            fundingRate: fundingRateByDate.get(r.date) ?? null,
            openInterestUsd: openInterestByDate.get(r.date) ?? r.openInterestUsd,
          })),
        lastUpdated,
      };
    }

    if (chartId === 'exchange-netflow') {
      const exchangeNetflowByDate = await this.getExchangeNetflowHistory(rows);
      const firstNetflowDate = [...exchangeNetflowByDate.keys()].sort()[0] ?? '2011-04-24';
      const startDate = timeframe === 'all' ? firstNetflowDate : getTimeframeStartDate(timeframe, this.now());
      return {
        chartId: 'exchange-netflow',
        title: 'Bitcoin Exchange Netflow',
        timeframe,
        dataPoints: rows
          .filter((r) => r.date >= startDate)
          .map((r) => ({
            date: r.date,
            priceUsd: r.priceUsd,
            exchangeNetflow: exchangeNetflowByDate.get(r.date) ?? null,
          })),
        lastUpdated,
      };
    }

    if (chartId === 'realized-cap') {
      const realizedPriceByDate = await this.getRealizedPriceHistory(rows);
      const firstRcDate = [...realizedPriceByDate.keys()].sort()[0] ?? '2010-07-18';
      const startDate = timeframe === 'all' ? firstRcDate : getTimeframeStartDate(timeframe, this.now());
      return {
        chartId: 'realized-cap',
        title: 'Bitcoin Realized Cap',
        timeframe,
        dataPoints: rows
          .filter((r) => r.date >= startDate)
          .map((r) => {
            const realizedPrice = realizedPriceByDate.get(r.date) ?? null;
            const supply = r.circulatingSupply ?? estimateSupplyFromHalvings(r.date);
            return {
              date: r.date,
              priceUsd: r.priceUsd,
              marketCap: supply > 0 ? r.priceUsd * supply : null,
              realizedCap: realizedPrice !== null && supply > 0 ? realizedPrice * supply : null,
            };
          }),
        lastUpdated,
      };
    }

    if (chartId === 'lth-sth-sopr-split') {
      const [lthSoprByDate, sthSoprByDate] = await Promise.all([
        this.getForecastMetricHistory(rows, 'lthSopr', () => this.bitcoinDataClient.fetchLthSoprHistory()),
        this.getForecastMetricHistory(rows, 'sthSopr', () => this.bitcoinDataClient.fetchSthSoprHistory()),
      ]);
      const firstSoprDate = [...lthSoprByDate.keys(), ...sthSoprByDate.keys()].sort()[0] ?? '2022-06-25';
      const startDate = timeframe === 'all' ? firstSoprDate : getTimeframeStartDate(timeframe, this.now());
      return {
        chartId: 'lth-sth-sopr-split',
        title: 'LTH-SOPR / STH-SOPR Split',
        timeframe,
        dataPoints: rows
          .filter((r) => r.date >= startDate)
          .map((r) => ({
            date: r.date,
            priceUsd: r.priceUsd,
            lthSopr: lthSoprByDate.get(r.date) ?? null,
            sthSopr: sthSoprByDate.get(r.date) ?? null,
          })),
        lastUpdated,
      };
    }

    if (chartId === 'google-trends-bitcoin') {
      const searchInterestByDate = await this.getGoogleTrendsHistory(rows);
      const firstTrendsDate = [...searchInterestByDate.keys()].sort()[0] ?? '2010-01-03';
      const startDate = timeframe === 'all' ? firstTrendsDate : getTimeframeStartDate(timeframe, this.now());
      return {
        chartId: 'google-trends-bitcoin',
        title: 'Google Trends: Bitcoin Search Interest',
        timeframe,
        dataPoints: rows
          .filter((r) => r.date >= startDate)
          .map((r) => ({
            date: r.date,
            priceUsd: r.priceUsd,
            searchInterest: searchInterestByDate.get(r.date) ?? null,
          })),
        lastUpdated,
      };
    }

    if (chartId === 'active-addresses') {
      const activeAddressesByDate = await this.getActiveAddressesHistory(rows);
      const firstAaDate = [...activeAddressesByDate.keys()].sort()[0] ?? '2009-01-03';
      const startDate = timeframe === 'all' ? firstAaDate : getTimeframeStartDate(timeframe, this.now());
      return {
        chartId: 'active-addresses',
        title: 'Bitcoin Active Addresses',
        timeframe,
        dataPoints: rows
          .filter((r) => r.date >= startDate)
          .map((r) => ({
            date: r.date,
            priceUsd: r.priceUsd,
            activeAddresses: activeAddressesByDate.get(r.date) ?? null,
          })),
        lastUpdated,
      };
    }

    if (chartId === 'btc-dvol') {
      const dvolByDate = await this.getBtcDvolHistory(rows);
      const firstDvolDate = [...dvolByDate.keys()].sort()[0] ?? '2021-03-24';
      const startDate = timeframe === 'all' ? firstDvolDate : getTimeframeStartDate(timeframe, this.now());
      return {
        chartId: 'btc-dvol',
        title: 'Bitcoin Implied Volatility (DVOL)',
        timeframe,
        dataPoints: rows
          .filter((r) => r.date >= startDate)
          .map((r) => ({
            date: r.date,
            priceUsd: r.priceUsd,
            dvol: dvolByDate.get(r.date) ?? null,
          })),
        lastUpdated,
      };
    }

    if (chartId === 'hash-rate') {
      const firstHrDate = rows.find((r) => r.hashRate !== null)?.date ?? '2009-01-09';
      const startDate = timeframe === 'all' ? firstHrDate : getTimeframeStartDate(timeframe, this.now());
      return {
        chartId: 'hash-rate',
        title: 'Bitcoin Hash Rate',
        timeframe,
        dataPoints: rows
          .filter((r) => r.date >= startDate)
          .map((r) => ({ date: r.date, priceUsd: r.priceUsd, hashRate: r.hashRate })),
        lastUpdated,
      };
    }

    if (chartId === 'realized-volatility') {
      const allRows = await this.repository.findBitcoinChartData('all', this.now());
      const prices = allRows.map((r) => r.priceUsd);
      const logReturns = prices.map((price, i) => {
        const previous = i === 0 ? null : prices[i - 1]!;
        return previous === null || previous <= 0 || price <= 0 ? null : Math.log(price / previous);
      });
      const rollingAnnualizedVol = (window: number): (number | null)[] =>
        logReturns.map((_, i) => {
          const windowValues = logReturns
            .slice(Math.max(0, i - window + 1), i + 1)
            .filter((value): value is number => value !== null);
          if (windowValues.length < window) return null;
          const mean = windowValues.reduce((sum, value) => sum + value, 0) / windowValues.length;
          const variance =
            windowValues.reduce((sum, value) => sum + (value - mean) ** 2, 0) / windowValues.length;
          return Math.sqrt(variance) * Math.sqrt(365) * 100;
        });
      const volatility30d = rollingAnnualizedVol(30);
      const volatility90d = rollingAnnualizedVol(90);
      const allPoints = allRows.map((r, i) => ({
        date: r.date,
        priceUsd: r.priceUsd,
        volatility30d: volatility30d[i] ?? null,
        volatility90d: volatility90d[i] ?? null,
      }));
      const firstVolDate = allPoints.find((p) => p.volatility30d !== null)?.date ?? allRows[0]?.date ?? '2009-01-03';
      const startDate = timeframe === 'all' ? firstVolDate : getTimeframeStartDate(timeframe, this.now());
      return {
        chartId: 'realized-volatility',
        title: 'Bitcoin Realized Volatility',
        timeframe,
        dataPoints: allPoints.filter((p) => p.date >= startDate),
        lastUpdated: getLastUpdated(allRows),
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

  private async getRealizedPriceHistory(rows: ChartDataRow[]): Promise<Map<string, number>> {
    const realizedPriceByDate = new Map(
      rows
        .filter((r): r is ChartDataRow & { realizedPrice: number } => r.realizedPrice !== null)
        .map((r) => [r.date, r.realizedPrice] as const),
    );
    const coverageRatio = rows.length === 0 ? 0 : realizedPriceByDate.size / rows.length;

    if (realizedPriceByDate.size > 30 && coverageRatio >= 0.95) {
      return realizedPriceByDate;
    }

    try {
      const history = await this.coinMetricsClient.fetchMvrvRatioAndPriceHistory();
      for (const point of history) {
        if (!realizedPriceByDate.has(point.date)) {
          realizedPriceByDate.set(point.date, point.realizedPrice);
        }
      }
    } catch {
      // Keep stored database values if the external full-history source is unavailable.
    }

    return realizedPriceByDate;
  }

  private async getExchangeReserveHistory(rows: ChartDataRow[]): Promise<Map<string, number>> {
    const exchangeReserveByDate = new Map(
      rows
        .filter((r): r is ChartDataRow & { exchangeReserve: number } => r.exchangeReserve !== null)
        .map((r) => [r.date, r.exchangeReserve] as const),
    );
    const coverageRatio = rows.length === 0 ? 0 : exchangeReserveByDate.size / rows.length;

    if (exchangeReserveByDate.size > 30 && coverageRatio >= 0.95) {
      return exchangeReserveByDate;
    }

    try {
      const history = await this.coinMetricsClient.fetchExchangeReserveHistory();
      for (const point of history) {
        if (!exchangeReserveByDate.has(point.date)) {
          exchangeReserveByDate.set(point.date, point.exchangeReserve);
        }
      }
    } catch {
      // Keep stored database values if the external full-history source is unavailable.
    }

    return exchangeReserveByDate;
  }

  private async getExchangeNetflowHistory(rows: ChartDataRow[]): Promise<Map<string, number>> {
    const exchangeNetflowByDate = new Map(
      rows
        .filter((r): r is ChartDataRow & { exchangeNetflow: number } => r.exchangeNetflow !== null)
        .map((r) => [r.date, r.exchangeNetflow] as const),
    );
    const coverageRatio = rows.length === 0 ? 0 : exchangeNetflowByDate.size / rows.length;

    if (exchangeNetflowByDate.size > 30 && coverageRatio >= 0.95) {
      return exchangeNetflowByDate;
    }

    try {
      const history = await this.coinMetricsClient.fetchExchangeNetflowHistory();
      for (const point of history) {
        if (!exchangeNetflowByDate.has(point.date)) {
          exchangeNetflowByDate.set(point.date, point.netflow);
        }
      }
    } catch {
      // Keep stored database values if the external full-history source is unavailable.
    }

    return exchangeNetflowByDate;
  }

  private async getActiveAddressesHistory(rows: ChartDataRow[]): Promise<Map<string, number>> {
    const activeAddressesByDate = new Map(
      rows
        .filter((r): r is ChartDataRow & { activeAddresses: number } => r.activeAddresses !== null)
        .map((r) => [r.date, r.activeAddresses] as const),
    );
    const coverageRatio = rows.length === 0 ? 0 : activeAddressesByDate.size / rows.length;

    if (activeAddressesByDate.size > 30 && coverageRatio >= 0.95) {
      return activeAddressesByDate;
    }

    try {
      const history = await this.coinMetricsClient.fetchActiveAddressesHistory();
      for (const point of history) {
        if (!activeAddressesByDate.has(point.date)) {
          activeAddressesByDate.set(point.date, point.activeAddresses);
        }
      }
    } catch {
      // Keep stored database values if the external full-history source is unavailable.
    }

    return activeAddressesByDate;
  }

  // DVOL only has ~5 years of history (since 2021-03-24), far short of BTC's full price
  // history, so the size+coverage-ratio check used by getExchangeNetflowHistory above would
  // never pass — a size-only threshold is used instead.
  private async getBtcDvolHistory(rows: ChartDataRow[]): Promise<Map<string, number>> {
    const dvolByDate = new Map(
      rows
        .filter((r): r is ChartDataRow & { btcDvol: number } => r.btcDvol !== null)
        .map((r) => [r.date, r.btcDvol] as const),
    );

    if (dvolByDate.size > 30) {
      return dvolByDate;
    }

    try {
      const history = await this.deribitClient.fetchBtcDvolHistory();
      for (const point of history) {
        if (!dvolByDate.has(point.date)) {
          dvolByDate.set(point.date, point.dvol);
        }
      }
    } catch {
      // Keep stored database values if the external full-history source is unavailable.
    }

    return dvolByDate;
  }

  private async getFundingRateHistory(rows: ChartDataRow[]): Promise<Map<string, number>> {
    const fundingRateByDate = new Map(
      rows
        .filter((r): r is ChartDataRow & { fundingRateAvg: number } => r.fundingRateAvg !== null)
        .map((r) => [r.date, r.fundingRateAvg] as const),
    );
    const coverageRatio = rows.length === 0 ? 0 : fundingRateByDate.size / rows.length;

    if (fundingRateByDate.size > 30 && coverageRatio >= 0.95) {
      return fundingRateByDate;
    }

    try {
      const history = await this.binanceFuturesClient.fetchFundingRateHistory();
      for (const point of history) {
        if (!fundingRateByDate.has(point.date)) {
          fundingRateByDate.set(point.date, point.value);
        }
      }
    } catch {
      // Keep stored database values if the external full-history source is unavailable.
    }

    return fundingRateByDate;
  }

  // Bybit reports open interest in BTC (base currency), not USD — each history point
  // is converted using that date's own BTC price rather than a separately-fetched
  // price series, since `rows` already carries the full daily price history.
  private async getOpenInterestHistory(rows: ChartDataRow[]): Promise<Map<string, number>> {
    const openInterestByDate = new Map(
      rows
        .filter((r): r is ChartDataRow & { openInterestUsd: number } => r.openInterestUsd !== null)
        .map((r) => [r.date, r.openInterestUsd] as const),
    );
    const priceByDate = new Map(rows.map((r) => [r.date, r.priceUsd] as const));

    try {
      const history = await this.bybitClient.fetchOpenInterestHistory();
      for (const point of history) {
        const priceUsd = priceByDate.get(point.date);
        if (priceUsd !== undefined && priceUsd > 0) {
          openInterestByDate.set(point.date, point.openInterestBtc * priceUsd);
        }
      }
    } catch {
      // Keep stored database values if the external source is unavailable.
    }

    return openInterestByDate;
  }

  private async getGoogleTrendsHistory(rows: ChartDataRow[]): Promise<Map<string, number>> {
    const searchInterestByDate = new Map(
      rows
        .filter((r): r is ChartDataRow & { googleTrendsBitcoin: number } => r.googleTrendsBitcoin !== null)
        .map((r) => [r.date, r.googleTrendsBitcoin] as const),
    );
    const coverageRatio = rows.length === 0 ? 0 : searchInterestByDate.size / rows.length;

    if (searchInterestByDate.size > 30 && coverageRatio >= 0.95) {
      return searchInterestByDate;
    }

    try {
      const history = await this.googleTrendsClient.fetchBitcoinSearchInterestHistory();
      for (const point of history) {
        searchInterestByDate.set(point.date, point.value);
      }
    } catch {
      // Keep stored database values if Google Trends' unofficial endpoint is unavailable.
    }

    return searchInterestByDate;
  }

  private async getForecastMetricHistory(
    rows: ChartDataRow[],
    metric: 'cvdd' | 'balancedPrice' | 'terminalPrice' | 'lthSopr' | 'sthSopr',
    fetchHistory: () => Promise<{ date: string; value: number }[]>,
  ): Promise<Map<string, number>> {
    const metricByDate = new Map(
      rows
        .filter((r): r is ChartDataRow & Record<typeof metric, number> => r[metric] !== null)
        .map((r) => [r.date, r[metric]] as const),
    );
    const coverageRatio = rows.length === 0 ? 0 : metricByDate.size / rows.length;

    if (metricByDate.size > 30 && coverageRatio >= 0.95) {
      return metricByDate;
    }

    try {
      const history = await fetchHistory();
      for (const point of history) {
        if (!metricByDate.has(point.date)) {
          metricByDate.set(point.date, point.value);
        }
      }
    } catch {
      // Keep stored database values if the external full-history source is unavailable.
    }

    return metricByDate;
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
