import type { Pool } from 'pg';

export interface AdminUserRecord {
  id: string;
  fullName: string | null;
  email: string;
  role: 'administrator' | 'premium_user' | 'free_user';
  emailVerified: boolean;
  onboardingCompleted: boolean;
  languagePreference: 'en' | 'hu';
  createdAt: string;
  lastLoginAt: string | null;
  deletedAt: string | null;
}

export interface UpdateUserParams {
  fullName?: string | null;
  role?: 'administrator' | 'premium_user' | 'free_user';
  emailVerified?: boolean;
  onboardingCompleted?: boolean;
  languagePreference?: 'en' | 'hu';
}

export interface ListUsersParams {
  page: number;
  limit: number;
  search?: string;
  role?: string;
  showDeleted?: boolean;
}

function toRecord(row: Record<string, unknown>): AdminUserRecord {
  return {
    id: row['id'] as string,
    fullName: (row['full_name'] as string | null) ?? null,
    email: row['email'] as string,
    role: row['role'] as AdminUserRecord['role'],
    emailVerified: row['email_verified'] as boolean,
    onboardingCompleted: row['onboarding_completed'] as boolean,
    languagePreference: (row['language_preference'] as 'en' | 'hu') ?? 'en',
    createdAt: (row['created_at'] as Date).toISOString(),
    lastLoginAt: row['last_login_at'] ? (row['last_login_at'] as Date).toISOString() : null,
    deletedAt: row['deleted_at'] ? (row['deleted_at'] as Date).toISOString() : null,
  };
}

export class UserManagementRepository {
  constructor(private readonly db: Pick<Pool, 'query'>) {}

  async listUsers(params: ListUsersParams): Promise<{ users: AdminUserRecord[]; total: number }> {
    const { page, limit, search, role, showDeleted } = params;
    const offset = (page - 1) * limit;
    const conditions: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    if (!showDeleted) {
      conditions.push(`deleted_at IS NULL`);
    }

    if (search) {
      conditions.push(`(full_name ILIKE $${idx} OR email ILIKE $${idx})`);
      values.push(`%${search}%`);
      idx++;
    }

    if (role) {
      conditions.push(`role = $${idx}`);
      values.push(role);
      idx++;
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const countResult = await this.db.query<{ count: string }>(
      `SELECT COUNT(*) as count FROM users ${where}`,
      values,
    );

    const total = parseInt(countResult.rows[0]?.count ?? '0', 10);

    const rows = await this.db.query<Record<string, unknown>>(
      `SELECT id, full_name, email, role, email_verified, onboarding_completed, language_preference,
              created_at, last_login_at, deleted_at
       FROM users ${where}
       ORDER BY created_at DESC
       LIMIT $${idx} OFFSET $${idx + 1}`,
      [...values, limit, offset],
    );

    return { users: rows.rows.map(toRecord), total };
  }

  async getUserById(id: string): Promise<AdminUserRecord | null> {
    const result = await this.db.query<Record<string, unknown>>(
      `SELECT id, full_name, email, role, email_verified, onboarding_completed, language_preference,
              created_at, last_login_at, deleted_at
       FROM users WHERE id = $1`,
      [id],
    );
    return result.rows[0] ? toRecord(result.rows[0]) : null;
  }

  async updateUser(id: string, params: UpdateUserParams): Promise<AdminUserRecord | null> {
    const sets: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    if (params.fullName !== undefined) {
      sets.push(`full_name = $${idx++}`);
      values.push(params.fullName);
    }
    if (params.role !== undefined) {
      sets.push(`role = $${idx++}`);
      values.push(params.role);
    }
    if (params.emailVerified !== undefined) {
      sets.push(`email_verified = $${idx++}`);
      values.push(params.emailVerified);
    }
    if (params.onboardingCompleted !== undefined) {
      sets.push(`onboarding_completed = $${idx++}`);
      values.push(params.onboardingCompleted);
    }
    if (params.languagePreference !== undefined) {
      sets.push(`language_preference = $${idx++}`);
      values.push(params.languagePreference);
    }

    if (sets.length === 0) return this.getUserById(id);

    const result = await this.db.query<Record<string, unknown>>(
      `UPDATE users SET ${sets.join(', ')}, updated_at = NOW()
       WHERE id = $${idx} AND deleted_at IS NULL
       RETURNING id, full_name, email, role, email_verified, onboarding_completed, language_preference,
                 created_at, last_login_at, deleted_at`,
      [...values, id],
    );

    return result.rows[0] ? toRecord(result.rows[0]) : null;
  }

  async softDeleteUser(id: string): Promise<boolean> {
    const result = await this.db.query<{ id: string }>(
      `UPDATE users SET deleted_at = NOW(), updated_at = NOW() WHERE id = $1 AND deleted_at IS NULL RETURNING id`,
      [id],
    );
    return (result.rowCount ?? 0) > 0;
  }

  async restoreUser(id: string): Promise<AdminUserRecord | null> {
    const result = await this.db.query<Record<string, unknown>>(
      `UPDATE users SET deleted_at = NULL, updated_at = NOW()
       WHERE id = $1 AND deleted_at IS NOT NULL
       RETURNING id, full_name, email, role, email_verified, onboarding_completed, language_preference,
                 created_at, last_login_at, deleted_at`,
      [id],
    );
    return result.rows[0] ? toRecord(result.rows[0]) : null;
  }

  async hardDeleteUser(id: string): Promise<boolean> {
    await this.db.query(
      `UPDATE audit_logs SET target_id = NULL WHERE target_type = 'user' AND target_id = $1`,
      [id],
    );

    const result = await this.db.query<{ id: string }>(
      `DELETE FROM users WHERE id = $1 AND deleted_at IS NOT NULL RETURNING id`,
      [id],
    );
    return (result.rowCount ?? 0) > 0;
  }

  async getUserByEmail(email: string): Promise<{ id: string; email: string } | null> {
    const result = await this.db.query<{ id: string; email: string }>(
      `SELECT id, email FROM users WHERE email = $1 AND deleted_at IS NULL`,
      [email],
    );
    return result.rows[0] ?? null;
  }

  async countActiveAlertsForUser(userId: string): Promise<number> {
    const result = await this.db.query<{ count: string }>(
      `SELECT COUNT(*) as count FROM user_alerts WHERE user_id = $1 AND status = 'active'`,
      [userId],
    );
    return parseInt(result.rows[0]?.count ?? '0', 10);
  }

  async pauseExcessAlertsForUser(userId: string, keepActive: number): Promise<void> {
    await this.db.query(
      `UPDATE user_alerts SET status = 'paused', updated_at = NOW()
       WHERE user_id = $1 AND status = 'active'
         AND id NOT IN (
           SELECT id FROM user_alerts
           WHERE user_id = $1 AND status = 'active'
           ORDER BY created_at ASC
           LIMIT $2
         )`,
      [userId, keepActive],
    );
  }

  async recordLastLogin(userId: string): Promise<void> {
    await this.db.query(
      `UPDATE users SET last_login_at = NOW(), updated_at = NOW() WHERE id = $1`,
      [userId],
    );
  }
}
