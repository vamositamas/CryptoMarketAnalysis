import { AlertsRepository, type AlertRecord, type CreateAlertInput } from '../repositories/alerts.repository';
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
const VALID_CHART_IDS = ['bitcoin-rainbow', 'pi-cycle-top', 'stock-to-flow'] as const;
const MAX_ALERTS_FREE_TIER = 5;

interface AlertsStore {
  create(userId: string, input: CreateAlertInput): Promise<AlertRecord>;
  countActiveForUser(userId: string): Promise<number>;
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

    if (userRole === 'free_user') {
      const count = await this.repository.countActiveForUser(userId);
      if (count >= MAX_ALERTS_FREE_TIER) {
        throw new AlertsError(
          'Free users can create maximum 5 alerts. Upgrade to Premium for unlimited alerts.',
          403,
        );
      }
    }

    return this.repository.create(userId, {
      chartId: chartId.trim(),
      metricName: metricName.trim(),
      condition,
      thresholdValue,
      alertName: alertName.trim(),
    });
  }
}
