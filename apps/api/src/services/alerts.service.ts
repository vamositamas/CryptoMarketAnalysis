import { AlertsRepository, type AlertRecord, type CreateAlertInput, type UpdateAlertInput } from '../repositories/alerts.repository';
import { getDatabasePool } from '../config/database.config';

export class AlertsError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
  ) {
    super(message);
  }
}

const VALID_CONDITIONS = ['crosses_above', 'crosses_below', 'greater_than', 'less_than', 'equals'] as const;
const VALID_CHART_IDS = [
  'bitcoin-rainbow',
  'pi-cycle-top',
  'stock-to-flow',
  'mvrv-z-score',
  'fear-greed-index',
  'puell-multiple',
  'mayer-multiple',
  'vdd-multiple',
  'realized-price',
  'bitcoin-cvdd',
  'bitcoin-power-law',
  'hash-ribbons',
  'difficulty-ribbon',
  'nvt-ratio',
  'thermocap-multiple',
  '200-week-ma-heatmap',
  '2yr-ma-multiplier',
  'price-forecast-tools',
  'stock-to-income',
  'global-m2-bitcoin',
  'dxy-bitcoin',
] as const;

const CHART_TITLES: Record<string, string> = {
  'bitcoin-rainbow':    'Bitcoin Rainbow Price Chart',
  'pi-cycle-top':       'Pi Cycle Top Indicator',
  'stock-to-flow':      'Stock-to-Flow Model',
  'mvrv-z-score':       'MVRV Z-Score',
  'fear-greed-index':   'Fear & Greed Index',
  'puell-multiple':     'Puell Multiple',
  'mayer-multiple':     'Mayer Multiple',
  'vdd-multiple':       'VDD Multiple',
  'realized-price':     'Realized Price',
  'bitcoin-cvdd':       'Bitcoin CVDD',
  'bitcoin-power-law':  'Bitcoin Power Law',
  'hash-ribbons':       'Hash Ribbons',
  'difficulty-ribbon':  'Difficulty Ribbon',
  'nvt-ratio':          'NVT Ratio',
  'thermocap-multiple': 'Thermocap Multiple',
  '200-week-ma-heatmap':'200-Week MA Heatmap',
  '2yr-ma-multiplier':  '2-Year MA Multiplier',
  'price-forecast-tools':'Price Forecast Tools',
  'stock-to-income':    'Stock-to-Income',
  'global-m2-bitcoin':  'Global M2 vs BTC YoY',
  'dxy-bitcoin':        'DXY vs Bitcoin',
};

export interface AlertWithTitle extends AlertRecord {
  chartTitle: string;
}

export interface AlertLimit {
  used: number;
  max: number | null;
  unlimited: boolean;
}

export interface AlertsListResponse {
  alerts: AlertWithTitle[];
  alertLimit: AlertLimit;
}

interface AlertsStore {
  create(userId: string, input: CreateAlertInput): Promise<AlertRecord>;
  countActiveForUser(userId: string): Promise<number>;
  countForUser(userId: string): Promise<number>;
  listForUser(userId: string): Promise<AlertRecord[]>;
  updateForUser(userId: string, alertId: string, input: UpdateAlertInput): Promise<AlertRecord | null>;
  deleteForUser(userId: string, alertId: string): Promise<boolean>;
  resetForUser(userId: string, alertId: string): Promise<AlertRecord | null>;
}

export class AlertsService {
  constructor(
    private readonly repository: AlertsStore = new AlertsRepository(getDatabasePool()),
  ) {}

