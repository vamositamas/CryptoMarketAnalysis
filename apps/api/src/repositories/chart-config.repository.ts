import type { Pool } from 'pg';

export interface ChartConfigRecord {
  id: string;
  chartId: string;
  title: string;
  category: string;
  accessTier: 'free' | 'premium';
  description: string | null;
  methodology: string | null;
  status: 'draft' | 'active' | 'inactive';
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateChartConfigInput {
  chartId: string;
  title: string;
  category: string;
  accessTier: 'free' | 'premium';
  description?: string | null;
  methodology?: string | null;
  status: 'draft' | 'active' | 'inactive';
  createdBy?: string | null;
}

export interface UpdateChartConfigInput {
  title?: string;
  category?: string;
  accessTier?: 'free' | 'premium';
  description?: string | null;
  methodology?: string | null;
  status?: 'draft' | 'active' | 'inactive';
}

function toRecord(row: Record<string, unknown>): ChartConfigRecord {
  return {
    id: row['id'] as string,
    chartId: row['chart_id'] as string,
    title: row['title'] as string,
    category: row['category'] as string,
    accessTier: row['access_tier'] as 'free' | 'premium',
    description: (row['description'] as string | null) ?? null,
    methodology: (row['methodology'] as string | null) ?? null,
    status: row['status'] as 'draft' | 'active' | 'inactive',
    createdBy: (row['created_by'] as string | null) ?? null,
    createdAt: (row['created_at'] as Date).toISOString(),
    updatedAt: (row['updated_at'] as Date).toISOString(),
  };
}

export class ChartConfigRepository {
  constructor(private readonly db: Pick<Pool, 'query'>) {}

  async list(opts: {
    page: number;
    limit: number;
    status?: string;
  }): Promise<{ charts: ChartConfigRecord[]; total: number }> {
    const offset = (opts.page - 1) * opts.limit;
    const conditions: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    if (opts.status) {
      conditions.push(`status = $${idx++}`);
      values.push(opts.status);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const countResult = await this.db.query<{ count: string }>(
      `SELECT COUNT(*) as count FROM chart_configs ${where}`,
      values,
    );
    const total = parseInt(countResult.rows[0]?.count ?? '0', 10);

    const rows = await this.db.query<Record<string, unknown>>(
      `SELECT * FROM chart_configs ${where} ORDER BY created_at DESC LIMIT $${idx} OFFSET $${idx + 1}`,
      [...values, opts.limit, offset],
    );

    return { charts: rows.rows.map(toRecord), total };
  }

  async getById(id: string): Promise<ChartConfigRecord | null> {
    const result = await this.db.query<Record<string, unknown>>(
      `SELECT * FROM chart_configs WHERE id = $1`,
      [id],
    );
    return result.rows[0] ? toRecord(result.rows[0]) : null;
  }

  async create(input: CreateChartConfigInput): Promise<ChartConfigRecord> {
    const result = await this.db.query<Record<string, unknown>>(
      `INSERT INTO chart_configs (chart_id, title, category, access_tier, description, methodology, status, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        input.chartId,
        input.title,
        input.category,
        input.accessTier,
        input.description ?? null,
        input.methodology ?? null,
        input.status,
        input.createdBy ?? null,
      ],
    );
    return toRecord(result.rows[0]);
  }

  async update(id: string, input: UpdateChartConfigInput): Promise<ChartConfigRecord | null> {
    const sets: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    if (input.title !== undefined) { sets.push(`title = $${idx++}`); values.push(input.title); }
    if (input.category !== undefined) { sets.push(`category = $${idx++}`); values.push(input.category); }
    if (input.accessTier !== undefined) { sets.push(`access_tier = $${idx++}`); values.push(input.accessTier); }
    if (input.description !== undefined) { sets.push(`description = $${idx++}`); values.push(input.description); }
    if (input.methodology !== undefined) { sets.push(`methodology = $${idx++}`); values.push(input.methodology); }
    if (input.status !== undefined) { sets.push(`status = $${idx++}`); values.push(input.status); }

    if (sets.length === 0) return this.getById(id);

    const result = await this.db.query<Record<string, unknown>>(
      `UPDATE chart_configs SET ${sets.join(', ')} WHERE id = $${idx} RETURNING *`,
      [...values, id],
    );

    return result.rows[0] ? toRecord(result.rows[0]) : null;
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.db.query<{ id: string }>(
      `DELETE FROM chart_configs WHERE id = $1 RETURNING id`,
      [id],
    );
    return (result.rowCount ?? 0) > 0;
  }
}
