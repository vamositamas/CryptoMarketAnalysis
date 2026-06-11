import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, Router, RouterStateSnapshot } from '@angular/router';
import { roleGuard } from './role.guard';
import { AuthSessionService } from '../services/auth-session.service';

describe('roleGuard', () => {
  beforeEach(() => {
    sessionStorage.clear();
    TestBed.configureTestingModule({
      providers: [AuthSessionService],
    });
  });

  it('allows navigation when the current user has an accepted role', () => {
    TestBed.inject(AuthSessionService).setCurrentUser({
      id: 'admin-id',
      email: 'admin@example.com',
      role: 'administrator',
      languagePreference: 'en',
    });

    const result = TestBed.runInInjectionContext(() =>
      roleGuard(
        { data: { roles: ['administrator'] } } as unknown as ActivatedRouteSnapshot,
        {} as RouterStateSnapshot,
      ),
    );

    expect(result).toBe(true);
  });

  it('redirects when the current user lacks the required role', () => {
    const router = TestBed.inject(Router);
    const createUrlTreeSpy = jest.spyOn(router, 'createUrlTree');
    TestBed.inject(AuthSessionService).setCurrentUser({
      id: 'user-id',
      email: 'user@example.com',
      role: 'free_user',
      languagePreference: 'en',
    });

    TestBed.runInInjectionContext(() =>
      roleGuard(
        { data: { roles: ['administrator'] } } as unknown as ActivatedRouteSnapshot,
        {} as RouterStateSnapshot,
      ),
    );

    expect(createUrlTreeSpy).toHaveBeenCalledWith(['/dashboard'], {
      queryParams: { error: "You don't have permission to access this page" },
    });
  });
});
