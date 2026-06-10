import {
  LANGUAGE_PREFERENCES,
  USER_ROLES,
  type LanguagePreference,
  type User,
  type UserRole,
} from './user.types';

describe('user types', () => {
  it('defines supported user roles and languages', () => {
    const role: UserRole = 'free_user';
    const language: LanguagePreference = 'en';

    expect(USER_ROLES).toContain(role);
    expect(LANGUAGE_PREFERENCES).toContain(language);
  });

  it('models users with camelCase application fields', () => {
    const user: User = {
      id: 'user-id',
      email: 'analyst@example.com',
      languagePreference: 'en',
      role: 'free_user',
      emailVerified: false,
      onboardingCompleted: false,
      createdAt: new Date('2026-06-10T00:00:00.000Z'),
      updatedAt: new Date('2026-06-10T00:00:00.000Z'),
    };

    expect(user.languagePreference).toBe('en');
    expect(user.emailVerified).toBe(false);
  });
});
