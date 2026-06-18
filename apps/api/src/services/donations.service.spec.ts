import type { Request } from 'express';
import { DonationsService, DonationError } from './donations.service';
import type { DonationsRepository } from '../repositories/donations.repository';
import type { PayPalClient } from './paypal.client';

function makeDonation(overrides: Partial<{
  id: string; userId: string; amount: number; currency: string;
  paypalOrderId: string | null; paypalTransactionId: string | null;
  status: 'pending' | 'completed' | 'cancelled'; userUpgraded: boolean;
  createdAt: string; completedAt: string | null;
}> = {}) {
  return {
    id: 'donation-uuid',
    userId: 'user-uuid',
    amount: 10,
    currency: 'USD',
    paypalOrderId: 'ORDER-123',
    paypalTransactionId: null,
    status: 'pending' as const,
    userUpgraded: false,
    createdAt: '2026-06-18T08:00:00.000Z',
    completedAt: null,
    ...overrides,
  };
}

function makeFakeReq(): Request {
  return {
    protocol: 'https',
    get: (header: string) => (header === 'host' ? 'cryptomarketanalysis.com' : undefined),
    headers: {},
  } as unknown as Request;
}

describe('DonationsService', () => {
  it('throws when database is not configured', async () => {
    const paypal = { createOrder: jest.fn(), captureOrder: jest.fn() } as unknown as PayPalClient;
    const donationsRepo = {
      create: jest.fn(), findById: jest.fn(), findByPaypalOrderId: jest.fn(),
      updateStatus: jest.fn(), listAll: jest.fn(), listAllForExport: jest.fn(),
    } as unknown as DonationsRepository;
    // null avoids the default-parameter evaluation (undefined triggers getDatabasePool())
    const service = new DonationsService(null as never, { paypalClient: paypal, donationsRepository: donationsRepo });
    await expect(
      service.initiate({ userId: 'u', amount: 10, currency: 'USD', req: makeFakeReq() }),
    ).rejects.toThrow('Database is not configured');
  });

  it('throws when amount is below minimum', async () => {
    const db = { query: jest.fn() };
    const donationsRepo = {
      create: jest.fn(),
      findById: jest.fn(),
      findByPaypalOrderId: jest.fn(),
      updateStatus: jest.fn(),
      listAll: jest.fn(),
      listAllForExport: jest.fn(),
    } as unknown as DonationsRepository;
    const paypal = { createOrder: jest.fn(), captureOrder: jest.fn() } as unknown as PayPalClient;
    const service = new DonationsService(db, { donationsRepository: donationsRepo, paypalClient: paypal });

    await expect(
      service.initiate({ userId: 'u', amount: 0, currency: 'USD', req: makeFakeReq() }),
    ).rejects.toThrow('Donation amount must be between');
  });

  it('creates a PayPal order and stores donation on initiate', async () => {
    const db = { query: jest.fn() };
    const donationsRepo = {
      create: jest.fn().mockResolvedValue(makeDonation()),
      findById: jest.fn(),
      findByPaypalOrderId: jest.fn(),
      updateStatus: jest.fn(),
      listAll: jest.fn(),
      listAllForExport: jest.fn(),
    } as unknown as DonationsRepository;
    const paypal = {
      createOrder: jest.fn().mockResolvedValue({ id: 'ORDER-123', approvalUrl: 'https://paypal.com/checkout' }),
      captureOrder: jest.fn(),
    } as unknown as PayPalClient;
    const service = new DonationsService(db, { donationsRepository: donationsRepo, paypalClient: paypal });

    const result = await service.initiate({ userId: 'user-uuid', amount: 10, currency: 'USD', req: makeFakeReq() });

    expect(paypal.createOrder).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 10, currency: 'USD' }),
    );
    expect(donationsRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'user-uuid', amount: 10, paypalOrderId: 'ORDER-123' }),
    );
    expect(result.approvalUrl).toBe('https://paypal.com/checkout');
    expect(result.donationId).toBe('donation-uuid');
  });

  it('returns donationId idempotently when donation is already completed', async () => {
    const db = { query: jest.fn() };
    const donationsRepo = {
      create: jest.fn(),
      findById: jest.fn(),
      findByPaypalOrderId: jest.fn().mockResolvedValue(makeDonation({ status: 'completed' })),
      updateStatus: jest.fn(),
      listAll: jest.fn(),
      listAllForExport: jest.fn(),
    } as unknown as DonationsRepository;
    const paypal = {
      createOrder: jest.fn(),
      captureOrder: jest.fn(),
    } as unknown as PayPalClient;
    const service = new DonationsService(db, { donationsRepository: donationsRepo, paypalClient: paypal });

    const result = await service.handleSuccess('ORDER-123');

    expect(paypal.captureOrder).not.toHaveBeenCalled();
    expect(result.donationId).toBe('donation-uuid');
  });

  it('throws 404 when donation not found on handleSuccess', async () => {
    const db = { query: jest.fn() };
    const donationsRepo = {
      create: jest.fn(),
      findById: jest.fn(),
      findByPaypalOrderId: jest.fn().mockResolvedValue(null),
      updateStatus: jest.fn(),
      listAll: jest.fn(),
      listAllForExport: jest.fn(),
    } as unknown as DonationsRepository;
    const paypal = { createOrder: jest.fn(), captureOrder: jest.fn() } as unknown as PayPalClient;
    const service = new DonationsService(db, { donationsRepository: donationsRepo, paypalClient: paypal });

    await expect(service.handleSuccess('NONEXISTENT')).rejects.toThrow(DonationError);
  });

  it('captures PayPal order and upgrades free_user on handleSuccess', async () => {
    const db = {
      query: jest
        .fn()
        .mockResolvedValueOnce({ rows: [{ role: 'free_user' }] })
        .mockResolvedValueOnce({ rows: [] }),
    };
    const donation = makeDonation();
    const donationsRepo = {
      create: jest.fn(),
      findById: jest.fn(),
      findByPaypalOrderId: jest.fn().mockResolvedValue(donation),
      updateStatus: jest.fn().mockResolvedValue({ ...donation, status: 'completed', userUpgraded: true }),
      listAll: jest.fn(),
      listAllForExport: jest.fn(),
    } as unknown as DonationsRepository;
    const paypal = {
      createOrder: jest.fn(),
      captureOrder: jest.fn().mockResolvedValue({ transactionId: 'TXN-001', status: 'COMPLETED' }),
    } as unknown as PayPalClient;
    const tokenBlacklist = { invalidateUserTokens: jest.fn().mockResolvedValue(undefined) };
    const service = new DonationsService(db, {
      donationsRepository: donationsRepo,
      paypalClient: paypal,
      tokenBlacklist,
    });

    const result = await service.handleSuccess('ORDER-123');

    expect(paypal.captureOrder).toHaveBeenCalledWith('ORDER-123');
    expect(tokenBlacklist.invalidateUserTokens).toHaveBeenCalledWith('user-uuid');
    expect(donationsRepo.updateStatus).toHaveBeenCalledWith(
      'donation-uuid',
      'completed',
      expect.objectContaining({ userUpgraded: true }),
    );
    expect(result.donationId).toBe('donation-uuid');
  });

  it('marks donation as cancelled on handleCancel', async () => {
    const donation = makeDonation();
    const db = { query: jest.fn() };
    const donationsRepo = {
      create: jest.fn(),
      findById: jest.fn(),
      findByPaypalOrderId: jest.fn().mockResolvedValue(donation),
      updateStatus: jest.fn().mockResolvedValue({ ...donation, status: 'cancelled' }),
      listAll: jest.fn(),
      listAllForExport: jest.fn(),
    } as unknown as DonationsRepository;
    const paypal = { createOrder: jest.fn(), captureOrder: jest.fn() } as unknown as PayPalClient;
    const service = new DonationsService(db, { donationsRepository: donationsRepo, paypalClient: paypal });

    await service.handleCancel('ORDER-123');

    expect(donationsRepo.updateStatus).toHaveBeenCalledWith('donation-uuid', 'cancelled');
  });
});
