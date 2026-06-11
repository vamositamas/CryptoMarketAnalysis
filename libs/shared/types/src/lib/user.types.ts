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
  emailVerified?: boolean;
  oauthProvider?: string;
  oauthProviderId?: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  confirmPassword: string;
  languagePreference: LanguagePreference;
  fullName?: string;
}

export interface RegisterResponse {
  message: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface AuthenticatedUser {
  id: string;
  email: string;
  fullName?: string;
  role: UserRole;
  languagePreference: LanguagePreference;
}

export interface LoginResponse {
  accessToken: string;
  user: AuthenticatedUser;
}

export interface RequestPasswordResetRequest {
  email: string;
}

export interface RequestPasswordResetResponse {
  message: string;
}

export interface ValidatePasswordResetTokenResponse {
  valid: boolean;
}

export interface ResetPasswordRequest {
  token: string;
  password: string;
  confirmPassword: string;
}

export interface ResetPasswordResponse {
  message: string;
}

export interface UserProfileResponse {
  id: string;
  email: string;
  fullName?: string;
  languagePreference: LanguagePreference;
  role: UserRole;
  emailVerified: boolean;
  onboardingCompleted: boolean;
  createdAt: string;
}

export interface UpdateUserProfileRequest {
  fullName?: string;
  languagePreference?: LanguagePreference;
}

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}

export interface ChangePasswordResponse {
  message: string;
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
