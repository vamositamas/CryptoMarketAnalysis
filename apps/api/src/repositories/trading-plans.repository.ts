interface Queryable {
  query<Row = unknown>(sql: string, values?: unknown[]): Promise<{ rows: Row[] }>;
}

export type PlanDirection = 'long' | 'short' | 'neutral';
export type PlanStatus = 'active' | 'closed' | 'cancelled';

export interface TradingPlanRecord {
  id: string;
  userId: string;
  title: string;
  direction: PlanDirection;
  entryPrice: number;
  targetPrice: number | null;
  stopLoss: number | null;
  positionSizeUsd: number | null;
  riskPercent: number | null;
  expiryDate: string | null;
  notes: string | null;
  status: PlanStatus;
  closePrice: number | null;
  closedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTradingPlanInput {
  title: string;
  direction: PlanDirection;
  entryPrice: number;
  targetPrice?: number | null;
  stopLoss?: number | null;
  positionSizeUsd?: number | null;
  riskPercent?: number | null;
  expiryDate?: string | null;
  notes?: string | null;
}

export interface CloseTradingPlanInput {
  closePrice: number;
}

interface TradingPlanRow {
  id: string;
  user_id: string;
  title: string;
  direction: string;
  entry_price: string;
  target_price: string | null;
  stop_loss: string | null;
  position_size_usd: string | null;
  risk_percent: string | null;
  expiry_date: string | null;
  notes: string | null;
  status: string;
  close_price: string | null;
  closed_at: string | Date | null;
  created_at: string | Date;
  updated_at: string | Date;
}

export class TradingPlansRepository {
  constructor(private readonly database: Queryable | undefined) {}

  async create(userId: string, input: CreateTradingPlanInput): Promise<TradingPlanRecord> {
    const result = await this.requireDatabase().query<TradingPlanRow>(
      `INSERT INTO trading_plans
         (user_id, title, direction, entry_price, target_price, stop_loss,
          position_size_usd, risk_percent, expiry_date, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [
        userId,
        input.title,
        input.direction,
        input.entryPrice,
        input.targetPrice ?? null,
        input.stopLoss ?? null,
        input.positionSizeUsd ?? null,
        input.riskPercent ?? null,
        input.expiryDate ?? null,
        input.notes ?? null,
      ],
    );
    return toPlanRecord(result.rows[0]);
  }

  async listForUser(userId: string): Promise<TradingPlanRecord[]> {
    const result = await this.requireDatabase().query<TradingPlanRow>(
      `SELECT * FROM trading_plans WHERE user_id = $1 ORDER BY created_at DESC`,
      [userId],
    );
    return result.rows.map(toPlanRecord);
  }

  async findById(userId: string, planId: string): Promise<TradingPlanRecord | null> {
    const result = await this.requireDatabase().query<TradingPlanRow>(
      `SELECT * FROM trading_plans WHERE id = $1::uuid AND user_id = $2`,
      [planId, userId],
    );
    return result.rows.length > 0 ? toPlanRecord(result.rows[0]) : null;
  }

  async close(userId: string, planId: string, closePrice: number): Promise<TradingPlanRecord | null> {
    const result = await this.requireDatabase().query<TradingPlanRow>(
      `UPDATE trading_plans
       SET status = 'closed', close_price = $3, closed_at = now(), updated_at = now()
       WHERE id = $1::uuid AND user_id = $2 AND status = 'active'
       RETURNING *`,
      [planId, userId, closePrice],
    );
    return result.rows.length > 0 ? toPlanRecord(result.rows[0]) : null;
  }

  async cancel(userId: string, planId: string): Promise<TradingPlanRecord | null> {
    const result = await this.requireDatabase().query<TradingPlanRow>(
      `UPDATE trading_plans
       SET status = 'cancelled', updated_at = now()
       WHERE id = $1::uuid AND user_id = $2 AND status = 'active'
       RETURNING *`,
      [planId, userId],
    );
    return result.rows.length > 0 ? toPlanRecord(result.rows[0]) : null;
  }

  async delete(userId: string, planId: string): Promise<boolean> {
    const result = await this.requireDatabase().query<{ id: string }>(
      `DELETE FROM trading_plans WHERE id = $1::uuid AND user_id = $2 RETURNING id`,
      [planId, userId],
    );
    return result.rows.length > 0;
  }

  private requireDatabase(): Queryable {
    if (!this.database) {
      throw new Error('Database is not configured');
    }
    return this.database;
  }
}

function toIso(v: string | Date | null): string | null {
  if (v === null || v === undefined) return null;
  return v instanceof Date ? v.toISOString() : new Date(v).toISOString();
}

function toPlanRecord(row: TradingPlanRow): TradingPlanRecord {
  return {
    id: row.id,
    userId: row.user_id,
    title: row.title,
    direction: row.direction as PlanDirection,
    entryPrice: parseFloat(row.entry_price),
    targetPrice: row.target_price !== null ? parseFloat(row.target_price) : null,
    stopLoss: row.stop_loss !== null ? parseFloat(row.stop_loss) : null,
    positionSizeUsd: row.position_size_usd !== null ? parseFloat(row.position_size_usd) : null,
    riskPercent: row.risk_percent !== null ? parseFloat(row.risk_percent) : null,
    expiryDate: row.expiry_date ?? null,
    notes: row.notes ?? null,
    status: row.status as PlanStatus,
    closePrice: row.close_price !== null ? parseFloat(row.close_price) : null,
    closedAt: toIso(row.closed_at),
    createdAt: toIso(row.created_at) ?? new Date().toISOString(),
    updatedAt: toIso(row.updated_at) ?? new Date().toISOString(),
  };
}
