import { UserManagementService, UserManagementError } from './user-management.service';
import type { UserManagementRepository, AdminUserRecord } from '../repositories/user-management.repository';

function makeUser(overrides: Partial<AdminUserRecord> = {}): AdminUserRecord {
  return {
    id: 'user-1',
    fullName: 'Alice',
    email: 'alice@example.com',
    role: 'free_user',
    emailVerified: true,
    onboardingCompleted: true,
    languagePreference: 'en',
    createdAt: '2024-01-01T00:00:00.000Z',
    lastLoginAt: null,
    deletedAt: null,
    ...overrides,
  };
}

function makeRepo(overrides: Partial<Record<keyof UserManagementRepository, jest.Mock>> = {}): jest.Mocked<UserManagementRepository> {
  return {
    listUsers: jest.fn(),
    getUserById: jest.fn(),
    updateUser: jest.fn(),
    softDeleteUser: jest.fn(),
    hardDeleteUser: jest.fn(),
    restoreUser: jest.fn(),
    getUserByEmail: jest.fn(),
    countActiveAlertsForUser: jest.fn(),
    pauseExcessAlertsForUser: jest.fn(),
    recordLastLogin: jest.fn(),
    ...overrides,
  } as unknown as jest.Mocked<UserManagementRepository>;
}

