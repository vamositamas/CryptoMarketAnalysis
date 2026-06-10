export const USER_ROLES = ['administrator', 'premium_user', 'free_user'] as const;
export const LANGUAGE_PREFERENCES = ['en', 'hu'] as const;

export type UserRole = (typeof USER_ROLES)[number];
export type LanguagePreference = (typeof LANGUAGE_PREFERENCES)[number];

export interface User {
  id: string;
  email: string;
  passwordHash?: string;
  fullName?: string;
  languagePreference: LanguagePreference;
  role: UserRole;
  emailVerified: boolean;
  oauthProvider?: string;
  oauthProviderId?: string;
  onboardingCompleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateUserInput {
  email: string;
  passwordHash?: string;
  fullName?: string;
  languagePreference?: LanguagePreference;
  role?: UserRole;
  oauthProvider?: string;
  oauthProviderId?: string;
}

export interface UserRow {
  id: string;
  email: string;
  password_hash?: string;
  full_name?: string;
  language_preference: LanguagePreference;
  role: UserRole;
  email_verified: boolean;
  oauth_provider?: string;
  oauth_provider_id?: string;
  onboarding_completed: boolean;
  created_at: string;
  updated_at: string;
}
