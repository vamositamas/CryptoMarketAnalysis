import { randomBytes } from 'crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import {
  type AuthenticatedUser,
  type LoginRequest,
  type LoginResponse,
  type RequestPasswordResetRequest,
  type RequestPasswordResetResponse,
  type ResetPasswordRequest,
  type ResetPasswordResponse,
  type RegisterRequest,
  type RegisterResponse,
  type UserRole,
  type LanguagePreference,
  type ValidatePasswordResetTokenResponse,
} from '@crypto-market-analysis/shared/types';
import { EmailVerificationTokenRepository } from '../repositories/email-verification-token.repository';
import { PasswordResetTokenRepository } from '../repositories/password-reset-token.repository';
import { TokenBlacklistRepository } from '../repositories/token-blacklist.repository';
import { UserRepository } from '../repositories/user.repository';
import { ResendEmailService, type PasswordResetEmailSender } from './email.service';

const PASSWORD_STRENGTH_ERROR =
  'Password must be at least 8 characters with 1 uppercase, 1 number, and 1 special character';

export class RegistrationError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
  ) {
    super(message);
  }
}

export class VerificationError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
  ) {
    super(message);
  }
}

export class LoginError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
  ) {
    super(message);
  }
}

export class OAuthError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
  ) {
    super(message);
  }
}

export class PasswordResetError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
  ) {
    super(message);
  }
}

interface AuthUser {
  id: string;
  email: string;
  passwordHash?: string;
  fullName?: string;
  role: UserRole;
  languagePreference: LanguagePreference;
  emailVerified: boolean;
  oauthProvider?: string;
  oauthProviderId?: string;
}

interface UserStore {
  findByEmail(email: string): Promise<AuthUser | undefined>;
  create(input: {
    email: string;
    passwordHash?: string;
    fullName?: string;
    languagePreference: RegisterRequest['languagePreference'];
    role: 'free_user';
    emailVerified?: boolean;
    oauthProvider?: string;
    oauthProviderId?: string;
  }): Promise<{ id: string }>;
  markEmailVerified(userId: string): Promise<void>;
  updatePasswordHash?(userId: string, passwordHash: string): Promise<void>;
}

interface EmailVerificationTokenStore {
  create(input: { userId: string; token: string; expiresAt: Date }): Promise<void>;
  findByToken(token: string): Promise<{ userId: string; expiresAt: Date } | undefined>;
  deleteByToken(token: string): Promise<void>;
}

interface PasswordResetTokenStore {
  create(input: { userId: string; token: string; expiresAt: Date }): Promise<void>;
  findByToken(token: string): Promise<{ userId: string; expiresAt: Date } | undefined>;
  deleteByToken(token: string): Promise<void>;
}

interface TokenInvalidationStore {
  invalidateUserTokens(userId: string, invalidatedAt?: Date): Promise<void>;
}

export class AuthService {
  constructor(
    private readonly users: UserStore = new UserRepository(),
    private readonly emailVerificationTokens: EmailVerificationTokenStore = new EmailVerificationTokenRepository(),
    private readonly passwordResetTokens: PasswordResetTokenStore = new PasswordResetTokenRepository(),
    private readonly tokenInvalidations: TokenInvalidationStore = new TokenBlacklistRepository(),
    private readonly passwordResetEmails: PasswordResetEmailSender = new ResendEmailService(),
  ) {}

  async register(request: RegisterRequest): Promise<RegisterResponse> {
    const normalizedEmail = normalizeEmail(request.email);

    validateRegistrationRequest({ ...request, email: normalizedEmail });

    const existingUser = await this.users.findByEmail(normalizedEmail);
    if (existingUser) {
      throw new RegistrationError(400, 'Email already registered');
    }

    const passwordHash = await bcrypt.hash(request.password, 12);
    const user = await this.users.create({
      email: normalizedEmail,
      passwordHash,
      fullName: request.fullName,
      languagePreference: request.languagePreference,
      role: 'free_user',
    });

    await this.emailVerificationTokens.create({
      userId: user.id,
      token: createVerificationToken(),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    });

    return {
      message: 'Registration successful. Please check your email to verify your account.',
    };
  }

