import { Pool } from 'pg';
import { getDatabasePool } from '../config/database.config';
import { BaseRepository } from './base.repository';

export class TokenBlacklistRepository extends BaseRepository {
  constructor(private readonly pool: Pick<Pool, 'query'> | undefined = getDatabasePool()) {
    super();
  }

  async invalidateUserTokens(userId: string, invalidatedAt = new Date()): Promise<void> {
    const pool = this.requirePool();

    await pool.query(
      `INSERT INTO token_blacklist (user_id, invalidated_at)
       VALUES ($1, $2)`,
      [userId, invalidatedAt],
    );
  }

  async findLatestInvalidationForUser(userId: string): Promise<Date | undefined> {
    const pool = this.requirePool();
    const result = await pool.query(
      `SELECT invalidated_at
       FROM token_blacklist
       WHERE user_id = $1
       ORDER BY invalidated_at DESC
       LIMIT 1`,
      [userId],
    );

    return result.rows[0]?.invalidated_at
      ? new Date(result.rows[0].invalidated_at)
      : undefined;
  }

  private requirePool(): Pick<Pool, 'query'> {
    if (!this.pool) {
      throw new Error('Database is not configured');
    }

    return this.pool;
  }
}
