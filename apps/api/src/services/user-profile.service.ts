import bcrypt from 'bcryptjs';
import {
  type ChangePasswordRequest,
  type ChangePasswordResponse,
  type LanguagePreference,
  type UpdateUserProfileRequest,
  type User,
  type UserProfileResponse,
} from '@crypto-market-analysis/shared/types';
import { TokenBlacklistRepository } from '../repositories/token-blacklist.repository';
import { UserRepository } from '../repositories/user.repository';

const PASSWORD_STRENGTH_ERROR =
  'Password must be at least 8 characters with 1 uppercase, 1 number, and 1 special character';

export class UserProfileError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
  ) {
    super(message);
  }
}

interface UserProfileStore {
  findById(userId: string): Promise<User | undefined>;
  updateProfile(
    userId: string,
    input: { fullName?: string; languagePreference: LanguagePreference },
  ): Promise<User | undefined>;
  updatePasswordHash(userId: string, passwordHash: string): Promise<void>;
}

interface TokenInvalidationStore {
  invalidateUserTokens(userId: string, invalidatedAt?: Date): Promise<void>;
}

export class UserProfileService {
  constructor(
    private readonly users: UserProfileStore = new UserRepository(),
    private readonly tokenInvalidations: TokenInvalidationStore = new TokenBlacklistRepository(),
  ) {}

  async getProfile(userId: string): Promise<UserProfileResponse> {
    const user = await this.findExistingUser(userId);

    return toUserProfileResponse(user);
  }

  async updateProfile(
    userId: string,
    request: UpdateUserProfileRequest,
  ): Promise<UserProfileResponse> {
    const currentUser = await this.findExistingUser(userId);
    const languagePreference = request.languagePreference ?? currentUser.languagePreference;

    if (!['en', 'hu'].includes(languagePreference)) {
      throw new UserProfileError(400, 'Unsupported language preference');
    }

    const updatedUser = await this.users.updateProfile(userId, {
      fullName:
        request.fullName === undefined
          ? currentUser.fullName
          : normalizeFullName(request.fullName),
      languagePreference,
    });

    if (!updatedUser) {
      throw new UserProfileError(404, 'User not found');
    }

    return toUserProfileResponse(updatedUser);
  }

  async changePassword(
    userId: string,
    request: ChangePasswordRequest,
  ): Promise<ChangePasswordResponse> {
    const user = await this.findExistingUser(userId);
    if (!user.passwordHash) {
      throw new UserProfileError(400, 'Password changes are unavailable for this account');
    }

    const currentPasswordMatches = await bcrypt.compare(
      request.currentPassword,
      user.passwordHash,
    );
    if (!currentPasswordMatches) {
      throw new UserProfileError(400, 'Current password is incorrect');
    }

    if (!isStrongPassword(request.newPassword)) {
      throw new UserProfileError(400, PASSWORD_STRENGTH_ERROR);
    }

    const passwordHash = await bcrypt.hash(request.newPassword, 12);
    await this.users.updatePasswordHash(userId, passwordHash);
    await this.tokenInvalidations.invalidateUserTokens(userId);

    return {
      message: 'Password changed successfully. Please log in again.',
    };
  }

  private async findExistingUser(userId: string): Promise<User> {
    const user = await this.users.findById(userId);
    if (!user) {
      throw new UserProfileError(404, 'User not found');
    }

    return user;
  }
}

function toUserProfileResponse(user: User): UserProfileResponse {
  return {
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    languagePreference: user.languagePreference,
    role: user.role,
    emailVerified: user.emailVerified,
    onboardingCompleted: user.onboardingCompleted,
    createdAt: toIsoString(user.createdAt),
  };
}

function normalizeFullName(fullName: string | undefined): string | undefined {
  const trimmedName = fullName?.trim();
  return trimmedName || undefined;
}

function isStrongPassword(password: string): boolean {
  return /^(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/.test(password);
}

function toIsoString(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}
