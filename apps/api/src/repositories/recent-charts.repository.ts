interface Queryable {
  query<Row = unknown>(sql: string, values?: unknown[]): Promise<{ rows: Row[] }>;
}

export interface RecentChartRecord {
  userId: string;
  chartId: string;
  viewedAt: string;
}

interface RecentChartRow {
  user_id: string;
  chart_id: string;
  viewed_at: string | Date;
}

export class RecentChartsRepository {
  constructor(private readonly database: Queryable | undefined) {}

  async upsert(userId: string, chartId: string): Promise<void> {
    await this.requireDatabase().query(
      `
        INSERT INTO user_recent_charts (user_id, chart_id, viewed_at)
        VALUES ($1, $2, NOW())
        ON CONFLICT (user_id, chart_id) DO UPDATE SET viewed_at = NOW()
      `,
      [userId, chartId],
    );
  }

  async pruneToLimit(userId: string, limit: number): Promise<void> {
    await this.requireDatabase().query(
      `
        DELETE FROM user_recent_charts
        WHERE user_id = $1
          AND chart_id NOT IN (
            SELECT chart_id
            FROM user_recent_charts
            WHERE user_id = $1
            ORDER BY viewed_at DESC
            LIMIT $2
          )
      `,
      [userId, limit],
    );
  }

  async listForUser(userId: string, limit: number): Promise<RecentChartRecord[]> {
    const result = await this.requireDatabase().query<RecentChartRow>(
      `
        SELECT user_id, chart_id, viewed_at
        FROM user_recent_charts
        WHERE user_id = $1
        ORDER BY viewed_at DESC
        LIMIT $2
      `,
      [userId, limit],
    );

    return result.rows.map((row) => ({
      userId: row.user_id,
      chartId: row.chart_id,
      viewedAt:
        row.viewed_at instanceof Date
          ? row.viewed_at.toISOString()
          : new Date(row.viewed_at).toISOString(),
    }));
  }

  private requireDatabase(): Queryable {
    if (!this.database) {
      throw new Error('Database is not configured');
    }

    return this.database;
  }
}
