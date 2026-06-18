import { Router } from 'express';
import { getDatabasePool } from '../config/database.config';
import { requireAuth, type AuthenticatedRequest, type TokenInvalidationReader } from '../middleware/rbac.middleware';
import { DonationsService, DonationError } from '../services/donations.service';
import { ResendEmailService } from '../services/email.service';

function getAppUrl(): string {
  return process.env['APP_URL'] ?? '';
}

function createDefaultDonationsService(): DonationsService {
  const db = getDatabasePool();
  return new DonationsService(db, {
    emailService: new ResendEmailService(),
  });
}

export function createDonationsRouter(
  donationsService: DonationsService = createDefaultDonationsService(),
  tokenInvalidations?: TokenInvalidationReader,
): Router {
  const router = Router();
  const auth = requireAuth(tokenInvalidations);

  router.post('/initiate', auth, async (req: AuthenticatedRequest, res) => {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { amount, currency = 'USD' } = req.body as { amount?: unknown; currency?: unknown };

    if (amount === undefined || amount === null) {
      res.status(400).json({ error: 'amount is required' });
      return;
    }

    const numericAmount = typeof amount === 'string' ? parseFloat(amount) : Number(amount);

    try {
      const result = await donationsService.initiate({
        userId: req.user.userId,
        amount: numericAmount,
        currency: typeof currency === 'string' ? currency : 'USD',
        req,
      });
      res.status(201).json(result);
    } catch (error) {
      if (error instanceof DonationError) {
        res.status(error.statusCode).json({ error: error.message });
        return;
      }
      res.status(500).json({ error: 'Failed to initiate donation' });
    }
  });

  router.get('/paypal/success', async (req, res) => {
    const orderId = req.query['token'] as string | undefined;

    if (!orderId) {
      res.redirect(`${getAppUrl()}/dashboard?message=donation_error`);
      return;
    }

    try {
      const { donationId } = await donationsService.handleSuccess(orderId);
      res.redirect(`${getAppUrl()}/donate/thank-you?donation_id=${donationId}`);
    } catch (error) {
      console.error('PayPal success handler error:', error);
      res.redirect(`${getAppUrl()}/dashboard?message=donation_error`);
    }
  });

  router.get('/paypal/cancel', async (req, res) => {
    const orderId = req.query['token'] as string | undefined;

    if (orderId) {
      try {
        await donationsService.handleCancel(orderId);
      } catch {
        // Best effort — don't block the redirect
      }
    }

    res.redirect(`${getAppUrl()}/dashboard?message=donation_cancelled`);
  });

  router.get('/:donationId', auth, async (req: AuthenticatedRequest, res) => {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { donationId } = req.params;

    try {
      const donation = await donationsService.getDonation(donationId);

      if (!donation || donation.userId !== req.user.userId) {
        res.status(404).json({ error: 'Donation not found' });
        return;
      }

      res.json({
        id: donation.id,
        amount: donation.amount,
        currency: donation.currency,
        status: donation.status,
        userUpgraded: donation.userUpgraded,
        transactionId: donation.paypalTransactionId,
        completedAt: donation.completedAt,
        createdAt: donation.createdAt,
      });
    } catch (error) {
      if (error instanceof DonationError) {
        res.status(error.statusCode).json({ error: error.message });
        return;
      }
      res.status(500).json({ error: 'Failed to fetch donation' });
    }
  });

  return router;
}
