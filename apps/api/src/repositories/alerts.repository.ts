interface Queryable {
  query<Row = unknown>(sql: string, values?: unknown[]): Promise<{ rows: Row[] }>;
}

export interface AlertRecord {
  id: string;
  userId: string;
  chartId: string;
  metricName: string;
  condition: string;
  thresholdValue: number;
  alertName: string;
  status: string;
  createdAt: string;
  lastEvaluatedAt: string | null;
  triggeredAt: string | null;
}

interface AlertRow {
  id: string;
  user_id: string;
  chart_id: string;
  metric_name: string;
  condition: string;
  threshold_value: string;
  alert_name: string;
  status: string;
  created_at: string | Date;
  last_evaluated_at: string | Date | null;
  triggered_at: string | Date | null;
}

export interface CreateAlertInput {
  chartId: string;
  metricName: string;
  condition: string;
  thresholdValue: number;
  alertName: string;
}

export class AlertsRepository {
  constructor(private readonly database: Queryable | undefined) {}

  async create(userId: string, input: CreateAlertInput): Promise<AlertRecord> {
    const result = await this.requireDatabase().query<AlertRow>(
      `INSERT INTO user_alerts (user_id, chart_id, metric_name, condition, threshold_value, alert_name)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, user_id, chart_id, metric_name, condition, threshold_value, alert_name, status, created_at, last_evaluated_at, triggered_at`,
      [userId, input.chartId, input.metricName, input.condition, input.thresholdValue, input.alertName],
    );

    return toAlertRecord(result.rows[0]);
  }

  async countActiveForUser(userId: string): Promise<number> {
    const result = await this.requireDatabase().query<{ count: string }>(
      `SELECT COUNT(*) AS count FROM user_alerts WHERE user_id = $1 AND status = 'active'`,
      [userId],
    );

    return parseInt(result.rows[0]?.count ?? '0', 10);
  }

  private requireDatabase(): Queryable {
    if (!this.database) {
      throw new Error('Database is not configured');
    }

    return this.database;
  }
}

function toIsoString(value: string | Date | null): string | null {
  if (value === null) return null;
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function toAlertRecord(row: AlertRow): AlertRecord {
  return {
    id: row.id,
    userId: row.user_id,
    chartId: row.chart_id,
    metricName: row.metric_name,
    condition: row.condition,
    thresholdValue: parseFloat(row.threshold_value),
    alertName: row.alert_name,
    status: row.status,
    createdAt: toIsoString(row.created_at) ?? new Date().toISOString(),
    lastEvaluatedAt: toIsoString(row.last_evaluated_at),
    triggeredAt: toIsoString(row.triggered_at),
  };
}
