import type { Pool } from 'pg';

export type DonationStatus = 'pending' | 'completed' | 'cancelled' | 'refunded';

export interface DonationRecord {
  id: string;
  userId: string | null;
  amount: number;
  currency: string;
  paypalOrderId: string | null;
  paypalTransactionId: string | null;
  status: DonationStatus;
  userUpgraded: boolean;
  createdAt: string;
  completedAt: string | null;
}

interface DonationRow {
  id: string;
  user_id: string | null;
  amount: string;
  currency: string;
  paypal_order_id: string | null;
  paypal_transaction_id: string | null;
  status: DonationStatus;
  user_upgraded: boolean;
  created_at: string;
  completed_at: string | null;
}

function toRecord(row: DonationRow): DonationRecord {
  return {
    id: row.id,
    userId: row.user_id,
    amount: parseFloat(row.amount),
    currency: row.currency,
    paypalOrderId: row.paypal_order_id,
    paypalTransactionId: row.paypal_transaction_id,
    status: row.status,
    userUpgraded: row.user_upgraded,
    createdAt: row.created_at,
    completedAt: row.completed_at,
  };
}

export class DonationsRepository {
  constructor(private readonly db: Pick<Pool, 'query'>) {}

  async create(data: {
    userId: string;
    amount: number;
    currency: string;
    paypalOrderId: string;
  }): Promise<DonationRecord> {
    const result = await this.db.query<DonationRow>(
      `INSERT INTO donations (user_id, amount, currency, paypal_order_id)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [data.userId, data.amount, data.currency, data.paypalOrderId],
    );
    return toRecord(result.rows[0]);
  }

  async findById(id: string): Promise<DonationRecord | null> {
    const result = await this.db.query<DonationRow>(
      `SELECT * FROM donations WHERE id = $1`,
      [id],
    );
    return result.rows[0] ? toRecord(result.rows[0]) : null;
  }

  async findByPaypalOrderId(paypalOrderId: string): Promise<DonationRecord | null> {
    const result = await this.db.query<DonationRow>(
      `SELECT * FROM donations WHERE paypal_order_id = $1`,
      [paypalOrderId],
    );
    return result.rows[0] ? toRecord(result.rows[0]) : null;
  }

  async updateStatus(
    id: string,
    status: DonationStatus,
    extra: {
      paypalTransactionId?: string;
      userUpgraded?: boolean;
      completedAt?: string;
    } = {},
  ): Promise<DonationRecord> {
    const result = await this.db.query<DonationRow>(
      `UPDATE donations
       SET status = $2,
           paypal_transaction_id = COALESCE($3, paypal_transaction_id),
           user_upgraded = COALESCE($4, user_upgraded),
           completed_at = COALESCE($5, completed_at)
       WHERE id = $1
       RETURNING *`,
      [
        id,
        status,
        extra.paypalTransactionId ?? null,
        extra.userUpgraded ?? null,
        extra.completedAt ?? null,
      ],
    );
    return toRecord(result.rows[0]);
  }

  async listAll(opts: {
    page: number;
    limit: number;
    status?: string;
  }): Promise<{ donations: DonationRecord[]; total: number }> {
    const offset = (opts.page - 1) * opts.limit;
    const where = opts.status ? `WHERE d.status = $3` : '';
    const params: unknown[] = opts.status
      ? [opts.limit, offset, opts.status]
      : [opts.limit, offset];

    const [dataResult, countResult] = await Promise.all([
      this.db.query<DonationRow & { user_email: string | null }>(
        `SELECT d.*, u.email AS user_email
         FROM donations d
         LEFT JOIN users u ON d.user_id = u.id
         ${where}
         ORDER BY d.created_at DESC
         LIMIT $1 OFFSET $2`,
        params,
      ),
      this.db.query<{ count: string }>(
        `SELECT COUNT(*) FROM donations d ${where}`,
        opts.status ? [opts.status] : [],
      ),
    ]);

    return {
      donations: dataResult.rows.map(toRecord),
      total: parseInt(countResult.rows[0].count, 10),
    };
  }

  async listAllForExport(): Promise<Array<DonationRecord & { userEmail: string | null }>> {
    const result = await this.db.query<DonationRow & { user_email: string | null }>(
      `SELECT d.*, u.email AS user_email
       FROM donations d
       LEFT JOIN users u ON d.user_id = u.id
       ORDER BY d.created_at DESC`,
    );
    return result.rows.map((row) => ({
      ...toRecord(row),
      userEmail: row.user_email,
    }));
  }
}
