import {
  type CreateDashboardWidgetInput,
  type DashboardWidgetRecord,
  DashboardWidgetRepository,
} from '../repositories/dashboard-widget.repository';
import {
  DashboardMetricsRepository,
  type MetricPoint,
} from '../repositories/dashboard-metrics.repository';
import { evaluateFormula, validateFormula } from '@crypto-market-analysis/calculation-engines/formula-parser';

export type WidgetTrend = 'up' | 'down' | 'flat';

export interface DashboardWidgetResponse {
  id: string;
  type: string;
  title: string;
  value: number | null;
  formattedValue: string;
  trend: WidgetTrend;
  trendPercent: number | null;
  lastUpdated: string | null;
}

export interface DashboardWidgetsResponse {
  widgets: DashboardWidgetResponse[];
}

export interface CreateDashboardWidgetRequest {
  widgetType?: unknown;
  widgetConfig?: unknown;
}

export class DashboardError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
  ) {
    super(message);
  }
}

interface WidgetConfig {
  title: string;
  decimals: number;
}

interface WidgetCatalogEntry {
  title: string;
  decimals: number;
  [key: string]: unknown;
}

const MAX_WIDGETS_PER_DASHBOARD = 20;
const TOTAL_BITCOIN_SUPPLY = 21_000_000;

const WIDGET_CATALOG: Record<string, WidgetCatalogEntry> = {
  btc_price: { title: 'Current BTC Price', decimals: 2 },
  '24h_change': { title: '24h Price Change', decimals: 1 },
  mvrv_zscore: { title: 'MVRV Z-Score', decimals: 2 },
  stock_to_flow: { title: 'Stock-to-Flow Ratio', decimals: 2 },
  fear_greed: { title: 'Fear & Greed Index', decimals: 0 },
  realized_price: { title: 'Realized Price', decimals: 2 },
  ma_200_day: { title: '200-day Moving Average', decimals: 2 },
  hash_rate: { title: 'Hash Rate', decimals: 0 },
  mining_difficulty: { title: 'Mining Difficulty', decimals: 0 },
  total_supply: { title: 'Total Supply', decimals: 0 },
  circulating_supply: { title: 'Circulating Supply', decimals: 0 },
  market_cap: { title: 'Market Cap', decimals: 0 },
  halving_progress: { title: 'Halving Progress', decimals: 1 },
  btc_rsi_12m: { title: 'BTC RSI (12m)', decimals: 1 },
};

const DEFAULT_WIDGET_TYPES = ['btc_price', '24h_change', 'mvrv_zscore', 'stock_to_flow', 'fear_greed'];

const DEFAULT_WIDGETS: CreateDashboardWidgetInput[] = DEFAULT_WIDGET_TYPES.map((widgetType, position) => ({
  widgetType,
  widgetConfig: WIDGET_CATALOG[widgetType],
  position,
}));

const METRIC_NAME_BY_WIDGET_TYPE: Record<string, string> = {
  mvrv_zscore: 'mvrv_zscore',
  stock_to_flow: 'stock_to_flow_ratio',
  fear_greed: 'fear_greed_index',
  realized_price: 'realized_price',
  ma_200_day: 'ma_200_day',
  hash_rate: 'hash_rate',
  mining_difficulty: 'mining_difficulty',
  btc_rsi_12m: 'btc_rsi_12m',
};

const CURRENCY_WIDGET_TYPES = new Set(['btc_price', 'realized_price', 'ma_200_day', 'market_cap']);
const SUPPLY_WIDGET_TYPES = new Set(['total_supply', 'circulating_supply']);

export class DashboardService {
  constructor(
    private readonly widgetRepository: Pick<
      DashboardWidgetRepository,
      | 'listForUser'
      | 'createMany'
      | 'create'
      | 'countForUser'
      | 'getMaxPosition'
      | 'reorderWidgets'
      | 'deleteForUser'
    >,
    private readonly metricsRepository: Pick<
      DashboardMetricsRepository,
      | 'getLatestPrices'
      | 'getLatestMetricValues'
      | 'getLatestCirculatingSupply'
      | 'getLatestMarketCap'
      | 'getLatestFormulaVariables'
      | 'getLastRefreshTimestamp'
    >,
  ) {}

  async getWidgets(userId: string): Promise<DashboardWidgetsResponse> {
    let widgets = await this.widgetRepository.listForUser(userId);

    if (widgets.length === 0) {
      widgets = await this.widgetRepository.createMany(userId, DEFAULT_WIDGETS);
    }

    const [widgetResponses, refreshTimestamp] = await Promise.all([
      Promise.all(widgets.map((widget) => this.buildWidgetResponse(widget, null))),
      this.metricsRepository.getLastRefreshTimestamp(),
    ]);

    if (refreshTimestamp) {
      for (const w of widgetResponses) {
        if (w.lastUpdated !== null && w.type !== 'total_supply') {
          w.lastUpdated = refreshTimestamp;
        }
      }
    }

    return { widgets: widgetResponses };
  }

