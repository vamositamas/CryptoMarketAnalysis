import bcrypt from 'bcryptjs';
import type { User } from '@crypto-market-analysis/shared/types';
import { UserProfileError, UserProfileService } from './user-profile.service';

function createUser(overrides: Partial<User> = {}): User {
  return {
    id: 'user-id',
    email: 'user@example.com',
    passwordHash: 'hashed-current-password',
    fullName: 'Ada Analyst',
    languagePreference: 'en',
    role: 'free_user',
    emailVerified: true,
    onboardingCompleted: false,
    createdAt: new Date('2026-06-11T10:00:00.000Z'),
    updatedAt: new Date('2026-06-11T10:00:00.000Z'),
    ...overrides,
  };
}

describe('UserProfileService', () => {
  const bcryptCompare = jest.spyOn(bcrypt, 'compare');
  const bcryptHash = jest.spyOn(bcrypt, 'hash');

  afterEach(() => {
    jest.resetAllMocks();
  });

  it('returns a safe profile without password hash', async () => {
    const users = {
      findById: jest.fn().mockResolvedValue(createUser()),
      updateProfile: jest.fn(),
      updatePasswordHash: jest.fn(),
    };
    const service = new UserProfileService(users, {
      invalidateUserTokens: jest.fn(),
    });

    await expect(service.getProfile('user-id')).resolves.toEqual({
      id: 'user-id',
      email: 'user@example.com',
      fullName: 'Ada Analyst',
      languagePreference: 'en',
      role: 'free_user',
      emailVerified: true,
      onboardingCompleted: false,
      createdAt: '2026-06-11T10:00:00.000Z',
    });
  });

  it('updates full name and language preference', async () => {
    const users = {
      findById: jest.fn().mockResolvedValue(createUser()),
      updateProfile: jest.fn().mockResolvedValue(
        createUser({
          fullName: 'John Doe',
          languagePreference: 'hu',
        }),
      ),
      updatePasswordHash: jest.fn(),
    };
    const service = new UserProfileService(users, {
      invalidateUserTokens: jest.fn(),
    });

    await expect(
      service.updateProfile('user-id', {
        fullName: ' John Doe ',
        languagePreference: 'hu',
      }),
    ).resolves.toMatchObject({
      fullName: 'John Doe',
      languagePreference: 'hu',
    });
    expect(users.updateProfile).toHaveBeenCalledWith('user-id', {
      fullName: 'John Doe',
      languagePreference: 'hu',
    });
  });

  it('rejects unsupported language preferences', async () => {
    const users = {
      findById: jest.fn().mockResolvedValue(createUser()),
      updateProfile: jest.fn(),
      updatePasswordHash: jest.fn(),
    };
    const service = new UserProfileService(users, {
      invalidateUserTokens: jest.fn(),
    });

    await expect(
      service.updateProfile('user-id', { languagePreference: 'de' as never }),
    ).rejects.toMatchObject({
      statusCode: 400,
      message: 'Unsupported language preference',
    } satisfies Partial<UserProfileError>);
    expect(users.updateProfile).not.toHaveBeenCalled();
  });

  it('changes password and invalidates existing sessions', async () => {
    bcryptCompare.mockResolvedValue(true as never);
    bcryptHash.mockResolvedValue('hashed-new-password' as never);
    const users = {
      findById: jest.fn().mockResolvedValue(createUser()),
      updateProfile: jest.fn(),
      updatePasswordHash: jest.fn().mockResolvedValue(undefined),
    };
    const tokenInvalidations = {
      invalidateUserTokens: jest.fn().mockResolvedValue(undefined),
    };
    const service = new UserProfileService(users, tokenInvalidations);

    await expect(
      service.changePassword('user-id', {
        currentPassword: 'CurrentPass123!',
        newPassword: 'NewPass123!',
      }),
    ).resolves.toEqual({
      message: 'Password changed successfully. Please log in again.',
    });

    expect(bcryptCompare).toHaveBeenCalledWith(
      'CurrentPass123!',
      'hashed-current-password',
    );
    expect(bcryptHash).toHaveBeenCalledWith('NewPass123!', 12);
    expect(users.updatePasswordHash).toHaveBeenCalledWith('user-id', 'hashed-new-password');
    expect(tokenInvalidations.invalidateUserTokens).toHaveBeenCalledWith('user-id');
  });

  it('rejects password changes when the current password is wrong', async () => {
    bcryptCompare.mockResolvedValue(false as never);
    const users = {
      findById: jest.fn().mockResolvedValue(createUser()),
      updateProfile: jest.fn(),
      updatePasswordHash: jest.fn(),
    };
    const tokenInvalidations = {
      invalidateUserTokens: jest.fn(),
    };
    const service = new UserProfileService(users, tokenInvalidations);

    await expect(
      service.changePassword('user-id', {
        currentPassword: 'wrong',
        newPassword: 'NewPass123!',
      }),
    ).rejects.toMatchObject({
      statusCode: 400,
      message: 'Current password is incorrect',
    } satisfies Partial<UserProfileError>);
    expect(users.updatePasswordHash).not.toHaveBeenCalled();
    expect(tokenInvalidations.invalidateUserTokens).not.toHaveBeenCalled();
  });
});
