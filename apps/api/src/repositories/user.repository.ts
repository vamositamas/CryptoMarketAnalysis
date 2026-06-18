import { Pool } from 'pg';
import {
  type CreateUserInput,
  type LanguagePreference,
  type User,
  type UserRole,
} from '@crypto-market-analysis/shared/types';
import { getDatabasePool } from '../config/database.config';
import { BaseRepository } from './base.repository';

interface UserInsertRow {
  email: string;
  password_hash?: string;
  full_name?: string;
  language_preference: LanguagePreference;
  role: UserRole;
  email_verified: boolean;
  oauth_provider?: string;
  oauth_provider_id?: string;
  onboarding_completed: boolean;
}

export class UserRepository extends BaseRepository {
  constructor(private readonly pool: Pick<Pool, 'query'> | undefined = getDatabasePool()) {
    super();
  }

  async findByEmail(email: string): Promise<User | undefined> {
    const pool = this.requirePool();
    const result = await pool.query('SELECT * FROM users WHERE email = $1 LIMIT 1', [email]);

    return result.rows[0] ? this.toCamelCase<User>(result.rows[0]) : undefined;
  }

  async findById(userId: string): Promise<User | undefined> {
    const pool = this.requirePool();
    const result = await pool.query('SELECT * FROM users WHERE id = $1 LIMIT 1', [userId]);

    return result.rows[0] ? this.toCamelCase<User>(result.rows[0]) : undefined;
  }

  async create(input: CreateUserInput): Promise<User> {
    const pool = this.requirePool();
    const row = this.toSnakeCase<UserInsertRow>({
      email: input.email,
      passwordHash: input.passwordHash,
      fullName: input.fullName,
      languagePreference: input.languagePreference ?? 'en',
      role: input.role ?? 'free_user',
      emailVerified: input.emailVerified ?? false,
      oauthProvider: input.oauthProvider,
      oauthProviderId: input.oauthProviderId,
      onboardingCompleted: false,
    });
    const result = await pool.query(
      `INSERT INTO users (
        email,
        password_hash,
        full_name,
        language_preference,
        role,
        email_verified,
        oauth_provider,
        oauth_provider_id,
        onboarding_completed
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *`,
      [
        row.email,
        row.password_hash,
        row.full_name,
        row.language_preference,
        row.role,
        row.email_verified,
        row.oauth_provider,
        row.oauth_provider_id,
        row.onboarding_completed,
      ],
    );

    return this.toCamelCase<User>(result.rows[0]);
  }

  async markEmailVerified(userId: string): Promise<void> {
    const pool = this.requirePool();

    await pool.query(
      `UPDATE users
       SET email_verified = true
       WHERE id = $1`,
      [userId],
    );
  }

  async updatePasswordHash(userId: string, passwordHash: string): Promise<void> {
    const pool = this.requirePool();

    await pool.query(
      `UPDATE users
       SET password_hash = $2
       WHERE id = $1`,
      [userId, passwordHash],
    );
  }

  async updateDevelopmentAdminCredentials(
    email: string,
    input: {
      passwordHash: string;
      fullName?: string;
      languagePreference: LanguagePreference;
    },
  ): Promise<User | undefined> {
    const pool = this.requirePool();
    const result = await pool.query(
      `UPDATE users
       SET password_hash = $2,
           full_name = COALESCE($3, full_name, 'Admin User'),
           language_preference = $4,
           role = 'administrator',
           email_verified = true,
           oauth_provider = NULL,
           oauth_provider_id = NULL,
           updated_at = now()
       WHERE email = $1
       RETURNING *`,
      [email, input.passwordHash, input.fullName, input.languagePreference],
    );

    return result.rows[0] ? this.toCamelCase<User>(result.rows[0]) : undefined;
  }

  async updateProfile(
    userId: string,
    input: { fullName?: string; languagePreference: LanguagePreference },
  ): Promise<User | undefined> {
    const pool = this.requirePool();
    const result = await pool.query(
      `UPDATE users
       SET full_name = $2,
           language_preference = $3
       WHERE id = $1
       RETURNING *`,
      [userId, input.fullName, input.languagePreference],
    );

    return result.rows[0] ? this.toCamelCase<User>(result.rows[0]) : undefined;
  }

  async markOnboardingCompleted(userId: string): Promise<User | undefined> {
    const pool = this.requirePool();
    const result = await pool.query(
      `UPDATE users
       SET onboarding_completed = true
       WHERE id = $1
       RETURNING *`,
      [userId],
    );

    return result.rows[0] ? this.toCamelCase<User>(result.rows[0]) : undefined;
  }

  async recordLastLogin(userId: string): Promise<void> {
    const pool = this.requirePool();
    await pool.query(
      `UPDATE users SET last_login_at = NOW(), updated_at = NOW() WHERE id = $1`,
      [userId],
    );
  }

  private requirePool(): Pick<Pool, 'query'> {
    if (!this.pool) {
      throw new Error('Database is not configured');
    }

    return this.pool;
  }
}
