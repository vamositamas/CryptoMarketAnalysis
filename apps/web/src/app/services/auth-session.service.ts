import { Injectable, signal } from '@angular/core';

export type SessionUserRole = 'administrator' | 'premium_user' | 'free_user';

export interface SessionUser {
  id: string;
  email: string;
  fullName?: string;
  role: SessionUserRole;
  languagePreference: 'en' | 'hu';
  onboardingCompleted?: boolean;
}

const STORAGE_KEY = 'cryptoMarketAnalysis.authUser';

@Injectable({ providedIn: 'root' })
export class AuthSessionService {
  private readonly currentUserSignal = signal<SessionUser | null>(readStoredUser());
  readonly currentUser = this.currentUserSignal.asReadonly();

  setCurrentUser(user: SessionUser): void {
    this.currentUserSignal.set(user);
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(user));
  }

  clearCurrentUser(): void {
    this.currentUserSignal.set(null);
    sessionStorage.removeItem(STORAGE_KEY);
  }

  hasRole(allowedRoles: SessionUserRole[]): boolean {
    const user = this.currentUserSignal();

    return Boolean(user && allowedRoles.includes(user.role));
  }
}

function readStoredUser(): SessionUser | null {
  const rawUser = sessionStorage.getItem(STORAGE_KEY);
  if (!rawUser) {
    return null;
  }

  try {
    return JSON.parse(rawUser) as SessionUser;
  } catch {
    sessionStorage.removeItem(STORAGE_KEY);
    return null;
  }
}
