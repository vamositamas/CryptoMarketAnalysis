import { FavouriteChartsRepository, type FavouriteChartRecord } from '../repositories/favourite-charts.repository';
import { getDatabasePool } from '../config/database.config';

export interface FavouriteChart {
  chartId: string;
  title: string;
  url: string;
  createdAt: string;
}

export interface FavouriteChartsResponse {
  favouriteCharts: FavouriteChart[];
}

export interface ToggleFavouriteResponse {
  chartId: string;
  isFavourite: boolean;
}

export class FavouriteChartsError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
  ) {
    super(message);
  }
}

interface ChartCatalogEntry {
  title: string;
  url: string;
}

export const CHART_CATALOG: Record<string, ChartCatalogEntry> = {
  'bitcoin-rainbow':     { title: 'Bitcoin Rainbow Price Chart',         url: '/charts/bitcoin-rainbow' },
  'pi-cycle-top':        { title: 'Pi Cycle Top Indicator',              url: '/charts/pi-cycle-top' },
  'stock-to-flow':       { title: 'Stock-to-Flow Model',                 url: '/charts/stock-to-flow' },
  'mvrv-z-score':        { title: 'MVRV Z-Score',                        url: '/charts/mvrv-z-score' },
  'nupl':                { title: 'Bitcoin NUPL',                        url: '/charts/nupl' },
  'sopr-ratio':          { title: 'SOPR Ratio (LTH/STH)',                url: '/charts/sopr-ratio' },
  'puell-multiple':      { title: 'Puell Multiple',                      url: '/charts/puell-multiple' },
  'bitcoin-power-law':   { title: 'Bitcoin Power Law Chart',             url: '/charts/bitcoin-power-law' },
  'bitcoin-cvdd':        { title: 'Bitcoin CVDD',                        url: '/charts/bitcoin-cvdd' },
  'vdd-multiple':        { title: 'VDD Multiple',                        url: '/charts/vdd-multiple' },
  'halving-spiral':      { title: 'Bitcoin Halving Spiral',              url: '/charts/halving-spiral' },
  'halving-progress':    { title: 'Bitcoin Halving Progress',            url: '/charts/halving-progress' },
  'compare-bull-markets':{ title: 'Compare Bull Markets',                url: '/charts/compare-bull-markets' },
  '2yr-ma-multiplier':   { title: '2-Year MA Multiplier',                url: '/charts/2yr-ma-multiplier' },
  'price-forecast-tools':{ title: 'Price Forecast Tools',                url: '/charts/price-forecast-tools' },
  'mayer-multiple':      { title: 'Mayer Multiple',                      url: '/charts/mayer-multiple' },
  '200-week-ma-heatmap': { title: '200-Week MA Heatmap',                 url: '/charts/200-week-ma-heatmap' },
  'fear-greed-index':    { title: 'Fear & Greed Index',                  url: '/charts/fear-greed-index' },
  'hash-ribbons':        { title: 'Hash Ribbons',                        url: '/charts/hash-ribbons' },
  'difficulty-ribbon':   { title: 'Difficulty Ribbon',                   url: '/charts/difficulty-ribbon' },
  'nvt-ratio':           { title: 'NVT Ratio',                           url: '/charts/nvt-ratio' },
  'thermocap-multiple':  { title: 'Thermocap Multiple',                  url: '/charts/thermocap-multiple' },
  'excess-liquidity':    { title: 'Excess Liquidity Leading Indicator',  url: '/charts/excess-liquidity' },
  'spx-liquidity':       { title: 'S&P 500 vs Excess Liquidity',         url: '/charts/spx-liquidity' },
  'global-m2-bitcoin':   { title: 'Global M2 vs BTC YoY',                url: '/charts/global-m2-bitcoin' },
  'dxy-bitcoin':         { title: 'DXY vs Bitcoin',                      url: '/charts/dxy-bitcoin' },
  'stock-to-income':     { title: 'Stock-to-Income Ratio',               url: '/charts/stock-to-income' },
  'realized-price':      { title: 'Realized Price',                      url: '/charts/realized-price' },
  'realized-cap':        { title: 'Bitcoin Realized Cap',                 url: '/charts/realized-cap' },
  'lth-sth-sopr-split':  { title: 'LTH-SOPR / STH-SOPR Split',            url: '/charts/lth-sth-sopr-split' },
  'google-trends-bitcoin': { title: 'Google Trends: Bitcoin Search Interest', url: '/charts/google-trends-bitcoin' },
};

interface FavouriteChartsStore {
  toggle(userId: string, chartId: string): Promise<boolean>;
  listForUser(userId: string): Promise<FavouriteChartRecord[]>;
  isFavourite(userId: string, chartId: string): Promise<boolean>;
}

export class FavouriteChartsService {
  constructor(
    private readonly repository: FavouriteChartsStore = new FavouriteChartsRepository(getDatabasePool()),
  ) {}

  async toggle(userId: string, chartId: unknown): Promise<ToggleFavouriteResponse> {
    if (typeof chartId !== 'string' || !chartId.trim()) {
      throw new FavouriteChartsError('chartId is required', 400);
    }
    const id = chartId.trim();
    if (!CHART_CATALOG[id]) {
      throw new FavouriteChartsError('Unknown chart', 400);
    }
    const isFavourite = await this.repository.toggle(userId, id);
    return { chartId: id, isFavourite };
  }

  async list(userId: string): Promise<FavouriteChartsResponse> {
    const records = await this.repository.listForUser(userId);
    return {
      favouriteCharts: records
        .map((r) => {
          const entry = CHART_CATALOG[r.chartId];
          if (!entry) return null;
          return { chartId: r.chartId, title: entry.title, url: entry.url, createdAt: r.createdAt };
        })
        .filter((item): item is FavouriteChart => item !== null),
    };
  }

  async isFavourite(userId: string, chartId: string): Promise<boolean> {
    if (!CHART_CATALOG[chartId]) return false;
    return this.repository.isFavourite(userId, chartId);
  }
}
