import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import {
  AuthSessionService,
  type SessionUserRole,
} from '../services/auth-session.service';

export const roleGuard: CanActivateFn = (route) => {
  const authSession = inject(AuthSessionService);
  const router = inject(Router);
  const allowedRoles = (route.data['roles'] ?? []) as SessionUserRole[];

  if (authSession.hasRole(allowedRoles)) {
    return true;
  }

  return router.createUrlTree(['/dashboard'], {
    queryParams: { error: "You don't have permission to access this page" },
  });
};
