import { RecentChartsRepository } from '../repositories/recent-charts.repository';
import type { RecentChartRecord } from '../repositories/recent-charts.repository';
import { getDatabasePool } from '../config/database.config';

export interface RecentChart {
  chartId: string;
  title: string;
  url: string;
  thumbnailUrl: string;
  viewedAt: string;
}

export interface RecentChartsResponse {
  recentCharts: RecentChart[];
}

export class RecentChartsError extends Error {
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
  thumbnailUrl: string;
}

const MAX_RECENT_CHARTS = 5;

const CHART_CATALOG: Record<string, ChartCatalogEntry> = {
  'bitcoin-rainbow':     { title: 'Bitcoin Rainbow Price Chart',        url: '/charts/bitcoin-rainbow',       thumbnailUrl: '/assets/charts/bitcoin-rainbow-thumb.svg' },
  'pi-cycle-top':        { title: 'Pi Cycle Top Indicator',             url: '/charts/pi-cycle-top',          thumbnailUrl: '/assets/charts/pi-cycle-top-thumb.svg' },
  'stock-to-flow':       { title: 'Stock-to-Flow Model',                url: '/charts/stock-to-flow',         thumbnailUrl: '/assets/charts/stock-to-flow-thumb.svg' },
  'mvrv-z-score':        { title: 'MVRV Z-Score',                       url: '/charts/mvrv-z-score',          thumbnailUrl: '/assets/charts/mvrv-z-score-thumb.svg' },
  'nupl':                { title: 'Bitcoin NUPL',                       url: '/charts/nupl',                  thumbnailUrl: '/assets/charts/mvrv-z-score-thumb.svg' },
  'sopr-ratio':          { title: 'SOPR Ratio (LTH/STH)',               url: '/charts/sopr-ratio',            thumbnailUrl: '/assets/charts/sopr-ratio-thumb.svg' },
  'puell-multiple':      { title: 'Puell Multiple',                     url: '/charts/puell-multiple',        thumbnailUrl: '/assets/charts/puell-multiple-thumb.svg' },
  'bitcoin-power-law':   { title: 'Bitcoin Power Law Chart',            url: '/charts/bitcoin-power-law',     thumbnailUrl: '/assets/charts/bitcoin-power-law-thumb.svg' },
  'bitcoin-cvdd':        { title: 'Bitcoin CVDD',                       url: '/charts/bitcoin-cvdd',          thumbnailUrl: '/assets/charts/bitcoin-cvdd-thumb.svg' },
  'vdd-multiple':        { title: 'VDD Multiple',                       url: '/charts/vdd-multiple',          thumbnailUrl: '/assets/charts/vdd-multiple-thumb.svg' },
  'halving-spiral':      { title: 'Bitcoin Halving Spiral',             url: '/charts/halving-spiral',        thumbnailUrl: '/assets/charts/halving-spiral-thumb.svg' },
  'halving-progress':    { title: 'Bitcoin Halving Progress',           url: '/charts/halving-progress',      thumbnailUrl: '/assets/charts/halving-progress-thumb.svg' },
  'compare-bull-markets':{ title: 'Compare Bull Markets',               url: '/charts/compare-bull-markets',  thumbnailUrl: '/assets/charts/compare-bull-markets-thumb.svg' },
  '2yr-ma-multiplier':   { title: '2-Year MA Multiplier',               url: '/charts/2yr-ma-multiplier',     thumbnailUrl: '/assets/charts/2yr-ma-multiplier-thumb.svg' },
  'price-forecast-tools':{ title: 'Price Forecast Tools',               url: '/charts/price-forecast-tools',  thumbnailUrl: '/assets/charts/price-forecast-tools-thumb.svg' },
  'mayer-multiple':      { title: 'Mayer Multiple',                     url: '/charts/mayer-multiple',        thumbnailUrl: '/assets/charts/mayer-multiple-thumb.svg' },
  '200-week-ma-heatmap': { title: '200-Week MA Heatmap',                url: '/charts/200-week-ma-heatmap',   thumbnailUrl: '/assets/charts/200-week-ma-heatmap-thumb.svg' },
  'fear-greed-index':    { title: 'Fear & Greed Index',                 url: '/charts/fear-greed-index',      thumbnailUrl: '/assets/charts/fear-greed-index-thumb.svg' },
  'hash-ribbons':        { title: 'Hash Ribbons',                       url: '/charts/hash-ribbons',          thumbnailUrl: '/assets/charts/hash-ribbons-thumb.svg' },
  'difficulty-ribbon':   { title: 'Difficulty Ribbon',                  url: '/charts/difficulty-ribbon',     thumbnailUrl: '/assets/charts/difficulty-ribbon-thumb.svg' },
  'nvt-ratio':           { title: 'NVT Ratio',                          url: '/charts/nvt-ratio',             thumbnailUrl: '/assets/charts/nvt-ratio-thumb.svg' },
  'thermocap-multiple':  { title: 'Thermocap Multiple',                 url: '/charts/thermocap-multiple',    thumbnailUrl: '/assets/charts/thermocap-multiple-thumb.svg' },
  'excess-liquidity':    { title: 'Excess Liquidity Leading Indicator', url: '/charts/excess-liquidity',      thumbnailUrl: '/assets/charts/excess-liquidity-thumb.svg' },
  'spx-liquidity':       { title: 'S&P 500 vs Excess Liquidity',        url: '/charts/spx-liquidity',         thumbnailUrl: '/assets/charts/spx-liquidity-thumb.svg' },
  'global-m2-bitcoin':   { title: 'Global M2 vs BTC YoY',               url: '/charts/global-m2-bitcoin',     thumbnailUrl: '/assets/charts/global-m2-bitcoin-thumb.svg' },
  'dxy-bitcoin':         { title: 'DXY vs Bitcoin',                     url: '/charts/dxy-bitcoin',           thumbnailUrl: '/assets/charts/global-m2-bitcoin-thumb.svg' },
  'midterm-cycles':      { title: 'Midterm Cycles',                     url: '/charts/midterm-cycles',        thumbnailUrl: '/assets/charts/midterm-cycles-thumb.svg' },
  'stock-to-income':     { title: 'Stock-to-Income Ratio',              url: '/charts/stock-to-income',       thumbnailUrl: '/assets/charts/stock-to-income-thumb.svg' },
  'realized-price':      { title: 'Realized Price',                     url: '/charts/realized-price',        thumbnailUrl: '/assets/charts/realized-price-thumb.svg' },
};

