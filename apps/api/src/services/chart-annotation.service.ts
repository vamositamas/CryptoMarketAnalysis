import {
  ChartAnnotationRepository,
  type ChartAnnotationRecord,
  type CreateChartAnnotationRecord,
} from '../repositories/chart-annotation.repository';

export type CreateChartAnnotationRequest =
  | {
      chartId: string;
      type: 'note';
      date: string;
      priceLevel: number;
      text: string;
      color: string;
    }
  | {
      chartId: string;
      type: 'trendline';
      startDate: string;
      startPrice: number;
      endDate: string;
      endPrice: number;
      color: string;
    };

export class ChartAnnotationError extends Error {
  constructor(
    readonly statusCode: number,
    message: string,
  ) {
    super(message);
  }
}

interface ChartAnnotationStore {
  listForChart(userId: string, chartId: string): Promise<ChartAnnotationRecord[]>;
  countForChart(userId: string, chartId: string): Promise<number>;
  create(input: CreateChartAnnotationRecord): Promise<ChartAnnotationRecord>;
  deleteOwned(userId: string, annotationId: string): Promise<boolean>;
}

const MAX_ANNOTATIONS_PER_CHART = 50;
const SUPPORTED_CHART_IDS = new Set([
  '200-week-ma-heatmap',
  '2yr-ma-multiplier',
  'bitcoin-cvdd',
  'bitcoin-power-law',
  'bitcoin-rainbow',
  'difficulty-ribbon',
  'dxy-bitcoin',
  'excess-liquidity',
  'fear-greed-index',
  'halving-progress',
  'hash-ribbons',
  'mayer-multiple',
  'mvrv-z-score',
  'nupl',
  'nvt-ratio',
  'pi-cycle-top',
  'price-forecast-tools',
  'puell-multiple',
  'realized-price',
  'spx-liquidity',
  'sopr-ratio',
  'stock-to-flow',
  'stock-to-income',
  'thermocap-multiple',
  'vdd-multiple',
]);
const HEX_COLOR_PATTERN = /^#[0-9A-Fa-f]{6}$/;

export class ChartAnnotationService {
  constructor(private readonly annotations: ChartAnnotationStore = new ChartAnnotationRepository()) {}

  async list(userId: string, chartId: unknown): Promise<ChartAnnotationRecord[]> {
    const normalizedChartId = parseChartId(chartId);
    return this.annotations.listForChart(userId, normalizedChartId);
  }

  async create(
    userId: string,
    request: CreateChartAnnotationRequest,
  ): Promise<ChartAnnotationRecord> {
    const normalized = normalizeCreateRequest(userId, request);
    const count = await this.annotations.countForChart(userId, normalized.chartId);

    if (count >= MAX_ANNOTATIONS_PER_CHART) {
      throw new ChartAnnotationError(400, 'Maximum 50 annotations per chart');
    }

    return this.annotations.create(normalized);
  }

  async delete(userId: string, annotationId: string): Promise<void> {
    const deleted = await this.annotations.deleteOwned(userId, annotationId);

    if (!deleted) {
      throw new ChartAnnotationError(404, 'Annotation not found');
    }
  }
}

function normalizeCreateRequest(
  userId: string,
  request: CreateChartAnnotationRequest,
): CreateChartAnnotationRecord {
  const chartId = parseChartId(request.chartId);
  const color = parseColor(request.color);

  if (request.type === 'note') {
    const text = request.text.trim();

    if (!text) {
      throw new ChartAnnotationError(400, 'Annotation text is required');
    }

    return {
      userId,
      chartId,
      type: 'note',
      date: parseIsoDate(request.date, 'date'),
      priceLevel: parseNumber(request.priceLevel, 'priceLevel'),
      text,
      color,
    };
  }

  if (request.type === 'trendline') {
    return {
      userId,
      chartId,
      type: 'trendline',
      startDate: parseIsoDate(request.startDate, 'startDate'),
      startPrice: parseNumber(request.startPrice, 'startPrice'),
      endDate: parseIsoDate(request.endDate, 'endDate'),
      endPrice: parseNumber(request.endPrice, 'endPrice'),
      color,
    };
  }

  throw new ChartAnnotationError(400, 'Unsupported annotation type');
}

function parseChartId(value: unknown): string {
  if (typeof value !== 'string' || !SUPPORTED_CHART_IDS.has(value)) {
    throw new ChartAnnotationError(400, 'Unsupported chart');
  }

  return value;
}

function parseColor(value: unknown): string {
  if (typeof value !== 'string' || !HEX_COLOR_PATTERN.test(value)) {
    throw new ChartAnnotationError(400, 'Invalid annotation color');
  }

  return value;
}

function parseIsoDate(value: unknown, field: string): string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new ChartAnnotationError(400, `${field} must be an ISO date`);
  }

  return value;
}

function parseNumber(value: unknown, field: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new ChartAnnotationError(400, `${field} must be a number`);
  }

  return value;
}
