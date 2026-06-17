import { BaseRepository } from './base.repository';

export interface DashboardWidgetRecord {
  id: string;
  userId: string;
  widgetType: string;
  widgetConfig: Record<string, unknown> | null;
  position: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateDashboardWidgetInput {
  widgetType: string;
  widgetConfig: Record<string, unknown> | null;
  position: number;
}

interface DashboardWidgetRow {
  id: string;
  user_id: string;
  widget_type: string;
  widget_config: Record<string, unknown> | null;
  position: number;
  created_at: string | Date;
  updated_at: string | Date;
}

interface Queryable {
  query<Row>(sql: string, values?: unknown[]): Promise<{ rows: Row[] }>;
}

export class DashboardWidgetRepository extends BaseRepository {
  constructor(private readonly database: Queryable) {
    super();
  }

  async listForUser(userId: string): Promise<DashboardWidgetRecord[]> {
    const result = await this.database.query<DashboardWidgetRow>(
      `
        SELECT *
        FROM user_dashboard_widgets
        WHERE user_id = $1
        ORDER BY position ASC
      `,
      [userId],
    );

    return result.rows.map(toRecord);
  }

  async createMany(
    userId: string,
    widgets: CreateDashboardWidgetInput[],
  ): Promise<DashboardWidgetRecord[]> {
    if (widgets.length === 0) {
      return [];
    }

    const columnsPerRecord = 4;
    const values = widgets.flatMap((widget) => [
      userId,
      widget.widgetType,
      JSON.stringify(widget.widgetConfig),
      widget.position,
    ]);
    const placeholders = widgets
      .map((_, index) => {
        const offset = index * columnsPerRecord;

        return `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4})`;
      })
      .join(', ');

    const result = await this.database.query<DashboardWidgetRow>(
      `
        INSERT INTO user_dashboard_widgets (user_id, widget_type, widget_config, position)
        VALUES ${placeholders}
        RETURNING *
      `,
      values,
    );

    return result.rows.map(toRecord);
  }

  async create(
    userId: string,
    widget: CreateDashboardWidgetInput,
  ): Promise<DashboardWidgetRecord> {
    const result = await this.database.query<DashboardWidgetRow>(
      `
        INSERT INTO user_dashboard_widgets (user_id, widget_type, widget_config, position)
        VALUES ($1, $2, $3, $4)
        RETURNING *
      `,
      [userId, widget.widgetType, JSON.stringify(widget.widgetConfig), widget.position],
    );

    return toRecord(result.rows[0]);
  }

  async countForUser(userId: string): Promise<number> {
    const result = await this.database.query<{ count: number }>(
      `
        SELECT COUNT(*)::int AS count
        FROM user_dashboard_widgets
        WHERE user_id = $1
      `,
      [userId],
    );

    return Number(result.rows[0]?.count ?? 0);
  }

  async getMaxPosition(userId: string): Promise<number | null> {
    const result = await this.database.query<{ max_position: number | string | null }>(
      `
        SELECT MAX(position) AS max_position
        FROM user_dashboard_widgets
        WHERE user_id = $1
      `,
      [userId],
    );
    const maxPosition = result.rows[0]?.max_position;

    return maxPosition === null || maxPosition === undefined ? null : Number(maxPosition);
  }
}

function toRecord(row: DashboardWidgetRow): DashboardWidgetRecord {
  return {
    id: row.id,
    userId: row.user_id,
    widgetType: row.widget_type,
    widgetConfig: row.widget_config,
    position: row.position,
    createdAt: toIsoString(row.created_at),
    updatedAt: toIsoString(row.updated_at),
  };
}

function toIsoString(value: string | Date): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}
