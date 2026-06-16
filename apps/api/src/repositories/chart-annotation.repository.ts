import { Pool } from 'pg';
import { getDatabasePool } from '../config/database.config';
import { BaseRepository } from './base.repository';

export type ChartAnnotationType = 'note' | 'trendline';

export interface ChartAnnotationRecord {
  id: string;
  userId: string;
  chartId: string;
  type: ChartAnnotationType;
  date?: string;
  priceLevel?: number;
  text?: string;
  startDate?: string;
  startPrice?: number;
  endDate?: string;
  endPrice?: number;
  color: string;
  createdAt: string;
}

export type CreateChartAnnotationRecord = Omit<ChartAnnotationRecord, 'id' | 'createdAt'>;

interface ChartAnnotationRow {
  id: string;
  user_id: string;
  chart_id: string;
  type: ChartAnnotationType;
  date: string | Date | null;
  price_level: string | number | null;
  text: string | null;
  start_date: string | Date | null;
  start_price: string | number | null;
  end_date: string | Date | null;
  end_price: string | number | null;
  color: string;
  created_at: string | Date;
}

export class ChartAnnotationRepository extends BaseRepository {
  constructor(private readonly pool: Pick<Pool, 'query'> | undefined = getDatabasePool()) {
    super();
  }

  async listForChart(userId: string, chartId: string): Promise<ChartAnnotationRecord[]> {
    const result = await this.requirePool().query(
      `
        SELECT *
        FROM user_chart_annotations
        WHERE user_id = $1 AND chart_id = $2
        ORDER BY created_at ASC
      `,
      [userId, chartId],
    );

    return result.rows.map((row) => toRecord(row as ChartAnnotationRow));
  }

  async countForChart(userId: string, chartId: string): Promise<number> {
    const result = await this.requirePool().query(
      `
        SELECT COUNT(*)::int AS count
        FROM user_chart_annotations
        WHERE user_id = $1 AND chart_id = $2
      `,
      [userId, chartId],
    );

    return Number(result.rows[0]?.count ?? 0);
  }

  async create(input: CreateChartAnnotationRecord): Promise<ChartAnnotationRecord> {
    const result = await this.requirePool().query(
      `
        INSERT INTO user_chart_annotations (
          user_id,
          chart_id,
          type,
          date,
          price_level,
          text,
          start_date,
          start_price,
          end_date,
          end_price,
          color
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        RETURNING *
      `,
      [
        input.userId,
        input.chartId,
        input.type,
        input.date,
        input.priceLevel,
        input.text,
        input.startDate,
        input.startPrice,
        input.endDate,
        input.endPrice,
        input.color,
      ],
    );

    return toRecord(result.rows[0] as ChartAnnotationRow);
  }

  async deleteOwned(userId: string, annotationId: string): Promise<boolean> {
    const result = await this.requirePool().query(
      `
        DELETE FROM user_chart_annotations
        WHERE user_id = $1 AND id = $2
      `,
      [userId, annotationId],
    );

    return (result.rowCount ?? 0) > 0;
  }

  private requirePool(): Pick<Pool, 'query'> {
    if (!this.pool) {
      throw new Error('Database is not configured');
    }

    return this.pool;
  }
}

function toRecord(row: ChartAnnotationRow): ChartAnnotationRecord {
  return {
    id: row.id,
    userId: row.user_id,
    chartId: row.chart_id,
    type: row.type,
    date: row.date === null ? undefined : formatDate(row.date),
    priceLevel: row.price_level === null ? undefined : Number(row.price_level),
    text: row.text ?? undefined,
    startDate: row.start_date === null ? undefined : formatDate(row.start_date),
    startPrice: row.start_price === null ? undefined : Number(row.start_price),
    endDate: row.end_date === null ? undefined : formatDate(row.end_date),
    endPrice: row.end_price === null ? undefined : Number(row.end_price),
    color: row.color,
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : new Date(row.created_at).toISOString(),
  };
}

function formatDate(value: string | Date): string {
  return value instanceof Date ? value.toISOString().slice(0, 10) : value;
}
