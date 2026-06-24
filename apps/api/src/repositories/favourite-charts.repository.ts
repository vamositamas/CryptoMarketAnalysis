interface Queryable {
  query<Row = unknown>(sql: string, values?: unknown[]): Promise<{ rows: Row[] }>;
}

export interface FavouriteChartRecord {
  userId: string;
  chartId: string;
  createdAt: string;
}

interface FavouriteChartRow {
  user_id: string;
  chart_id: string;
  created_at: string | Date;
}

export class FavouriteChartsRepository {
  constructor(private readonly database: Queryable | undefined) {}

  async toggle(userId: string, chartId: string): Promise<boolean> {
    const db = this.requireDatabase();
    const existing = await db.query<{ id: string }>(
      `SELECT id FROM user_favourite_charts WHERE user_id = $1 AND chart_id = $2`,
      [userId, chartId],
    );

    if (existing.rows.length > 0) {
      await db.query(
        `DELETE FROM user_favourite_charts WHERE user_id = $1 AND chart_id = $2`,
        [userId, chartId],
      );
      return false;
    }

    await db.query(
      `INSERT INTO user_favourite_charts (user_id, chart_id) VALUES ($1, $2)`,
      [userId, chartId],
    );
    return true;
  }

  async listForUser(userId: string): Promise<FavouriteChartRecord[]> {
    const result = await this.requireDatabase().query<FavouriteChartRow>(
      `SELECT user_id, chart_id, created_at
       FROM user_favourite_charts
       WHERE user_id = $1
       ORDER BY created_at DESC`,
      [userId],
    );

    return result.rows.map((row) => ({
      userId: row.user_id,
      chartId: row.chart_id,
      createdAt:
        row.created_at instanceof Date
          ? row.created_at.toISOString()
          : new Date(row.created_at).toISOString(),
    }));
  }

  async isFavourite(userId: string, chartId: string): Promise<boolean> {
    const result = await this.requireDatabase().query<{ id: string }>(
      `SELECT id FROM user_favourite_charts WHERE user_id = $1 AND chart_id = $2`,
      [userId, chartId],
    );
    return result.rows.length > 0;
  }

  private requireDatabase(): Queryable {
    if (!this.database) throw new Error('Database is not configured');
    return this.database;
  }
}