  async addWidget(
    userId: string,
    request: CreateDashboardWidgetRequest,
  ): Promise<DashboardWidgetResponse> {
    const widgetType = typeof request.widgetType === 'string' ? request.widgetType : '';

    if (widgetType === 'custom') {
      return this.addCustomWidget(userId, request);
    }

    const catalogEntry = WIDGET_CATALOG[widgetType];

    if (!catalogEntry) {
      throw new DashboardError('Unsupported widget type', 400);
    }

    const existingCount = await this.widgetRepository.countForUser(userId);

    if (existingCount >= MAX_WIDGETS_PER_DASHBOARD) {
      throw new DashboardError('Maximum 20 widgets per dashboard', 400);
    }

    const maxPosition = await this.widgetRepository.getMaxPosition(userId);
    const position = maxPosition === null ? 0 : maxPosition + 1;
    const widgetConfig = isPlainObject(request.widgetConfig)
      ? request.widgetConfig
      : { title: catalogEntry.title, decimals: catalogEntry.decimals };

    const widget = await this.widgetRepository.create(userId, { widgetType, widgetConfig, position });

    return this.buildWidgetResponse(widget);
  }

  async removeWidget(userId: string, widgetId: string): Promise<void> {
    if (!widgetId) throw new DashboardError('Widget ID is required', 400);

    const deleted = await this.widgetRepository.deleteForUser(userId, widgetId);

    if (!deleted) throw new DashboardError('Widget not found', 404);
  }

  async reorderWidgets(userId: string, orderedIds: unknown): Promise<void> {
    if (!Array.isArray(orderedIds) || orderedIds.length === 0) {
      throw new DashboardError('orderedIds must be a non-empty array', 400);
    }

    const ids = orderedIds.filter((id): id is string => typeof id === 'string');

    if (ids.length !== orderedIds.length) {
      throw new DashboardError('All widget IDs must be strings', 400);
    }

    if (new Set(ids).size !== ids.length) {
      throw new DashboardError('Widget IDs must be unique', 400);
    }

    if (ids.length > MAX_WIDGETS_PER_DASHBOARD) {
      throw new DashboardError(`Maximum ${MAX_WIDGETS_PER_DASHBOARD} widgets per dashboard`, 400);
    }

    await this.widgetRepository.reorderWidgets(userId, ids);
  }

  private async addCustomWidget(
    userId: string,
    request: CreateDashboardWidgetRequest,
  ): Promise<DashboardWidgetResponse> {
    const config = request.widgetConfig;

    if (!isPlainObject(config)) {
      throw new DashboardError('Custom widget requires widgetConfig with title and formula', 400);
    }

    const title = typeof config['title'] === 'string' ? config['title'].trim() : '';
    const formula = typeof config['formula'] === 'string' ? config['formula'].trim() : '';
    const description =
      typeof config['description'] === 'string' ? config['description'].trim() : undefined;

    if (!title) {
      throw new DashboardError('Custom widget name is required', 400);
    }

    if (!formula) {
      throw new DashboardError('Custom widget formula is required', 400);
    }

    const validation = validateFormula(formula);

    if (!validation.valid) {
      throw new DashboardError(validation.error ?? 'Invalid formula', 400);
    }

    const existingCount = await this.widgetRepository.countForUser(userId);

    if (existingCount >= MAX_WIDGETS_PER_DASHBOARD) {
      throw new DashboardError('Maximum 20 widgets per dashboard', 400);
    }

    const maxPosition = await this.widgetRepository.getMaxPosition(userId);
    const position = maxPosition === null ? 0 : maxPosition + 1;
    const widgetConfig: Record<string, unknown> = { title, formula };

    if (description) {
      widgetConfig['description'] = description;
    }

    const widget = await this.widgetRepository.create(userId, {
      widgetType: 'custom',
      widgetConfig,
      position,
    });

    return this.buildWidgetResponse(widget);
  }

