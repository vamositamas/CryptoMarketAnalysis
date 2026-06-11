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

  private requirePool(): Pick<Pool, 'query'> {
    if (!this.pool) {
      throw new Error('Database is not configured');
    }

    return this.pool;
  }
}

