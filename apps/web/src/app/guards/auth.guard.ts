import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthApiClient } from '@crypto-market-analysis/data-access/api-client';
import { AuthSessionService } from '../services/auth-session.service';

export const authGuard: CanActivateFn = async (_route, state) => {
  const auth = inject(AuthApiClient);
  const authSession = inject(AuthSessionService);
  const router = inject(Router);

  try {
    const profile = await auth.getCurrentUserProfile();
    authSession.setCurrentUser(profile);

    return true;
  } catch {
    return router.createUrlTree(['/login'], {
      queryParams: { returnUrl: state.url },
    });
  }
};