interface RecentChartsStore {
  upsert(userId: string, chartId: string): Promise<void>;
  pruneToLimit(userId: string, limit: number): Promise<void>;
  listForUser(userId: string, limit: number): Promise<RecentChartRecord[]>;
}

export class RecentChartsService {
  constructor(
    private readonly repository: RecentChartsStore = new RecentChartsRepository(getDatabasePool()),
  ) {}

  async recordView(userId: string, chartId: unknown): Promise<void> {
    if (typeof chartId !== 'string' || !chartId.trim()) {
      throw new RecentChartsError('chartId is required', 400);
    }

    const id = chartId.trim();

    if (!CHART_CATALOG[id]) {
      throw new RecentChartsError('Unknown chart', 400);
    }

    await this.repository.upsert(userId, id);
    await this.repository.pruneToLimit(userId, MAX_RECENT_CHARTS);
  }

  async listRecent(userId: string): Promise<RecentChartsResponse> {
    const records = await this.repository.listForUser(userId, MAX_RECENT_CHARTS);

    return {
      recentCharts: records
        .map((record) => {
          const entry = CHART_CATALOG[record.chartId];

          if (!entry) return null;

          return {
            chartId: record.chartId,
            title: entry.title,
            url: entry.url,
            thumbnailUrl: entry.thumbnailUrl,
            viewedAt: record.viewedAt,
          };
        })
        .filter((item): item is RecentChart => item !== null),
    };
  }
}
