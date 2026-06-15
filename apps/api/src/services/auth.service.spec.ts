import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { AuthService, RegistrationError } from './auth.service';
import type { RegisterRequest, User } from '@crypto-market-analysis/shared/types';

const baseRequest = {
  email: 'USER@example.com',
  password: 'SecurePass123!',
  confirmPassword: 'SecurePass123!',
  languagePreference: 'en' as const,
};

function createUser(overrides: Partial<User> = {}): User {
  return {
    id: 'user-id',
    email: 'user@example.com',
    languagePreference: 'en',
    role: 'free_user',
    emailVerified: false,
    onboardingCompleted: false,
    createdAt: new Date('2026-06-10T00:00:00.000Z'),
    updatedAt: new Date('2026-06-10T00:00:00.000Z'),
    ...overrides,
  };
}

describe('AuthService', () => {
  const originalJwtSecret = process.env.JWT_SECRET;
  const originalGoogleClientId = process.env.GOOGLE_CLIENT_ID;
  const originalGoogleClientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const originalGoogleRedirectUri = process.env.GOOGLE_REDIRECT_URI;
  const originalNodeEnv = process.env.NODE_ENV;
  const originalDevAdminEmail = process.env.DEV_ADMIN_EMAIL;
  const originalDevAdminPassword = process.env.DEV_ADMIN_PASSWORD;

  beforeEach(() => {
    process.env.JWT_SECRET = 'test-jwt-secret';
    process.env.GOOGLE_CLIENT_ID = 'google-client-id';
    process.env.GOOGLE_CLIENT_SECRET = 'google-client-secret';
    process.env.GOOGLE_REDIRECT_URI = 'http://localhost:3000/api/auth/google/callback';
    process.env.NODE_ENV = 'test';
    delete process.env.DEV_ADMIN_EMAIL;
    delete process.env.DEV_ADMIN_PASSWORD;
  });

  afterEach(() => {
    process.env.JWT_SECRET = originalJwtSecret;
    process.env.GOOGLE_CLIENT_ID = originalGoogleClientId;
    process.env.GOOGLE_CLIENT_SECRET = originalGoogleClientSecret;
    process.env.GOOGLE_REDIRECT_URI = originalGoogleRedirectUri;
    process.env.NODE_ENV = originalNodeEnv;
    process.env.DEV_ADMIN_EMAIL = originalDevAdminEmail;
    process.env.DEV_ADMIN_PASSWORD = originalDevAdminPassword;
    jest.restoreAllMocks();
  });

  it('registers a valid email/password user', async () => {
    const users = {
      findByEmail: jest.fn().mockResolvedValue(undefined),
      create: jest.fn().mockResolvedValue(createUser()),
      markEmailVerified: jest.fn(),
    };
    const tokens = {
      create: jest.fn().mockResolvedValue(undefined),
      findByToken: jest.fn(),
      deleteByToken: jest.fn(),
    };
    const service = new AuthService(users, tokens);

    const response = await service.register(baseRequest);

    expect(response).toEqual({
      message: 'Registration successful. Please check your email to verify your account.',
    });
    expect(users.findByEmail).toHaveBeenCalledWith('user@example.com');
    expect(users.create).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'user@example.com',
        languagePreference: 'en',
        role: 'free_user',
      }),
    );
    const passwordHash = users.create.mock.calls[0][0].passwordHash as string;
    await expect(bcrypt.compare(baseRequest.password, passwordHash)).resolves.toBe(true);
    expect(tokens.create).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-id',
        token: expect.any(String),
        expiresAt: expect.any(Date),
      }),
    );
  });

  it('registers the development admin email as a verified administrator', async () => {
    const users = {
      findByEmail: jest.fn().mockResolvedValue(undefined),
      create: jest.fn().mockResolvedValue(createUser({ id: 'admin-id' })),
      markEmailVerified: jest.fn(),
    };
    const tokens = {
      create: jest.fn(),
      findByToken: jest.fn(),
      deleteByToken: jest.fn(),
    };
    const service = new AuthService(users, tokens);

    const response = await service.register({
      ...baseRequest,
      email: 'admin@cryptomarketanalysis.com',
      fullName: 'Admin User',
    });

    expect(response).toEqual({
      message: 'Development administrator account is ready. You can log in now.',
    });
    expect(users.create).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'admin@cryptomarketanalysis.com',
        fullName: 'Admin User',
        role: 'administrator',
        emailVerified: true,
      }),
    );
    expect(tokens.create).not.toHaveBeenCalled();
  });

  it('repairs an existing development admin account through registration', async () => {
    const users = {
      findByEmail: jest.fn().mockResolvedValue(
        createUser({
          email: 'admin@cryptomarketanalysis.com',
          role: 'free_user',
          emailVerified: false,
        }),
      ),
      create: jest.fn(),
      updateDevelopmentAdminCredentials: jest.fn().mockResolvedValue(
        createUser({
          email: 'admin@cryptomarketanalysis.com',
          role: 'administrator',
          emailVerified: true,
        }),
      ),
      markEmailVerified: jest.fn(),
    };
    const tokens = {
      create: jest.fn(),
      findByToken: jest.fn(),
      deleteByToken: jest.fn(),
    };
    const service = new AuthService(users, tokens);

    const response = await service.register({
      ...baseRequest,
      email: 'admin@cryptomarketanalysis.com',
      password: 'AdminPass123!',
      confirmPassword: 'AdminPass123!',
      fullName: 'Admin User',
    });

    expect(response).toEqual({
      message: 'Development administrator account is ready. You can log in now.',
    });
    expect(users.create).not.toHaveBeenCalled();
    expect(users.updateDevelopmentAdminCredentials).toHaveBeenCalledWith(
      'admin@cryptomarketanalysis.com',
      expect.objectContaining({
        fullName: 'Admin User',
        languagePreference: 'en',
        passwordHash: expect.any(String),
      }),
    );
    expect(tokens.create).not.toHaveBeenCalled();
  });

  it('does not repair the development admin email in production', async () => {
    process.env.NODE_ENV = 'production';
    const users = {
      findByEmail: jest.fn().mockResolvedValue(
        createUser({
          email: 'admin@cryptomarketanalysis.com',
        }),
      ),
      create: jest.fn(),
      updateDevelopmentAdminCredentials: jest.fn(),
      markEmailVerified: jest.fn(),
    };
    const service = new AuthService(
      users,
      { create: jest.fn(), findByToken: jest.fn(), deleteByToken: jest.fn() },
    );

    await expect(
      service.register({
        ...baseRequest,
        email: 'admin@cryptomarketanalysis.com',
      }),
    ).rejects.toMatchObject({
      statusCode: 400,
      message: 'Email already registered',
    });
    expect(users.updateDevelopmentAdminCredentials).not.toHaveBeenCalled();
  });

  it('uses a development admin fallback when the database is unavailable', async () => {
    const databaseError = new Error(
      'getaddrinfo ENOTFOUND db.ughyikvmlmassbxhhnin.supabase.co',
    );
    const users = {
      findByEmail: jest.fn().mockRejectedValue(databaseError),
      create: jest.fn(),
      updateDevelopmentAdminCredentials: jest.fn(),
      markEmailVerified: jest.fn(),
    };
    const service = new AuthService(
      users,
      { create: jest.fn(), findByToken: jest.fn(), deleteByToken: jest.fn() },
    );
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);

    await expect(
      service.register({
        ...baseRequest,
        email: 'admin@cryptomarketanalysis.com',
        password: 'AdminPass123!',
        confirmPassword: 'AdminPass123!',
      }),
    ).resolves.toEqual({
      message: 'Development administrator account is ready. You can log in now.',
    });

    const loginResponse = await service.login({
      email: 'admin@cryptomarketanalysis.com',
      password: 'AdminPass123!',
    });

    expect(loginResponse.user).toMatchObject({
      id: 'development-admin-user',
      email: 'admin@cryptomarketanalysis.com',
      role: 'administrator',
    });
  });

  it('rejects the development admin fallback with the wrong password', async () => {
    const users = {
      findByEmail: jest
        .fn()
        .mockRejectedValue(new Error('getaddrinfo ENOTFOUND db.example.supabase.co')),
      create: jest.fn(),
      markEmailVerified: jest.fn(),
    };
    const service = new AuthService(
      users,
      { create: jest.fn(), findByToken: jest.fn(), deleteByToken: jest.fn() },
    );
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);

    await expect(
      service.login({
        email: 'admin@cryptomarketanalysis.com',
        password: 'WrongPass123!',
      }),
    ).rejects.toMatchObject({
      statusCode: 401,
      message: 'Invalid email or password',
    });
  });

  it('rejects duplicate email', async () => {
    const service = new AuthService(
      {
        findByEmail: jest.fn().mockResolvedValue(createUser()),
        create: jest.fn(),
        markEmailVerified: jest.fn(),
      },
      { create: jest.fn(), findByToken: jest.fn(), deleteByToken: jest.fn() },
    );

    await expect(service.register(baseRequest)).rejects.toMatchObject({
      statusCode: 400,
      message: 'Email already registered',
    });
  });

  it.each<
    [
      string,
      Partial<RegisterRequest> | { languagePreference: string },
      string | typeof RegistrationError,
    ]
  >([
    ['invalid email', { email: 'bad-email' }, 'Invalid email address'],
    ['weak password', { password: 'pass', confirmPassword: 'pass' }, RegistrationError],
    ['password mismatch', { confirmPassword: 'Different123!' }, 'Passwords do not match'],
    ['unsupported language', { languagePreference: 'de' }, 'Unsupported language preference'],
  ])('rejects %s', async (_name, overrides, expected) => {
    const service = new AuthService(
      {
        findByEmail: jest.fn(),
        create: jest.fn(),
        markEmailVerified: jest.fn(),
      },
      { create: jest.fn(), findByToken: jest.fn(), deleteByToken: jest.fn() },
    );

    const promise = service.register({ ...baseRequest, ...overrides } as RegisterRequest);

    if (expected === RegistrationError) {
      await expect(promise).rejects.toMatchObject({
        statusCode: 400,
        message:
          'Password must be at least 8 characters with 1 uppercase, 1 number, and 1 special character',
      });
      return;
    }

    await expect(promise).rejects.toMatchObject({
      statusCode: 400,
      message: expected,
    });
  });

  it('verifies a valid email verification token', async () => {
    const users = {
      findByEmail: jest.fn(),
      create: jest.fn(),
      markEmailVerified: jest.fn().mockResolvedValue(undefined),
    };
    const tokens = {
      create: jest.fn(),
      findByToken: jest.fn().mockResolvedValue({
        userId: 'user-id',
        expiresAt: new Date(Date.now() + 60_000),
      }),
      deleteByToken: jest.fn().mockResolvedValue(undefined),
    };
    const service = new AuthService(users, tokens);

    await service.verifyEmail('valid-token');

    expect(tokens.findByToken).toHaveBeenCalledWith('valid-token');
    expect(users.markEmailVerified).toHaveBeenCalledWith('user-id');
    expect(tokens.deleteByToken).toHaveBeenCalledWith('valid-token');
  });

  it('rejects expired verification tokens without deleting them', async () => {
    const users = {
      findByEmail: jest.fn(),
      create: jest.fn(),
      markEmailVerified: jest.fn(),
    };
    const tokens = {
      create: jest.fn(),
      findByToken: jest.fn().mockResolvedValue({
        userId: 'user-id',
        expiresAt: new Date(Date.now() - 60_000),
      }),
      deleteByToken: jest.fn(),
    };
    const service = new AuthService(users, tokens);

    await expect(service.verifyEmail('expired-token')).rejects.toMatchObject({
      statusCode: 400,
      message: 'Verification link has expired',
    });
    expect(users.markEmailVerified).not.toHaveBeenCalled();
    expect(tokens.deleteByToken).not.toHaveBeenCalled();
  });

  it('rejects invalid verification tokens', async () => {
    const service = new AuthService(
      {
        findByEmail: jest.fn(),
        create: jest.fn(),
        markEmailVerified: jest.fn(),
      },
      {
        create: jest.fn(),
        findByToken: jest.fn().mockResolvedValue(undefined),
        deleteByToken: jest.fn(),
      },
    );

    await expect(service.verifyEmail('missing-token')).rejects.toMatchObject({
      statusCode: 404,
      message: 'Invalid verification link',
    });
  });

  it('logs in a verified user with a valid password', async () => {
    const passwordHash = await bcrypt.hash('SecurePass123!', 12);
    const service = new AuthService(
      {
        findByEmail: jest.fn().mockResolvedValue(
          createUser({
            passwordHash,
            emailVerified: true,
            fullName: 'Satoshi Analyst',
          }),
        ),
        create: jest.fn(),
        markEmailVerified: jest.fn(),
      },
      {
        create: jest.fn(),
        findByToken: jest.fn(),
        deleteByToken: jest.fn(),
      },
    );

    const response = await service.login({
      email: 'USER@example.com',
      password: 'SecurePass123!',
    });
    const decoded = jwt.verify(response.accessToken, 'test-jwt-secret') as {
      userId: string;
      email: string;
      role: string;
      languagePreference: string;
    };

    expect(decoded).toMatchObject({
      userId: 'user-id',
      email: 'user@example.com',
      role: 'free_user',
      languagePreference: 'en',
    });
    expect(response.user).toEqual({
      id: 'user-id',
      email: 'user@example.com',
      fullName: 'Satoshi Analyst',
      role: 'free_user',
      languagePreference: 'en',
    });
  });

  it('rejects unverified users', async () => {
    const passwordHash = await bcrypt.hash('SecurePass123!', 12);
    const service = new AuthService(
      {
        findByEmail: jest.fn().mockResolvedValue(createUser({ passwordHash })),
        create: jest.fn(),
        markEmailVerified: jest.fn(),
      },
      {
        create: jest.fn(),
        findByToken: jest.fn(),
        deleteByToken: jest.fn(),
      },
    );

    await expect(
      service.login({ email: 'user@example.com', password: 'SecurePass123!' }),
    ).rejects.toMatchObject({
      statusCode: 403,
      message: 'Please verify your email address before logging in',
    });
  });

  it('rejects missing users with a generic error', async () => {
    const service = new AuthService(
      {
        findByEmail: jest.fn().mockResolvedValue(undefined),
        create: jest.fn(),
        markEmailVerified: jest.fn(),
      },
      {
        create: jest.fn(),
        findByToken: jest.fn(),
        deleteByToken: jest.fn(),
      },
    );
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);

    await expect(
      service.login({ email: 'user@example.com', password: 'WrongPass123!' }),
    ).rejects.toMatchObject({
      statusCode: 401,
      message: 'Invalid email or password',
    });
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('auth.login_failed'));

    warnSpy.mockRestore();
  });

  it('rejects bad passwords with a generic error', async () => {
    const passwordHash = await bcrypt.hash('SecurePass123!', 12);
    const service = new AuthService(
      {
        findByEmail: jest
          .fn()
          .mockResolvedValue(createUser({ passwordHash, emailVerified: true })),
        create: jest.fn(),
        markEmailVerified: jest.fn(),
      },
      {
        create: jest.fn(),
        findByToken: jest.fn(),
        deleteByToken: jest.fn(),
      },
    );
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);

    await expect(
      service.login({ email: 'user@example.com', password: 'WrongPass123!' }),
    ).rejects.toMatchObject({
      statusCode: 401,
      message: 'Invalid email or password',
    });
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('auth.login_failed'));

    warnSpy.mockRestore();
  });

  it('creates a Google authorization URL with required parameters', () => {
    const service = new AuthService(
      {
        findByEmail: jest.fn(),
        create: jest.fn(),
        markEmailVerified: jest.fn(),
      },
      {
        create: jest.fn(),
        findByToken: jest.fn(),
        deleteByToken: jest.fn(),
      },
    );

    const url = new URL(service.createGoogleAuthorizationUrl('state-value'));

    expect(url.origin).toBe('https://accounts.google.com');
    expect(url.searchParams.get('client_id')).toBe('google-client-id');
    expect(url.searchParams.get('redirect_uri')).toBe(
      'http://localhost:3000/api/auth/google/callback',
    );
    expect(url.searchParams.get('scope')).toBe('openid email profile');
    expect(url.searchParams.get('state')).toBe('state-value');
  });

  it('creates and logs in a new Google user', async () => {
    const users = {
      findByEmail: jest.fn().mockResolvedValue(undefined),
      create: jest.fn().mockResolvedValue({ id: 'google-user-id' }),
      markEmailVerified: jest.fn(),
    };
    const service = new AuthService(users, {
      create: jest.fn(),
      findByToken: jest.fn(),
      deleteByToken: jest.fn(),
    });
    jest
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ access_token: 'google-access-token' }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 'google-profile-id',
          email: 'GoogleUser@example.com',
          name: 'Google User',
        }),
      } as Response);

    const response = await service.loginWithGoogleCode('auth-code');

    expect(users.create).toHaveBeenCalledWith({
      email: 'googleuser@example.com',
      fullName: 'Google User',
      languagePreference: 'en',
      role: 'free_user',
      emailVerified: true,
      oauthProvider: 'google',
      oauthProviderId: 'google-profile-id',
    });
    expect(response.user).toEqual({
      id: 'google-user-id',
      email: 'googleuser@example.com',
      fullName: 'Google User',
      role: 'free_user',
      languagePreference: 'en',
    });
  });

  it('logs in an existing Google user', async () => {
    const service = new AuthService(
      {
        findByEmail: jest.fn().mockResolvedValue(
          createUser({
            emailVerified: true,
            oauthProvider: 'google',
            oauthProviderId: 'google-profile-id',
          }),
        ),
        create: jest.fn(),
        markEmailVerified: jest.fn(),
      },
      {
        create: jest.fn(),
        findByToken: jest.fn(),
        deleteByToken: jest.fn(),
      },
    );
    jest
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ access_token: 'google-access-token' }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 'google-profile-id',
          email: 'user@example.com',
          name: 'Google User',
        }),
      } as Response);

    const response = await service.loginWithGoogleCode('auth-code');

    expect(response.user.email).toBe('user@example.com');
  });

  it('rejects Google login when the email belongs to a password account', async () => {
    const service = new AuthService(
      {
        findByEmail: jest.fn().mockResolvedValue(createUser({ emailVerified: true })),
        create: jest.fn(),
        markEmailVerified: jest.fn(),
      },
      {
        create: jest.fn(),
        findByToken: jest.fn(),
        deleteByToken: jest.fn(),
      },
    );
    jest
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ access_token: 'google-access-token' }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 'google-profile-id',
          email: 'user@example.com',
        }),
      } as Response);

    await expect(service.loginWithGoogleCode('auth-code')).rejects.toMatchObject({
      statusCode: 409,
      message: 'An account with this email already exists. Account linking is required.',
    });
  });

  it('creates a password reset token for password users without exposing account existence', async () => {
    const users = {
      findByEmail: jest
        .fn()
        .mockResolvedValue(createUser({ passwordHash: 'existing-password-hash' })),
      create: jest.fn(),
      markEmailVerified: jest.fn(),
    };
    const passwordResetTokens = {
      create: jest.fn().mockResolvedValue(undefined),
      findByToken: jest.fn(),
      deleteByToken: jest.fn(),
    };
    const passwordResetEmails = {
      sendPasswordResetEmail: jest.fn().mockResolvedValue(undefined),
    };
    const service = new AuthService(
      users,
      { create: jest.fn(), findByToken: jest.fn(), deleteByToken: jest.fn() },
      passwordResetTokens,
      { invalidateUserTokens: jest.fn() },
      passwordResetEmails,
    );

    const response = await service.requestPasswordReset({ email: 'USER@example.com' });

    expect(response).toEqual({
      message: "If that email exists, we've sent password reset instructions",
    });
    expect(users.findByEmail).toHaveBeenCalledWith('user@example.com');
    expect(passwordResetTokens.create).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-id',
        token: expect.any(String),
        expiresAt: expect.any(Date),
      }),
    );
    expect(passwordResetEmails.sendPasswordResetEmail).toHaveBeenCalledWith({
      email: 'user@example.com',
      resetUrl: expect.stringContaining('/reset-password?token='),
    });
  });

  it('returns the same password reset response for unknown emails', async () => {
    const passwordResetTokens = {
      create: jest.fn(),
      findByToken: jest.fn(),
      deleteByToken: jest.fn(),
    };
    const service = new AuthService(
      {
        findByEmail: jest.fn().mockResolvedValue(undefined),
        create: jest.fn(),
        markEmailVerified: jest.fn(),
      },
      { create: jest.fn(), findByToken: jest.fn(), deleteByToken: jest.fn() },
      passwordResetTokens,
      { invalidateUserTokens: jest.fn() },
    );

    await expect(service.requestPasswordReset({ email: 'missing@example.com' })).resolves.toEqual({
      message: "If that email exists, we've sent password reset instructions",
    });
    expect(passwordResetTokens.create).not.toHaveBeenCalled();
  });

  it('validates active password reset tokens', async () => {
    const service = new AuthService(
      {
        findByEmail: jest.fn(),
        create: jest.fn(),
        markEmailVerified: jest.fn(),
      },
      { create: jest.fn(), findByToken: jest.fn(), deleteByToken: jest.fn() },
      {
        create: jest.fn(),
        findByToken: jest.fn().mockResolvedValue({
          userId: 'user-id',
          expiresAt: new Date(Date.now() + 60_000),
        }),
        deleteByToken: jest.fn(),
      },
      { invalidateUserTokens: jest.fn() },
    );

    await expect(service.validatePasswordResetToken('reset-token')).resolves.toEqual({
      valid: true,
    });
  });

  it('resets password, consumes the token, and records token invalidation', async () => {
    const users = {
      findByEmail: jest.fn(),
      create: jest.fn(),
      markEmailVerified: jest.fn(),
      updatePasswordHash: jest.fn().mockResolvedValue(undefined),
    };
    const passwordResetTokens = {
      create: jest.fn(),
      findByToken: jest.fn().mockResolvedValue({
        userId: 'user-id',
        expiresAt: new Date(Date.now() + 60_000),
      }),
      deleteByToken: jest.fn().mockResolvedValue(undefined),
    };
    const tokenInvalidations = {
      invalidateUserTokens: jest.fn().mockResolvedValue(undefined),
    };
    const service = new AuthService(
      users,
      { create: jest.fn(), findByToken: jest.fn(), deleteByToken: jest.fn() },
      passwordResetTokens,
      tokenInvalidations,
    );

    const response = await service.resetPassword({
      token: 'reset-token',
      password: 'NewSecurePass456!',
      confirmPassword: 'NewSecurePass456!',
    });

    expect(response).toEqual({
      message: 'Password reset successful. Please log in with your new password.',
    });
    const passwordHash = users.updatePasswordHash.mock.calls[0][1] as string;
    await expect(bcrypt.compare('NewSecurePass456!', passwordHash)).resolves.toBe(true);
    expect(passwordResetTokens.deleteByToken).toHaveBeenCalledWith('reset-token');
    expect(tokenInvalidations.invalidateUserTokens).toHaveBeenCalledWith('user-id');
  });

  it('rejects expired password reset tokens', async () => {
    const users = {
      findByEmail: jest.fn(),
      create: jest.fn(),
      markEmailVerified: jest.fn(),
      updatePasswordHash: jest.fn(),
    };
    const service = new AuthService(
      users,
      { create: jest.fn(), findByToken: jest.fn(), deleteByToken: jest.fn() },
      {
        create: jest.fn(),
        findByToken: jest.fn().mockResolvedValue({
          userId: 'user-id',
          expiresAt: new Date(Date.now() - 60_000),
        }),
        deleteByToken: jest.fn(),
      },
      { invalidateUserTokens: jest.fn() },
    );

    await expect(
      service.resetPassword({
        token: 'expired-token',
        password: 'NewSecurePass456!',
        confirmPassword: 'NewSecurePass456!',
      }),
    ).rejects.toMatchObject({
      statusCode: 400,
      message: 'Reset link is invalid or expired',
    });
    expect(users.updatePasswordHash).not.toHaveBeenCalled();
  });
});