  async createAlert(userId: string, userRole: string, body: unknown): Promise<AlertRecord> {
    if (typeof body !== 'object' || body === null) {
      throw new AlertsError('Request body is required', 400);
    }

    const { chartId, metricName, condition, thresholdValue, alertName } =
      body as Record<string, unknown>;

    if (typeof chartId !== 'string' || !chartId.trim()) {
      throw new AlertsError('chartId is required', 400);
    }
    if (!(VALID_CHART_IDS as readonly string[]).includes(chartId)) {
      throw new AlertsError(`chartId must be one of: ${VALID_CHART_IDS.join(', ')}`, 400);
    }

    if (typeof metricName !== 'string' || !metricName.trim()) {
      throw new AlertsError('metricName is required', 400);
    }
    if (metricName.length > 100) {
      throw new AlertsError('metricName must not exceed 100 characters', 400);
    }

    if (typeof condition !== 'string' || !(VALID_CONDITIONS as readonly string[]).includes(condition)) {
      throw new AlertsError(`condition must be one of: ${VALID_CONDITIONS.join(', ')}`, 400);
    }

    if (typeof thresholdValue !== 'number' || !isFinite(thresholdValue)) {
      throw new AlertsError('thresholdValue must be a finite number', 400);
    }

    if (typeof alertName !== 'string' || !alertName.trim()) {
      throw new AlertsError('alertName is required', 400);
    }
    if (alertName.length > 255) {
      throw new AlertsError('alertName must not exceed 255 characters', 400);
    }

    return this.repository.create(userId, {
      chartId: chartId.trim(),
      metricName: metricName.trim(),
      condition,
      thresholdValue,
      alertName: alertName.trim(),
    });
  }

  async updateAlert(userId: string, alertId: string, body: unknown): Promise<AlertWithTitle> {
    if (!alertId?.trim()) throw new AlertsError('alertId is required', 400);
    if (typeof body !== 'object' || body === null) throw new AlertsError('Request body is required', 400);

    const { alertName, condition, thresholdValue, status } = body as Record<string, unknown>;
    const input: UpdateAlertInput = {};

    if (alertName !== undefined) {
      if (typeof alertName !== 'string' || !alertName.trim()) throw new AlertsError('alertName must be a non-empty string', 400);
      input.alertName = alertName.trim();
    }
    if (condition !== undefined) {
      if (!(VALID_CONDITIONS as readonly string[]).includes(condition as string)) {
        throw new AlertsError(`condition must be one of: ${VALID_CONDITIONS.join(', ')}`, 400);
      }
      input.condition = condition as string;
    }
    if (thresholdValue !== undefined) {
      if (typeof thresholdValue !== 'number' || !isFinite(thresholdValue)) throw new AlertsError('thresholdValue must be a finite number', 400);
      input.thresholdValue = thresholdValue;
    }
    if (status !== undefined) {
      if (!['active', 'paused'].includes(status as string)) throw new AlertsError('status must be active or paused', 400);
      input.status = status as string;
    }

    const alert = await this.repository.updateForUser(userId, alertId, input);
    if (!alert) throw new AlertsError('Alert not found', 404);
    return { ...alert, chartTitle: CHART_TITLES[alert.chartId] ?? alert.chartId };
  }

  async listAlerts(userId: string): Promise<AlertsListResponse> {
    const [alerts, used] = await Promise.all([
      this.repository.listForUser(userId),
      this.repository.countForUser(userId),
    ]);

    return {
      alerts: alerts.map((alert) => ({
        ...alert,
        chartTitle: CHART_TITLES[alert.chartId] ?? alert.chartId,
      })),
      alertLimit: {
        used,
        max: null,
        unlimited: true,
      },
    };
  }

  async deleteAlert(userId: string, alertId: string): Promise<void> {
    if (!alertId?.trim()) {
      throw new AlertsError('alertId is required', 400);
    }

    const deleted = await this.repository.deleteForUser(userId, alertId);

    if (!deleted) {
      throw new AlertsError('Alert not found', 404);
    }
  }

  async resetAlert(userId: string, alertId: string): Promise<AlertWithTitle> {
    if (!alertId?.trim()) {
      throw new AlertsError('alertId is required', 400);
    }

    const alert = await this.repository.resetForUser(userId, alertId);

    if (!alert) {
      throw new AlertsError('Alert not found or not in triggered state', 404);
    }

    return { ...alert, chartTitle: CHART_TITLES[alert.chartId] ?? alert.chartId };
  }
}