  async verifyEmail(token: string | undefined): Promise<void> {
    if (!token) {
      throw new VerificationError(404, 'Invalid verification link');
    }

    const verificationToken = await this.emailVerificationTokens.findByToken(token);
    if (!verificationToken) {
      throw new VerificationError(404, 'Invalid verification link');
    }

    if (verificationToken.expiresAt.getTime() <= Date.now()) {
      throw new VerificationError(400, 'Verification link has expired');
    }

    await this.users.markEmailVerified(verificationToken.userId);
    await this.emailVerificationTokens.deleteByToken(token);
  }

  async login(request: LoginRequest): Promise<LoginResponse> {
    const normalizedEmail = normalizeEmail(request.email);
    const user = await this.users.findByEmail(normalizedEmail);

    if (!user?.passwordHash) {
      logFailedLogin(normalizedEmail);
      throw new LoginError(401, 'Invalid email or password');
    }

    const passwordMatches = await bcrypt.compare(request.password, user.passwordHash);
    if (!passwordMatches) {
      logFailedLogin(normalizedEmail);
      throw new LoginError(401, 'Invalid email or password');
    }

    if (!user.emailVerified) {
      throw new LoginError(403, 'Please verify your email address before logging in');
    }

    return createLoginResponse(user);
  }

  async requestPasswordReset(
    request: RequestPasswordResetRequest,
  ): Promise<RequestPasswordResetResponse> {
    const normalizedEmail = normalizeEmail(request.email);
    const response = {
      message: "If that email exists, we've sent password reset instructions",
    };

    if (!isValidEmail(normalizedEmail)) {
      return response;
    }

    const user = await this.users.findByEmail(normalizedEmail);
    if (!user?.passwordHash) {
      return response;
    }

    const token = createVerificationToken();
    await this.passwordResetTokens.create({
      userId: user.id,
      token,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    });
    await this.passwordResetEmails.sendPasswordResetEmail({
      email: user.email,
      resetUrl: `${getFrontendUrl()}/reset-password?token=${token}`,
    });

    return response;
  }

  async validatePasswordResetToken(
    token: string | undefined,
  ): Promise<ValidatePasswordResetTokenResponse> {
    const resetToken = await this.findValidPasswordResetToken(token);

    return { valid: Boolean(resetToken) };
  }

  async resetPassword(request: ResetPasswordRequest): Promise<ResetPasswordResponse> {
    const resetToken = await this.findValidPasswordResetToken(request.token);
    if (!resetToken) {
      throw new PasswordResetError(400, 'Reset link is invalid or expired');
    }

    if (!isStrongPassword(request.password)) {
      throw new PasswordResetError(400, PASSWORD_STRENGTH_ERROR);
    }

    if (request.password !== request.confirmPassword) {
      throw new PasswordResetError(400, 'Passwords do not match');
    }

    const passwordHash = await bcrypt.hash(request.password, 12);
    if (!this.users.updatePasswordHash) {
      throw new Error('User store does not support password updates');
    }

    await this.users.updatePasswordHash(resetToken.userId, passwordHash);
    await this.passwordResetTokens.deleteByToken(request.token);
    await this.tokenInvalidations.invalidateUserTokens(resetToken.userId);

    return {
      message: 'Password reset successful. Please log in with your new password.',
    };
  }

