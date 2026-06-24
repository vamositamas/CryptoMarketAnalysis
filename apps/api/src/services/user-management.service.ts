import { randomBytes } from 'crypto';
import type { Pool } from 'pg';
import { getDatabasePool } from '../config/database.config';
import {
  UserManagementRepository,
  type AdminUserRecord,
  type UpdateUserParams,
} from '../repositories/user-management.repository';
import { PasswordResetTokenRepository } from '../repositories/password-reset-token.repository';
import { TokenBlacklistRepository } from '../repositories/token-blacklist.repository';
import type { PasswordResetEmailSender } from './email.service';
import { ResendEmailService } from './email.service';

export class UserManagementError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number = 400,
  ) {
    super(message);
  }
}

const FREE_USER_ALERT_LIMIT = 5;

function getFrontendUrl(): string {
  return process.env['FRONTEND_URL'] ?? 'http://localhost:4200';
}

interface UserManagementServiceOptions {
  userRepo?: UserManagementRepository;
  passwordResetTokens?: { create(input: { userId: string; token: string; expiresAt: Date }): Promise<void> };
  passwordResetEmails?: PasswordResetEmailSender;
  tokenBlacklist?: { invalidateUserTokens(userId: string): Promise<void> };
}

export class UserManagementService {
  private readonly users: UserManagementRepository;
  private readonly passwordResetTokens: { create(input: { userId: string; token: string; expiresAt: Date }): Promise<void> };
  private readonly passwordResetEmails: PasswordResetEmailSender;
  private readonly tokenBlacklist: { invalidateUserTokens(userId: string): Promise<void> };

  constructor(
    private readonly db: Pick<Pool, 'query'> | undefined = getDatabasePool(),
    options: UserManagementServiceOptions = {},
  ) {
    this.users = options.userRepo ?? new UserManagementRepository(db!);
    this.passwordResetTokens = options.passwordResetTokens ?? new PasswordResetTokenRepository(db);
    this.passwordResetEmails = options.passwordResetEmails ?? new ResendEmailService();
    this.tokenBlacklist = options.tokenBlacklist ?? new TokenBlacklistRepository(db);
  }

  async listUsers(params: {
    page: number;
    limit: number;
    search?: string;
    role?: string;
    showDeleted?: boolean;
  }): Promise<{ users: AdminUserRecord[]; total: number; page: number; limit: number }> {
    if (!this.db) throw new UserManagementError('Database is not configured', 500);
    const { users, total } = await this.users.listUsers(params);
    return { users, total, page: params.page, limit: params.limit };
  }

  async getUser(userId: string): Promise<AdminUserRecord> {
    if (!this.db) throw new UserManagementError('Database is not configured', 500);
    const user = await this.users.getUserById(userId);
    if (!user) throw new UserManagementError('User not found', 404);
    return user;
  }

  async updateUser(
    userId: string,
    params: UpdateUserParams,
    adminUserId: string,
  ): Promise<AdminUserRecord> {
    if (!this.db) throw new UserManagementError('Database is not configured', 500);

    const existing = await this.users.getUserById(userId);
    if (!existing) throw new UserManagementError('User not found', 404);

    if (params.role && params.role !== existing.role) {
      if (params.role === 'free_user' && existing.role === 'premium_user') {
        const activeAlerts = await this.users.countActiveAlertsForUser(userId);
        if (activeAlerts > FREE_USER_ALERT_LIMIT) {
          await this.users.pauseExcessAlertsForUser(userId, FREE_USER_ALERT_LIMIT);
        }
      }

      if (adminUserId !== userId) {
        await this.tokenBlacklist.invalidateUserTokens(userId);
      }
    }

    const updated = await this.users.updateUser(userId, params);
    if (!updated) throw new UserManagementError('User not found', 404);
    return updated;
  }

  async deleteUser(userId: string, adminUserId: string): Promise<void> {
    if (!this.db) throw new UserManagementError('Database is not configured', 500);
    if (userId === adminUserId) {
      throw new UserManagementError('Administrators cannot delete their own account', 400);
    }

    const deleted = await this.users.softDeleteUser(userId);
    if (!deleted) throw new UserManagementError('User not found', 404);

    await this.tokenBlacklist.invalidateUserTokens(userId);
  }

  async restoreUser(userId: string): Promise<AdminUserRecord> {
    if (!this.db) throw new UserManagementError('Database is not configured', 500);
    const user = await this.users.restoreUser(userId);
    if (!user) throw new UserManagementError('User not found or not deleted', 404);
    return user;
  }

  async forcePasswordReset(userId: string): Promise<{ email: string }> {
    if (!this.db) throw new UserManagementError('Database is not configured', 500);

    const user = await this.users.getUserById(userId);
    if (!user) throw new UserManagementError('User not found', 404);

    const token = randomBytes(32).toString('base64url');
    await this.passwordResetTokens.create({
      userId,
      token,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    });

    await this.passwordResetEmails.sendPasswordResetEmail({
      email: user.email,
      resetUrl: `${getFrontendUrl()}/reset-password?token=${token}`,
      languagePreference: user.languagePreference,
    });

    await this.tokenBlacklist.invalidateUserTokens(userId);

    return { email: user.email };
  }
}