describe('UserManagementService', () => {
  const db = {} as never;
  const tokenBlacklist = { invalidateUserTokens: jest.fn() };
  const passwordResetTokens = { create: jest.fn() };
  const passwordResetEmails = { sendPasswordResetEmail: jest.fn() };
  const manualEmailVerifiedEmails = { sendManualEmailVerifiedEmail: jest.fn() };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('listUsers', () => {
    it('returns paginated results', async () => {
      const userRepo = makeRepo({ listUsers: jest.fn().mockResolvedValue({ users: [makeUser()], total: 1 }) });
      const service = new UserManagementService(db, { userRepo });
      const result = await service.listUsers({ page: 1, limit: 10 });
      expect(result.total).toBe(1);
      expect(result.users).toHaveLength(1);
      expect(result.page).toBe(1);
    });

    it('throws when db is not configured', async () => {
      const service = new UserManagementService(null as never, {
        userRepo: makeRepo(),
        passwordResetTokens,
        passwordResetEmails,
        tokenBlacklist,
      });
      await expect(service.listUsers({ page: 1, limit: 10 })).rejects.toThrow(UserManagementError);
    });
  });

  describe('getUser', () => {
    it('returns the user when found', async () => {
      const userRepo = makeRepo({ getUserById: jest.fn().mockResolvedValue(makeUser()) });
      const service = new UserManagementService(db, { userRepo });
      const result = await service.getUser('user-1');
      expect(result.id).toBe('user-1');
    });

    it('throws 404 when user not found', async () => {
      const userRepo = makeRepo({ getUserById: jest.fn().mockResolvedValue(null) });
      const service = new UserManagementService(db, { userRepo });
      await expect(service.getUser('missing')).rejects.toMatchObject({ statusCode: 404 });
    });
  });

  describe('updateUser', () => {
    it('updates without special handling when role does not change', async () => {
      const existing = makeUser({ role: 'free_user' });
      const updated = makeUser({ fullName: 'New Name' });
      const userRepo = makeRepo({
        getUserById: jest.fn().mockResolvedValue(existing),
        updateUser: jest.fn().mockResolvedValue(updated),
      });
      const service = new UserManagementService(db, { userRepo, tokenBlacklist });

      const result = await service.updateUser('user-1', { fullName: 'New Name' }, 'admin-1');

      expect(tokenBlacklist.invalidateUserTokens).not.toHaveBeenCalled();
      expect(result.fullName).toBe('New Name');
    });

    it('invalidates tokens on role change', async () => {
      const existing = makeUser({ role: 'free_user' });
      const updated = makeUser({ role: 'premium_user' });
      const userRepo = makeRepo({
        getUserById: jest.fn().mockResolvedValue(existing),
        updateUser: jest.fn().mockResolvedValue(updated),
        countActiveAlertsForUser: jest.fn().mockResolvedValue(0),
      });
      const service = new UserManagementService(db, { userRepo, tokenBlacklist });

      await service.updateUser('user-1', { role: 'premium_user' }, 'admin-1');

      expect(tokenBlacklist.invalidateUserTokens).toHaveBeenCalledWith('user-1');
    });

    it('pauses excess alerts when downgrading from premium to free', async () => {
      const existing = makeUser({ role: 'premium_user' });
      const updated = makeUser({ role: 'free_user' });
      const userRepo = makeRepo({
        getUserById: jest.fn().mockResolvedValue(existing),
        updateUser: jest.fn().mockResolvedValue(updated),
        countActiveAlertsForUser: jest.fn().mockResolvedValue(10),
        pauseExcessAlertsForUser: jest.fn().mockResolvedValue(undefined),
      });
      const service = new UserManagementService(db, { userRepo, tokenBlacklist });

      await service.updateUser('user-1', { role: 'free_user' }, 'admin-1');

      expect(userRepo.pauseExcessAlertsForUser).toHaveBeenCalledWith('user-1', 5);
    });

    it('does not pause alerts when downgrading but count is within limit', async () => {
      const existing = makeUser({ role: 'premium_user' });
      const updated = makeUser({ role: 'free_user' });
      const userRepo = makeRepo({
        getUserById: jest.fn().mockResolvedValue(existing),
        updateUser: jest.fn().mockResolvedValue(updated),
        countActiveAlertsForUser: jest.fn().mockResolvedValue(3),
        pauseExcessAlertsForUser: jest.fn(),
      });
      const service = new UserManagementService(db, { userRepo, tokenBlacklist });

      await service.updateUser('user-1', { role: 'free_user' }, 'admin-1');

      expect(userRepo.pauseExcessAlertsForUser).not.toHaveBeenCalled();
    });

    it('does not invalidate tokens when admin edits themselves', async () => {
      const existing = makeUser({ id: 'admin-1', role: 'free_user' });
      const updated = makeUser({ id: 'admin-1', role: 'premium_user' });
      const userRepo = makeRepo({
        getUserById: jest.fn().mockResolvedValue(existing),
        updateUser: jest.fn().mockResolvedValue(updated),
        countActiveAlertsForUser: jest.fn().mockResolvedValue(0),
      });
      const service = new UserManagementService(db, { userRepo, tokenBlacklist });

      await service.updateUser('admin-1', { role: 'premium_user' }, 'admin-1');

      expect(tokenBlacklist.invalidateUserTokens).not.toHaveBeenCalled();
    });

    it('throws 404 when user not found', async () => {
      const userRepo = makeRepo({ getUserById: jest.fn().mockResolvedValue(null) });
      const service = new UserManagementService(db, { userRepo });
      await expect(service.updateUser('missing', {}, 'admin-1')).rejects.toMatchObject({ statusCode: 404 });
    });
  });

  describe('deleteUser', () => {
    it('soft-deletes and invalidates tokens', async () => {
      const userRepo = makeRepo({ softDeleteUser: jest.fn().mockResolvedValue(true) });
      const service = new UserManagementService(db, { userRepo, tokenBlacklist });

      await service.deleteUser('user-1', 'admin-1');

      expect(userRepo.softDeleteUser).toHaveBeenCalledWith('user-1');
      expect(tokenBlacklist.invalidateUserTokens).toHaveBeenCalledWith('user-1');
    });

    it('prevents admin from deleting their own account', async () => {
      const service = new UserManagementService(db, { userRepo: makeRepo(), tokenBlacklist });
      await expect(service.deleteUser('admin-1', 'admin-1')).rejects.toMatchObject({ statusCode: 400 });
      expect(tokenBlacklist.invalidateUserTokens).not.toHaveBeenCalled();
    });

    it('throws 404 when user not found', async () => {
      const userRepo = makeRepo({ softDeleteUser: jest.fn().mockResolvedValue(false) });
      const service = new UserManagementService(db, { userRepo, tokenBlacklist });
      await expect(service.deleteUser('missing', 'admin-1')).rejects.toMatchObject({ statusCode: 404 });
    });
  });

  describe('hardDeleteUser', () => {
    it('permanently deletes a deactivated user', async () => {
      const userRepo = makeRepo({
        getUserById: jest.fn().mockResolvedValue(makeUser({ deletedAt: '2026-06-25T10:00:00.000Z' })),
        hardDeleteUser: jest.fn().mockResolvedValue(true),
      });
      const service = new UserManagementService(db, { userRepo, tokenBlacklist });

      await service.hardDeleteUser('user-1', 'admin-1');

      expect(userRepo.hardDeleteUser).toHaveBeenCalledWith('user-1');
    });

    it('prevents permanent deletion of active users', async () => {
      const userRepo = makeRepo({
        getUserById: jest.fn().mockResolvedValue(makeUser({ deletedAt: null })),
        hardDeleteUser: jest.fn(),
      });
      const service = new UserManagementService(db, { userRepo, tokenBlacklist });

      await expect(service.hardDeleteUser('user-1', 'admin-1')).rejects.toMatchObject({ statusCode: 400 });
      expect(userRepo.hardDeleteUser).not.toHaveBeenCalled();
    });

    it('prevents admin from permanently deleting their own account', async () => {
      const userRepo = makeRepo({ hardDeleteUser: jest.fn() });
      const service = new UserManagementService(db, { userRepo, tokenBlacklist });

      await expect(service.hardDeleteUser('admin-1', 'admin-1')).rejects.toMatchObject({ statusCode: 400 });
      expect(userRepo.hardDeleteUser).not.toHaveBeenCalled();
    });
  });

  describe('restoreUser', () => {
    it('returns restored user record', async () => {
      const restored = makeUser({ deletedAt: null });
      const userRepo = makeRepo({ restoreUser: jest.fn().mockResolvedValue(restored) });
      const service = new UserManagementService(db, { userRepo });

      const result = await service.restoreUser('user-1');
      expect(result.id).toBe('user-1');
    });

    it('throws 404 when user not found or not deleted', async () => {
      const userRepo = makeRepo({ restoreUser: jest.fn().mockResolvedValue(null) });
      const service = new UserManagementService(db, { userRepo });
      await expect(service.restoreUser('missing')).rejects.toMatchObject({ statusCode: 404 });
    });
  });

  describe('verifyUserEmail', () => {
    it('marks an active unverified user as verified', async () => {
      const existing = makeUser({ emailVerified: false });
      const updated = makeUser({ emailVerified: true });
      const userRepo = makeRepo({
        getUserById: jest.fn().mockResolvedValue(existing),
        updateUser: jest.fn().mockResolvedValue(updated),
      });
      manualEmailVerifiedEmails.sendManualEmailVerifiedEmail.mockResolvedValue(undefined);
      const service = new UserManagementService(db, { userRepo, manualEmailVerifiedEmails });

      const result = await service.verifyUserEmail('user-1');

      expect(userRepo.updateUser).toHaveBeenCalledWith('user-1', { emailVerified: true });
      expect(manualEmailVerifiedEmails.sendManualEmailVerifiedEmail).toHaveBeenCalledWith({
        email: updated.email,
        fullName: updated.fullName,
        languagePreference: updated.languagePreference,
      });
      expect(result.emailVerified).toBe(true);
    });

    it('returns the existing user without updating when already verified', async () => {
      const existing = makeUser({ emailVerified: true });
      const userRepo = makeRepo({
        getUserById: jest.fn().mockResolvedValue(existing),
        updateUser: jest.fn(),
      });
      const service = new UserManagementService(db, { userRepo, manualEmailVerifiedEmails });

      const result = await service.verifyUserEmail('user-1');

      expect(userRepo.updateUser).not.toHaveBeenCalled();
      expect(manualEmailVerifiedEmails.sendManualEmailVerifiedEmail).not.toHaveBeenCalled();
      expect(result).toBe(existing);
    });

    it('throws 404 when user is missing or deleted', async () => {
      const userRepo = makeRepo({ getUserById: jest.fn().mockResolvedValue(makeUser({ deletedAt: '2024-01-01T00:00:00.000Z' })) });
      const service = new UserManagementService(db, { userRepo, manualEmailVerifiedEmails });

      await expect(service.verifyUserEmail('deleted')).rejects.toMatchObject({ statusCode: 404 });

      userRepo.getUserById.mockResolvedValue(null);
      await expect(service.verifyUserEmail('missing')).rejects.toMatchObject({ statusCode: 404 });
    });
  });

  describe('forcePasswordReset', () => {
    it('creates token, sends email, invalidates sessions, and returns email', async () => {
      const user = makeUser({ email: 'alice@example.com' });
      const userRepo = makeRepo({ getUserById: jest.fn().mockResolvedValue(user) });
      passwordResetTokens.create.mockResolvedValue(undefined);
      passwordResetEmails.sendPasswordResetEmail.mockResolvedValue(undefined);

      const service = new UserManagementService(db, {
        userRepo,
        passwordResetTokens,
        passwordResetEmails,
        tokenBlacklist,
      });

      const result = await service.forcePasswordReset('user-1');

      expect(passwordResetTokens.create).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'user-1' }),
      );
      expect(passwordResetEmails.sendPasswordResetEmail).toHaveBeenCalledWith(
        expect.objectContaining({ email: 'alice@example.com' }),
      );
      expect(tokenBlacklist.invalidateUserTokens).toHaveBeenCalledWith('user-1');
      expect(result.email).toBe('alice@example.com');
    });

    it('throws 404 when user not found', async () => {
      const userRepo = makeRepo({ getUserById: jest.fn().mockResolvedValue(null) });
      const service = new UserManagementService(db, { userRepo, passwordResetTokens, passwordResetEmails, tokenBlacklist });
      await expect(service.forcePasswordReset('missing')).rejects.toMatchObject({ statusCode: 404 });
    });
  });
});
