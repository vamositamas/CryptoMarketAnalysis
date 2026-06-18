import type { Pool } from 'pg';
import type { Request } from 'express';
import { getDatabasePool } from '../config/database.config';
import { DonationsRepository, type DonationRecord } from '../repositories/donations.repository';
import { TokenBlacklistRepository } from '../repositories/token-blacklist.repository';
import { PayPalClient } from './paypal.client';
import { encrypt, decrypt } from '../utils/crypto.utils';
import type { DonationThankYouEmailSender } from './email.service';

export const MIN_DONATION_AMOUNT = 1;
export const MAX_DONATION_AMOUNT = 9999;

export class DonationError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number = 400,
  ) {
    super(message);
  }
}

interface DonationsServiceOptions {
  donationsRepository?: DonationsRepository;
  paypalClient?: PayPalClient;
  tokenBlacklist?: { invalidateUserTokens(userId: string): Promise<void> };
  emailService?: DonationThankYouEmailSender;
  logger?: { warn(msg: string, ctx?: unknown): void };
}

function getEncryptionKey(): string | null {
  return process.env['ENCRYPTION_KEY'] ?? null;
}

function getAppUrl(): string {
  return process.env['APP_URL'] ?? '';
}

function buildApiBaseUrl(req: Request): string {
  const proto = (req.headers['x-forwarded-proto'] as string | undefined) ?? req.protocol;
  const host = (req.headers['x-forwarded-host'] as string | undefined) ?? (req.get('host') ?? 'localhost');
  return `${proto}://${host}`;
}

export class DonationsService {
  private readonly donations: DonationsRepository;
  private readonly paypal: PayPalClient;
  private readonly tokenBlacklist: { invalidateUserTokens(userId: string): Promise<void> };
  private readonly emailService?: DonationThankYouEmailSender;
  private readonly logger: { warn(msg: string, ctx?: unknown): void };

  constructor(
    private readonly db: Pick<Pool, 'query'> | undefined = getDatabasePool(),
    options: DonationsServiceOptions = {},
  ) {
    this.donations = options.donationsRepository ?? new DonationsRepository(db!);
    this.paypal = options.paypalClient ?? new PayPalClient();
    this.tokenBlacklist = options.tokenBlacklist ?? new TokenBlacklistRepository(db);
    this.emailService = options.emailService;
    this.logger = options.logger ?? console;
  }

  async initiate(params: {
    userId: string;
    amount: number;
    currency: string;
    req: Request;
  }): Promise<{ donationId: string; approvalUrl: string }> {
    if (!this.db) throw new DonationError('Database is not configured', 500);

    const { userId, amount, currency, req } = params;

    if (!Number.isFinite(amount) || amount < MIN_DONATION_AMOUNT || amount > MAX_DONATION_AMOUNT) {
      throw new DonationError(`Donation amount must be between $${MIN_DONATION_AMOUNT} and $${MAX_DONATION_AMOUNT}`);
    }

    const apiBaseUrl = buildApiBaseUrl(req);
    const returnUrl = `${apiBaseUrl}/api/donations/paypal/success`;
    const cancelUrl = `${apiBaseUrl}/api/donations/paypal/cancel`;

    const order = await this.paypal.createOrder({ amount, currency, returnUrl, cancelUrl });
    const donation = await this.donations.create({
      userId,
      amount,
      currency,
      paypalOrderId: order.id,
    });

    return { donationId: donation.id, approvalUrl: order.approvalUrl };
  }

  async handleSuccess(paypalOrderId: string, userContext?: {
    email: string;
    fullName?: string;
  }): Promise<{ donationId: string }> {
    if (!this.db) throw new DonationError('Database is not configured', 500);

    const donation = await this.donations.findByPaypalOrderId(paypalOrderId);

    if (!donation) {
      throw new DonationError('Donation not found', 404);
    }

    if (donation.status === 'completed') {
      return { donationId: donation.id };
    }

    const { transactionId } = await this.paypal.captureOrder(paypalOrderId);

    const encryptionKey = getEncryptionKey();
    const storedTransactionId = encryptionKey
      ? encrypt(transactionId, encryptionKey)
      : transactionId;

    const completedAt = new Date().toISOString();
    let userUpgraded = false;

    if (donation.userId) {
      userUpgraded = await this.upgradeUserRole(donation.userId);
    }

    await this.donations.updateStatus(donation.id, 'completed', {
      paypalTransactionId: storedTransactionId,
      userUpgraded,
      completedAt,
    });

    if (this.emailService && donation.userId && userContext) {
      try {
        const appUrl = getAppUrl();
        await this.emailService.sendDonationThankYouEmail({
          userEmail: userContext.email,
          userName: userContext.fullName ?? '',
          donationAmount: donation.amount,
          currency: donation.currency,
          transactionId,
          donationDate: completedAt,
          donationId: donation.id,
          appUrl,
        });
      } catch (error) {
        this.logger.warn('Failed to send donation thank-you email', {
          donationId: donation.id,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return { donationId: donation.id };
  }

  async handleCancel(paypalOrderId: string): Promise<void> {
    if (!this.db) throw new DonationError('Database is not configured', 500);

    const donation = await this.donations.findByPaypalOrderId(paypalOrderId);

    if (!donation || donation.status !== 'pending') {
      return;
    }

    await this.donations.updateStatus(donation.id, 'cancelled');
  }

  async getDonation(id: string): Promise<DonationRecord | null> {
    if (!this.db) throw new DonationError('Database is not configured', 500);

    const donation = await this.donations.findById(id);
    if (!donation) return null;

    const encryptionKey = getEncryptionKey();
    if (donation.paypalTransactionId && encryptionKey) {
      const decrypted = decrypt(donation.paypalTransactionId, encryptionKey);
      return { ...donation, paypalTransactionId: decrypted };
    }

    return donation;
  }

  async listDonations(opts: { page: number; limit: number; status?: string }) {
    if (!this.db) throw new DonationError('Database is not configured', 500);
    return this.donations.listAll(opts);
  }

  async exportDonations() {
    if (!this.db) throw new DonationError('Database is not configured', 500);
    const rows = await this.donations.listAllForExport();
    const encryptionKey = getEncryptionKey();

    return rows.map((row) => ({
      ...row,
      paypalTransactionId:
        row.paypalTransactionId && encryptionKey
          ? (decrypt(row.paypalTransactionId, encryptionKey) ?? '[encrypted]')
          : (row.paypalTransactionId ?? ''),
    }));
  }

  private async upgradeUserRole(userId: string): Promise<boolean> {
    const result = await (this.db as Pool).query<{ role: string }>(
      `SELECT role FROM users WHERE id = $1`,
      [userId],
    );

    const currentRole = result.rows[0]?.role;

    if (currentRole !== 'free_user') {
      return false;
    }

    await (this.db as Pool).query(
      `UPDATE users SET role = 'premium_user' WHERE id = $1`,
      [userId],
    );

    await this.tokenBlacklist.invalidateUserTokens(userId);

    console.info(
      JSON.stringify({
        event: 'donations.user_upgraded',
        userId,
        from: 'free_user',
        to: 'premium_user',
        timestamp: new Date().toISOString(),
      }),
    );

    return true;
  }
}
