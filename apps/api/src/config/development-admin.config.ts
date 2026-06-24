import type { User } from '@crypto-market-analysis/shared/types';

export const DEVELOPMENT_ADMIN_USER_ID = 'development-admin-user';

export function isDevelopmentAdminEnabled(): boolean {
  return process.env.NODE_ENV !== 'production';
}

export function isDevelopmentAdminEmail(email: string): boolean {
  return isDevelopmentAdminEnabled() && normalizeEmail(email) === getDevelopmentAdminEmail();
}

export function getDevelopmentAdminEmail(): string {
  return normalizeEmail(process.env.DEV_ADMIN_EMAIL ?? 'admin@bitwlab.com');
}

export function getDevelopmentAdminPassword(): string {
  return process.env.DEV_ADMIN_PASSWORD ?? 'AdminPass123!';
}

export function createDevelopmentAdminUser(overrides: Partial<User> = {}): User {
  const now = new Date();

  return {
    id: DEVELOPMENT_ADMIN_USER_ID,
    email: getDevelopmentAdminEmail(),
    fullName: 'Admin User',
    languagePreference: 'en',
    role: 'administrator',
    emailVerified: true,
    onboardingCompleted: true,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

export function isDevelopmentAdminUserId(userId: string): boolean {
  return isDevelopmentAdminEnabled() && userId === DEVELOPMENT_ADMIN_USER_ID;
}

export function isDatabaseUnavailableError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  const code = typeof error === 'object' && error !== null && 'code' in error
    ? String((error as { code?: unknown }).code)
    : '';

  return ['ENOTFOUND', 'ECONNREFUSED', 'ETIMEDOUT', 'EAI_AGAIN'].some(
    (networkCode) => code === networkCode || message.includes(networkCode),
  );
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}
