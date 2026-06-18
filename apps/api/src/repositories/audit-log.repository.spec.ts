import { AuditLogRepository } from './audit-log.repository';

const mockDate = new Date('2024-01-01T00:00:00.000Z');

function makeRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'log-id-1',
    admin_user_id: 'admin-1',
    action_type: 'user_edit',
    target_type: 'user',
    target_id: 'target-user-1',
    changes: { role: { from: 'free_user', to: 'premium_user' } },
    ip_address: '127.0.0.1',
    user_agent: 'jest',
    created_at: mockDate,
    ...overrides,
  };
}

describe('AuditLogRepository', () => {
  let db: { query: jest.Mock };
  let repo: AuditLogRepository;

  beforeEach(() => {
    db = { query: jest.fn() };
    repo = new AuditLogRepository(db as never);
  });

  describe('create', () => {
    it('inserts a row with all fields', async () => {
      db.query.mockResolvedValue({ rows: [] });

      await repo.create({
        adminUserId: 'admin-1',
        actionType: 'user_edit',
        targetType: 'user',
        targetId: 'target-1',
        changes: { key: 'value' },
        ipAddress: '10.0.0.1',
        userAgent: 'test-agent',
      });

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO audit_logs'),
        ['admin-1', 'user_edit', 'user', 'target-1', JSON.stringify({ key: 'value' }), '10.0.0.1', 'test-agent'],
      );
    });

    it('inserts null for optional fields when omitted', async () => {
      db.query.mockResolvedValue({ rows: [] });

      await repo.create({ adminUserId: 'admin-1', actionType: 'user_delete', targetType: 'user' });

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO audit_logs'),
        ['admin-1', 'user_delete', 'user', null, null, null, null],
      );
    });
  });

  describe('list', () => {
    it('returns mapped records and total without filters', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ count: '5' }] })
        .mockResolvedValueOnce({ rows: [makeRow()] });

      const result = await repo.list({ page: 1, limit: 10 });

      expect(result.total).toBe(5);
      expect(result.logs).toHaveLength(1);
      expect(result.logs[0]).toEqual({
        id: 'log-id-1',
        adminUserId: 'admin-1',
        actionType: 'user_edit',
        targetType: 'user',
        targetId: 'target-user-1',
        changes: { role: { from: 'free_user', to: 'premium_user' } },
        ipAddress: '127.0.0.1',
        userAgent: 'jest',
        createdAt: mockDate.toISOString(),
      });
    });

    it('applies actionType and targetType filters', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ count: '1' }] })
        .mockResolvedValueOnce({ rows: [] });

      await repo.list({ page: 1, limit: 10, actionType: 'user_edit', targetType: 'user' });

      const countCall = db.query.mock.calls[0];
      expect(countCall[0]).toContain('WHERE');
      expect(countCall[0]).toContain('action_type');
      expect(countCall[0]).toContain('target_type');
      expect(countCall[1]).toEqual(expect.arrayContaining(['user_edit', 'user']));
    });

    it('handles pagination offset', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ count: '20' }] })
        .mockResolvedValueOnce({ rows: [] });

      await repo.list({ page: 3, limit: 5 });

      const dataCall = db.query.mock.calls[1];
      expect(dataCall[1]).toEqual(expect.arrayContaining([5, 10]));
    });

    it('handles null values gracefully', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ count: '1' }] })
        .mockResolvedValueOnce({ rows: [makeRow({ target_id: null, changes: null, ip_address: null, user_agent: null })] });

      const result = await repo.list({ page: 1, limit: 10 });
      expect(result.logs[0].targetId).toBeNull();
      expect(result.logs[0].changes).toBeNull();
      expect(result.logs[0].ipAddress).toBeNull();
    });
  });
});
