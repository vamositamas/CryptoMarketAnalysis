import type { Pool } from 'pg';

export interface AuditLogRecord {
  id: string;
  adminUserId: string;
  actionType: string;
  targetType: string;
  targetId: string | null;
  changes: Record<string, unknown> | null;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
}

export interface CreateAuditLogInput {
  adminUserId: string;
  actionType: string;
  targetType: string;
  targetId?: string | null;
  changes?: Record<string, unknown> | null;
  ipAddress?: string | null;
  userAgent?: string | null;
}

export interface ListAuditLogsParams {
  page: number;
  limit: number;
  actionType?: string;
  targetType?: string;
  adminUserId?: string;
}

function toRecord(row: Record<string, unknown>): AuditLogRecord {
  return {
    id: row['id'] as string,
    adminUserId: row['admin_user_id'] as string,
    actionType: row['action_type'] as string,
    targetType: row['target_type'] as string,
    targetId: (row['target_id'] as string | null) ?? null,
    changes: (row['changes'] as Record<string, unknown> | null) ?? null,
    ipAddress: (row['ip_address'] as string | null) ?? null,
    userAgent: (row['user_agent'] as string | null) ?? null,
    createdAt: (row['created_at'] as Date).toISOString(),
  };
}

export class AuditLogRepository {
  constructor(private readonly db: Pick<Pool, 'query'>) {}

  async create(input: CreateAuditLogInput): Promise<void> {
    await this.db.query(
      `INSERT INTO audit_logs (admin_user_id, action_type, target_type, target_id, changes, ip_address, user_agent)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        input.adminUserId,
        input.actionType,
        input.targetType,
        input.targetId ?? null,
        input.changes ? JSON.stringify(input.changes) : null,
        input.ipAddress ?? null,
        input.userAgent ?? null,
      ],
    );
  }

  async list(params: ListAuditLogsParams): Promise<{ logs: AuditLogRecord[]; total: number }> {
    const { page, limit, actionType, targetType, adminUserId } = params;
    const offset = (page - 1) * limit;
    const conditions: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    if (actionType) {
      conditions.push(`action_type = $${idx++}`);
      values.push(actionType);
    }
    if (targetType) {
      conditions.push(`target_type = $${idx++}`);
      values.push(targetType);
    }
    if (adminUserId) {
      conditions.push(`admin_user_id = $${idx++}`);
      values.push(adminUserId);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const countResult = await this.db.query<{ count: string }>(
      `SELECT COUNT(*) as count FROM audit_logs ${where}`,
      values,
    );

    const total = parseInt(countResult.rows[0]?.count ?? '0', 10);

    const rows = await this.db.query<Record<string, unknown>>(
      `SELECT al.id, al.admin_user_id, al.action_type, al.target_type, al.target_id,
              al.changes, al.ip_address, al.user_agent, al.created_at
       FROM audit_logs al
       ${where}
       ORDER BY al.created_at DESC
       LIMIT $${idx} OFFSET $${idx + 1}`,
      [...values, limit, offset],
    );

    return { logs: rows.rows.map(toRecord), total };
  }
}
