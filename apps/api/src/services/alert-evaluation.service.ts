import type { AlertTriggeredEmailSender } from './email.service';

interface Queryable {
  query<Row = unknown>(sql: string, values?: unknown[]): Promise<{ rows: Row[] }>;
}

export interface AlertEvaluationSummary {
  evaluated: number;
  triggered: number;
  skipped: number;
}

interface ActiveAlertRow {
  id: string;
  alert_name: string;
  chart_id: string;
  metric_name: string;
  condition: string;
  threshold_value: string;
  user_email: string;
}

interface MetricValueRow {
  metric_name: string;
  metric_value: string;
}

interface PriceRow {
  price_usd: string;
}

interface TriggerInsertRow {
  id: string;
}

// Some alert metric names differ from their bitcoin_metrics_daily column names
const METRIC_DB_NAMES: Record<string, string> = {
  ma_350x2_day: 'ma_350_day',
};

const METRIC_MULTIPLIERS: Record<string, number> = {
  ma_350x2_day: 2,
};

const METRIC_LABELS: Record<string, string> = {
  rainbow_band: 'Rainbow Band',
  btc_price: 'BTC Price (USD)',
  ma_111_day: '111-Day Moving Average',
  ma_350x2_day: '350-Day MA × 2',
  stock_to_flow_ratio: 'Stock-to-Flow Ratio',
  mvrv_zscore: 'MVRV Z-Score',
  fear_greed_index: 'Fear & Greed Index',
};

const CONDITION_LABELS: Record<string, string> = {
  crosses_above: 'crossed above',
  crosses_below: 'crossed below',
  greater_than: 'is greater than',
  less_than: 'is less than',
  equals: 'equals',
};

const CHART_TITLES: Record<string, string> = {
  'bitcoin-rainbow': 'Bitcoin Rainbow Price Chart',
  'pi-cycle-top': 'Pi Cycle Top Indicator',
  'stock-to-flow': 'Stock-to-Flow Model',
};

interface TemplateLoader {
  getTemplate(key: string): Promise<string | null>;
}

export class AlertEvaluationService {
  private readonly emailService: AlertTriggeredEmailSender | undefined;
  private readonly templateLoader: TemplateLoader | undefined;
  private readonly logger: Pick<Console, 'warn'>;

  constructor(
    private readonly database: Queryable | undefined,
    options: {
      emailService?: AlertTriggeredEmailSender;
      templateLoader?: TemplateLoader;
      logger?: Pick<Console, 'warn'>;
    } = {},
  ) {
    this.emailService = options.emailService;
    this.templateLoader = options.templateLoader;
    this.logger = options.logger ?? console;
  }

  async evaluateAlerts(now: Date = new Date()): Promise<AlertEvaluationSummary> {
    const db = this.requireDatabase();

    const alertsResult = await db.query<ActiveAlertRow>(
      `SELECT ua.id, ua.alert_name, ua.chart_id, ua.metric_name, ua.condition, ua.threshold_value, u.email AS user_email
       FROM user_alerts ua
       JOIN users u ON ua.user_id = u.id
       WHERE ua.status = 'active'`,
    );
    const alerts = alertsResult.rows;

    if (alerts.length === 0) {
      return { evaluated: 0, triggered: 0, skipped: 0 };
    }

    const metricValues = await this.fetchMetricValues(db, alerts);

    const [customHtml, customSubject] = await Promise.all([
      this.templateLoader?.getTemplate('alert_triggered_html') ?? Promise.resolve(null),
      this.templateLoader?.getTemplate('alert_triggered_subject') ?? Promise.resolve(null),
    ]);

    let triggered = 0;
    let skipped = 0;
    const nowIso = now.toISOString();

    for (const alert of alerts) {
      const currentValue = metricValues.get(alert.metric_name);

      if (currentValue === undefined) {
        skipped++;
        continue;
      }

      const threshold = parseFloat(alert.threshold_value);
      const conditionMet = evaluateCondition(alert.condition, currentValue, threshold);

      if (conditionMet) {
        await db.query(
          `UPDATE user_alerts
           SET status = 'triggered', triggered_at = $1, last_evaluated_at = $1
           WHERE id = $2::uuid`,
          [nowIso, alert.id],
        );

        const triggerResult = await db.query<TriggerInsertRow>(
          `INSERT INTO alert_triggers (alert_id, triggered_at, metric_value)
           VALUES ($1::uuid, $2, $3) RETURNING id`,
          [alert.id, nowIso, currentValue],
        );
        const triggerId = triggerResult.rows[0]?.id;

        await this.sendNotification(db, alert, currentValue, triggerId, nowIso, customHtml, customSubject);
        triggered++;
      } else {
        await db.query(
          `UPDATE user_alerts SET last_evaluated_at = $1 WHERE id = $2::uuid`,
          [nowIso, alert.id],
        );
      }
    }

    return { evaluated: alerts.length, triggered, skipped };
  }