  createGoogleAuthorizationUrl(state: string): string {
    const clientId = getRequiredEnv('GOOGLE_CLIENT_ID');
    const redirectUri = getGoogleRedirectUri();
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: 'openid email profile',
      state,
      access_type: 'offline',
      prompt: 'select_account',
    });

    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  }

  async loginWithGoogleCode(code: string | undefined): Promise<LoginResponse> {
    if (!code) {
      throw new OAuthError(400, 'Missing Google authorization code');
    }

    const accessToken = await exchangeGoogleCode(code);
    const profile = await fetchGoogleProfile(accessToken);
    const email = normalizeEmail(profile.email);
    const existingUser = await this.users.findByEmail(email);

    if (existingUser) {
      if (
        existingUser.oauthProvider === 'google' &&
        existingUser.oauthProviderId === profile.id
      ) {
        return createLoginResponse(existingUser);
      }

      throw new OAuthError(
        409,
        'An account with this email already exists. Account linking is required.',
      );
    }

    const user = await this.users.create({
      email,
      fullName: profile.name,
      languagePreference: 'en',
      role: 'free_user',
      emailVerified: true,
      oauthProvider: 'google',
      oauthProviderId: profile.id,
    });

    return createLoginResponse({
      id: user.id,
      email,
      fullName: profile.name,
      role: 'free_user',
      languagePreference: 'en',
      emailVerified: true,
      oauthProvider: 'google',
      oauthProviderId: profile.id,
    });
  }

  private async findValidPasswordResetToken(
    token: string | undefined,
  ): Promise<{ userId: string; expiresAt: Date } | undefined> {
    if (!token) {
      return undefined;
    }

    const resetToken = await this.passwordResetTokens.findByToken(token);
    if (!resetToken || resetToken.expiresAt.getTime() <= Date.now()) {
      return undefined;
    }

    return resetToken;
  }
}

function validateRegistrationRequest(request: RegisterRequest): void {
  if (!isValidEmail(request.email)) {
    throw new RegistrationError(400, 'Invalid email address');
  }

  if (!isStrongPassword(request.password)) {
    throw new RegistrationError(400, PASSWORD_STRENGTH_ERROR);
  }

  if (request.password !== request.confirmPassword) {
    throw new RegistrationError(400, 'Passwords do not match');
  }

  if (!['en', 'hu'].includes(request.languagePreference)) {
    throw new RegistrationError(400, 'Unsupported language preference');
  }
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isStrongPassword(password: string): boolean {
  return /^(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/.test(password);
}

function createVerificationToken(): string {
  return randomBytes(32).toString('base64url');
}

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;

  if (!secret && process.env.NODE_ENV === 'production') {
    throw new Error('JWT_SECRET is required in production');
  }

  return secret ?? 'local-development-jwt-secret';
}

function createLoginResponse(user: AuthUser): LoginResponse {
  const accessToken = jwt.sign(
    {
      userId: user.id,
      email: user.email,
      role: user.role,
      languagePreference: user.languagePreference,
    },
    getJwtSecret(),
    { expiresIn: '24h' },
  );
  const safeUser: AuthenticatedUser = {
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    role: user.role,
    languagePreference: user.languagePreference,
  };

  return { accessToken, user: safeUser };
}

function getRequiredEnv(name: string): string {
  const value = process.env[name];

  if (!value) {
    throw new OAuthError(500, `${name} is not configured`);
  }

  return value;
}

function getGoogleRedirectUri(): string {
  return process.env.GOOGLE_REDIRECT_URI ?? 'http://localhost:3000/api/auth/google/callback';
}

async function exchangeGoogleCode(code: string): Promise<string> {
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: getRequiredEnv('GOOGLE_CLIENT_ID'),
      client_secret: getRequiredEnv('GOOGLE_CLIENT_SECRET'),
      redirect_uri: getGoogleRedirectUri(),
      grant_type: 'authorization_code',
    }),
  });

  if (!response.ok) {
    throw new OAuthError(401, 'Google authorization failed');
  }

  const body = (await response.json()) as { access_token?: string };
  if (!body.access_token) {
    throw new OAuthError(401, 'Google authorization failed');
  }

  return body.access_token;
}

async function fetchGoogleProfile(accessToken: string): Promise<{
  id: string;
  email: string;
  name?: string;
}> {
  const response = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
    headers: {
      authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new OAuthError(401, 'Google profile fetch failed');
  }

  const body = (await response.json()) as {
    id?: string;
    email?: string;
    name?: string;
  };

  if (!body.id || !body.email) {
    throw new OAuthError(401, 'Google profile fetch failed');
  }

  return {
    id: body.id,
    email: body.email,
    name: body.name,
  };
}

function logFailedLogin(email: string): void {
  console.warn(
    JSON.stringify({
      event: 'auth.login_failed',
      email,
      timestamp: new Date().toISOString(),
    }),
  );
}

function getFrontendUrl(): string {
  return process.env.FRONTEND_URL ?? 'http://localhost:4200';
}
