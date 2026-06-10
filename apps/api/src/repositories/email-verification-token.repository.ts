import { Pool } from 'pg';
import { getDatabasePool } from '../config/database.config';
import { BaseRepository } from './base.repository';

export interface CreateEmailVerificationTokenInput {
  userId: string;
  token: string;
  expiresAt: Date;
}

export interface EmailVerificationToken {
  id: string;
  userId: string;
  token: string;
  expiresAt: Date;
  createdAt: Date;
}

export class EmailVerificationTokenRepository extends BaseRepository {
  constructor(private readonly pool: Pick<Pool, 'query'> | undefined = getDatabasePool()) {
    super();
  }

  async create(input: CreateEmailVerificationTokenInput): Promise<void> {
    const pool = this.requirePool();

    await pool.query(
      `INSERT INTO email_verification_tokens (user_id, token, expires_at)
       VALUES ($1, $2, $3)`,
      [input.userId, input.token, input.expiresAt],
    );
  }

  async findByToken(token: string): Promise<EmailVerificationToken | undefined> {
    const pool = this.requirePool();
    const result = await pool.query(
      'SELECT * FROM email_verification_tokens WHERE token = $1 LIMIT 1',
      [token],
    );

    return result.rows[0]
      ? this.toCamelCase<EmailVerificationToken>(result.rows[0])
      : undefined;
  }

  async deleteByToken(token: string): Promise<void> {
    const pool = this.requirePool();

    await pool.query('DELETE FROM email_verification_tokens WHERE token = $1', [token]);
  }

  private requirePool(): Pick<Pool, 'query'> {
    if (!this.pool) {
      throw new Error('Database is not configured');
    }

    return this.pool;
  }
}
