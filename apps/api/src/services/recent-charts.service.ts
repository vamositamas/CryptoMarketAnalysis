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
  'bitcoin-rainbow': {
    title: 'Bitcoin Rainbow Price Chart',
    url: '/charts/bitcoin-rainbow',
    thumbnailUrl: '/assets/charts/bitcoin-rainbow-thumb.svg',
  },
  'pi-cycle-top': {
    title: 'Pi Cycle Top Indicator',
    url: '/charts/pi-cycle-top',
    thumbnailUrl: '/assets/charts/pi-cycle-top-thumb.svg',
  },
  'stock-to-flow': {
    title: 'Stock-to-Flow Model',
    url: '/charts/stock-to-flow',
    thumbnailUrl: '/assets/charts/stock-to-flow-thumb.svg',
  },
  'mvrv-z-score': {
    title: 'MVRV Z-Score',
    url: '/charts/mvrv-z-score',
    thumbnailUrl: '/assets/charts/mvrv-z-score-thumb.svg',
  },
  'puell-multiple': {
    title: 'Puell Multiple',
    url: '/charts/puell-multiple',
    thumbnailUrl: '/assets/charts/puell-multiple-thumb.svg',
  },
  'bitcoin-power-law': {
    title: 'Bitcoin Power Law Chart',
    url: '/charts/bitcoin-power-law',
    thumbnailUrl: '/assets/charts/bitcoin-power-law-thumb.svg',
  },
  'bitcoin-cvdd': {
    title: 'Bitcoin CVDD',
    url: '/charts/bitcoin-cvdd',
    thumbnailUrl: '/assets/charts/bitcoin-cvdd-thumb.svg',
  },
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
