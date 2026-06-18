import { DonationsRepository } from './donations.repository';

function makeRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'donation-uuid',
    user_id: 'user-uuid',
    amount: '10.00',
    currency: 'USD',
    paypal_order_id: 'ORDER-123',
    paypal_transaction_id: null,
    status: 'pending',
    user_upgraded: false,
    created_at: '2026-06-18T08:00:00.000Z',
    completed_at: null,
    ...overrides,
  };
}

describe('DonationsRepository', () => {
  it('creates a pending donation record', async () => {
    const db = { query: jest.fn().mockResolvedValue({ rows: [makeRow()] }) };
    const repo = new DonationsRepository(db);

    const result = await repo.create({
      userId: 'user-uuid',
      amount: 10,
      currency: 'USD',
      paypalOrderId: 'ORDER-123',
    });

    expect(db.query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO donations'),
      ['user-uuid', 10, 'USD', 'ORDER-123'],
    );
    expect(result.amount).toBe(10);
    expect(result.status).toBe('pending');
    expect(result.paypalOrderId).toBe('ORDER-123');
  });

  it('finds a donation by id', async () => {
    const db = { query: jest.fn().mockResolvedValue({ rows: [makeRow()] }) };
    const repo = new DonationsRepository(db);

    const result = await repo.findById('donation-uuid');

    expect(result?.id).toBe('donation-uuid');
  });

  it('returns null when donation is not found by id', async () => {
    const db = { query: jest.fn().mockResolvedValue({ rows: [] }) };
    const repo = new DonationsRepository(db);

    expect(await repo.findById('nonexistent')).toBeNull();
  });

  it('finds a donation by PayPal order ID', async () => {
    const db = { query: jest.fn().mockResolvedValue({ rows: [makeRow()] }) };
    const repo = new DonationsRepository(db);

    const result = await repo.findByPaypalOrderId('ORDER-123');

    expect(result?.paypalOrderId).toBe('ORDER-123');
  });

  it('updates donation status to completed', async () => {
    const completedRow = makeRow({
      status: 'completed',
      paypal_transaction_id: 'TXN-ENCRYPTED',
      user_upgraded: true,
      completed_at: '2026-06-18T09:00:00.000Z',
    });
    const db = { query: jest.fn().mockResolvedValue({ rows: [completedRow] }) };
    const repo = new DonationsRepository(db);

    const result = await repo.updateStatus('donation-uuid', 'completed', {
      paypalTransactionId: 'TXN-ENCRYPTED',
      userUpgraded: true,
      completedAt: '2026-06-18T09:00:00.000Z',
    });

    expect(result.status).toBe('completed');
    expect(result.userUpgraded).toBe(true);
    expect(db.query).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE donations'),
      expect.arrayContaining(['donation-uuid', 'completed']),
    );
  });
});