  private async sendNotification(
    db: Queryable,
    alert: ActiveAlertRow,
    currentValue: number,
    triggerId: string | undefined,
    nowIso: string,
    customHtml: string | null,
    customSubject: string | null,
  ): Promise<void> {
    if (!this.emailService || !triggerId) {
      return;
    }

    try {
      await this.emailService.sendAlertTriggeredEmail({
        userEmail: alert.user_email,
        alertName: alert.alert_name,
        chartTitle: CHART_TITLES[alert.chart_id] ?? alert.chart_id,
        metricLabel: METRIC_LABELS[alert.metric_name] ?? alert.metric_name.replace(/_/g, ' '),
        conditionLabel: CONDITION_LABELS[alert.condition] ?? alert.condition,
        thresholdValue: parseFloat(alert.threshold_value),
        currentValue,
        triggeredAt: nowIso,
        htmlTemplate: customHtml,
        subjectTemplate: customSubject,
      });

      await db.query(
        `UPDATE alert_triggers SET notification_sent = true, notification_sent_at = $1 WHERE id = $2::uuid`,
        [nowIso, triggerId],
      );
    } catch (error) {
      this.logger.warn('Failed to send alert triggered email', {
        alertId: alert.id,
        triggerId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private async fetchMetricValues(
    db: Queryable,
    alerts: ActiveAlertRow[],
  ): Promise<Map<string, number>> {
    const values = new Map<string, number>();
    const alertMetricNames = [...new Set(alerts.map((a) => a.metric_name))];

    if (alertMetricNames.includes('btc_price')) {
      const result = await db.query<PriceRow>(
        `SELECT price_usd FROM bitcoin_price_daily ORDER BY date DESC LIMIT 1`,
      );
      if (result.rows[0]) {
        values.set('btc_price', parseFloat(result.rows[0].price_usd));
      }
    }

    const nonPriceMetrics = alertMetricNames.filter((n) => n !== 'btc_price');

    if (nonPriceMetrics.length > 0) {
      const dbToAlert = new Map<string, [string, number]>();
      for (const name of nonPriceMetrics) {
        dbToAlert.set(METRIC_DB_NAMES[name] ?? name, [name, METRIC_MULTIPLIERS[name] ?? 1]);
      }

      const dbNames = [...dbToAlert.keys()];
      const result = await db.query<MetricValueRow>(
        `SELECT DISTINCT ON (metric_name) metric_name, metric_value
         FROM bitcoin_metrics_daily
         WHERE metric_name = ANY($1)
         ORDER BY metric_name, date DESC`,
        [dbNames],
      );

      for (const row of result.rows) {
        const entry = dbToAlert.get(row.metric_name);
        if (entry) {
          const [alertName, multiplier] = entry;
          values.set(alertName, parseFloat(row.metric_value) * multiplier);
        }
      }
    }

    return values;
  }

  private requireDatabase(): Queryable {
    if (!this.database) {
      throw new Error('Database is not configured');
    }
    return this.database;
  }
}

export function evaluateCondition(condition: string, value: number, threshold: number): boolean {
  switch (condition) {
    case 'crosses_above':
    case 'greater_than':
      return value > threshold;
    case 'crosses_below':
    case 'less_than':
      return value < threshold;
    case 'equals':
      return Math.abs(value - threshold) <= 0.01;
    default:
      return false;
  }
}