  private async buildWidgetResponse(widget: DashboardWidgetRecord, _refreshTimestamp?: string | null): Promise<DashboardWidgetResponse> {
    const config = parseWidgetConfig(widget.widgetConfig, widget.widgetType);

    if (widget.widgetType === 'custom') {
      return this.buildCustomWidgetResponse(widget, config);
    }

    if (widget.widgetType === 'halving_progress') {
      const CURRENT_HALVING_MS = Date.parse('2024-04-19T00:00:00Z');
      const NEXT_HALVING_MS = Date.parse('2028-04-21T00:00:00Z');
      const now = Date.now();
      const progressPct = Math.min(100, Math.max(0, ((now - CURRENT_HALVING_MS) / (NEXT_HALVING_MS - CURRENT_HALVING_MS)) * 100));
      return {
        id: widget.id,
        type: widget.widgetType,
        title: config.title,
        value: progressPct,
        formattedValue: `${progressPct.toFixed(1)}%`,
        trend: 'up',
        trendPercent: null,
        lastUpdated: null,
      };
    }

    if (widget.widgetType === 'total_supply') {
      return {
        id: widget.id,
        type: widget.widgetType,
        title: config.title,
        value: TOTAL_BITCOIN_SUPPLY,
        formattedValue: formatWidgetValue('total_supply', TOTAL_BITCOIN_SUPPLY, config.decimals),
        trend: 'flat',
        trendPercent: null,
        lastUpdated: null,
      };
    }

    const points = await this.getMetricPoints(widget.widgetType);
    const latest = points[0] ?? null;
    const previous = points[1] ?? null;

    if (latest === null) {
      return {
        id: widget.id,
        type: widget.widgetType,
        title: config.title,
        value: null,
        formattedValue: 'Waiting for data',
        trend: 'flat',
        trendPercent: null,
        lastUpdated: null,
      };
    }

    const { trend, trendPercent } = computeTrend(latest.value, previous?.value ?? null);
    const value = widget.widgetType === '24h_change' ? trendPercent ?? 0 : latest.value;

    return {
      id: widget.id,
      type: widget.widgetType,
      title: config.title,
      value,
      formattedValue: formatWidgetValue(widget.widgetType, value, config.decimals),
      trend,
      trendPercent,
      lastUpdated: `${latest.date}T00:00:00.000Z`,
    };
  }

  private async getMetricPoints(widgetType: string): Promise<MetricPoint[]> {
    if (widgetType === 'btc_price' || widgetType === '24h_change') {
      return this.metricsRepository.getLatestPrices();
    }

    if (widgetType === 'circulating_supply') {
      return this.metricsRepository.getLatestCirculatingSupply();
    }

    if (widgetType === 'market_cap') {
      return this.metricsRepository.getLatestMarketCap();
    }

    const metricName = METRIC_NAME_BY_WIDGET_TYPE[widgetType];

    if (!metricName) {
      return [];
    }

    return this.metricsRepository.getLatestMetricValues(metricName);
  }

  private async buildCustomWidgetResponse(
    widget: DashboardWidgetRecord,
    config: WidgetConfig,
  ): Promise<DashboardWidgetResponse> {
    const formula =
      typeof widget.widgetConfig?.['formula'] === 'string' ? widget.widgetConfig['formula'] : '';

    if (!formula) {
      return {
        id: widget.id,
        type: 'custom',
        title: config.title,
        value: null,
        formattedValue: 'Calculation Error',
        trend: 'flat',
        trendPercent: null,
        lastUpdated: null,
      };
    }

    const variables = await this.metricsRepository.getLatestFormulaVariables();
    const { value, error } = evaluateFormula(formula, variables);

    return {
      id: widget.id,
      type: 'custom',
      title: config.title,
      value,
      formattedValue: value !== null ? formatCustomValue(value) : (error ?? 'Calculation Error'),
      trend: 'flat',
      trendPercent: null,
      lastUpdated: null,
    };
  }
}

function computeTrend(
  latestValue: number,
  previousValue: number | null,
): { trend: WidgetTrend; trendPercent: number | null } {
  if (previousValue === null || previousValue === 0) {
    return { trend: 'flat', trendPercent: null };
  }

  const percent = ((latestValue - previousValue) / Math.abs(previousValue)) * 100;

  if (percent > 0) {
    return { trend: 'up', trendPercent: roundTo(percent, 2) };
  }

  if (percent < 0) {
    return { trend: 'down', trendPercent: roundTo(percent, 2) };
  }

  return { trend: 'flat', trendPercent: 0 };
}

function roundTo(value: number, decimals: number): number {
  const factor = 10 ** decimals;

  return Math.round(value * factor) / factor;
}

function formatWidgetValue(widgetType: string, value: number, decimals: number): string {
  if (CURRENCY_WIDGET_TYPES.has(widgetType)) {
    return `$${value.toLocaleString('en-US', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    })}`;
  }

  if (widgetType === '24h_change') {
    return `${value >= 0 ? '+' : ''}${value.toFixed(decimals)}%`;
  }

  if (SUPPLY_WIDGET_TYPES.has(widgetType)) {
    return `${value.toLocaleString('en-US', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    })} BTC`;
  }

  return value.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

function formatCustomValue(value: number): string {
  const abs = Math.abs(value);

  if (abs >= 1_000_000) {
    return value.toLocaleString('en-US', { maximumFractionDigits: 0 });
  }

  return value.toLocaleString('en-US', { maximumFractionDigits: 4 });
}

function parseWidgetConfig(raw: Record<string, unknown> | null, fallbackTitle: string): WidgetConfig {
  const title = typeof raw?.['title'] === 'string' ? (raw['title'] as string) : fallbackTitle;
  const decimals = typeof raw?.['decimals'] === 'number' ? (raw['decimals'] as number) : 2;

  return { title, decimals };
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
