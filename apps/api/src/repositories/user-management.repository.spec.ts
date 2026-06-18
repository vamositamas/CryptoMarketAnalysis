import { UserManagementRepository } from './user-management.repository';

const mockDate = new Date('2024-01-01T00:00:00.000Z');

function makeRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'user-1',
    full_name: 'Alice Admin',
    email: 'alice@example.com',
    role: 'free_user',
    email_verified: true,
    onboarding_completed: true,
    language_preference: 'en',
    created_at: mockDate,
    last_login_at: mockDate,
    deleted_at: null,
    ...overrides,
  };
}

describe('UserManagementRepository', () => {
  let db: { query: jest.Mock };
  let repo: UserManagementRepository;

  beforeEach(() => {
    db = { query: jest.fn() };
    repo = new UserManagementRepository(db as never);
  });

  describe('listUsers', () => {
    it('returns users and total without filters', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ count: '2' }] })
        .mockResolvedValueOnce({ rows: [makeRow(), makeRow({ id: 'user-2' })] });

      const result = await repo.listUsers({ page: 1, limit: 50 });

      expect(result.total).toBe(2);
      expect(result.users).toHaveLength(2);
      expect(result.users[0]).toMatchObject({
        id: 'user-1',
        email: 'alice@example.com',
        role: 'free_user',
        lastLoginAt: mockDate.toISOString(),
        deletedAt: null,
      });
    });

    it('excludes deleted users by default', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ count: '0' }] })
        .mockResolvedValueOnce({ rows: [] });

      await repo.listUsers({ page: 1, limit: 50 });

      const countQuery = db.query.mock.calls[0][0] as string;
      expect(countQuery).toContain('deleted_at IS NULL');
    });

    it('includes deleted users when showDeleted is true', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ count: '1' }] })
        .mockResolvedValueOnce({ rows: [makeRow({ deleted_at: mockDate })] });

      await repo.listUsers({ page: 1, limit: 50, showDeleted: true });

      const countQuery = db.query.mock.calls[0][0] as string;
      expect(countQuery).not.toContain('deleted_at IS NULL');
    });

    it('adds search filter when provided', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ count: '1' }] })
        .mockResolvedValueOnce({ rows: [makeRow()] });

      await repo.listUsers({ page: 1, limit: 50, search: 'alice' });

      const countCall = db.query.mock.calls[0];
      expect(countCall[0]).toContain('ILIKE');
      expect(countCall[1]).toContain('%alice%');
    });

    it('adds role filter when provided', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ count: '1' }] })
        .mockResolvedValueOnce({ rows: [makeRow()] });

      await repo.listUsers({ page: 1, limit: 50, role: 'administrator' });

      const countCall = db.query.mock.calls[0];
      expect(countCall[1]).toContain('administrator');
    });

    it('calculates correct pagination offset', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ count: '100' }] })
        .mockResolvedValueOnce({ rows: [] });

      await repo.listUsers({ page: 3, limit: 10 });

      const dataCall = db.query.mock.calls[1];
      expect(dataCall[1]).toEqual(expect.arrayContaining([10, 20]));
    });
  });

  describe('getUserById', () => {
    it('returns a user record when found', async () => {
      db.query.mockResolvedValue({ rows: [makeRow()] });
      const result = await repo.getUserById('user-1');
      expect(result?.id).toBe('user-1');
      expect(result?.fullName).toBe('Alice Admin');
    });

    it('returns null when not found', async () => {
      db.query.mockResolvedValue({ rows: [] });
      const result = await repo.getUserById('missing');
      expect(result).toBeNull();
    });
  });

  describe('updateUser', () => {
    it('builds SET clause and returns updated record', async () => {
      db.query.mockResolvedValue({ rows: [makeRow({ role: 'premium_user' })] });

      const result = await repo.updateUser('user-1', { role: 'premium_user' });

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE users'),
        expect.arrayContaining(['premium_user', 'user-1']),
      );
      expect(result?.role).toBe('premium_user');
    });

    it('falls back to getUserById when no params provided', async () => {
      db.query.mockResolvedValue({ rows: [makeRow()] });
      const result = await repo.updateUser('user-1', {});
      expect(result?.id).toBe('user-1');
    });

    it('returns null when user not found', async () => {
      db.query.mockResolvedValue({ rows: [] });
      const result = await repo.updateUser('missing', { role: 'free_user' });
      expect(result).toBeNull();
    });
  });

  describe('softDeleteUser', () => {
    it('returns true when row was deleted', async () => {
      db.query.mockResolvedValue({ rows: [{ id: 'user-1' }], rowCount: 1 });
      expect(await repo.softDeleteUser('user-1')).toBe(true);
    });

    it('returns false when user not found or already deleted', async () => {
      db.query.mockResolvedValue({ rows: [], rowCount: 0 });
      expect(await repo.softDeleteUser('missing')).toBe(false);
    });
  });

  describe('restoreUser', () => {
    it('returns restored user record', async () => {
      db.query.mockResolvedValue({ rows: [makeRow({ deleted_at: null })] });
      const result = await repo.restoreUser('user-1');
      expect(result?.id).toBe('user-1');
    });

    it('returns null when user not found or not deleted', async () => {
      db.query.mockResolvedValue({ rows: [] });
      const result = await repo.restoreUser('user-1');
      expect(result).toBeNull();
    });
  });

  describe('countActiveAlertsForUser', () => {
    it('returns the count of active alerts', async () => {
      db.query.mockResolvedValue({ rows: [{ count: '7' }] });
      const count = await repo.countActiveAlertsForUser('user-1');
      expect(count).toBe(7);
    });
  });

  describe('pauseExcessAlertsForUser', () => {
    it('executes the update query with correct params', async () => {
      db.query.mockResolvedValue({ rows: [], rowCount: 2 });
      await repo.pauseExcessAlertsForUser('user-1', 5);

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('status = \'paused\''),
        ['user-1', 5],
      );
    });
  });
});
