import { Router } from 'express';
import type { NextFunction, Response } from 'express';
import { requireAuth } from '../middleware/rbac.middleware';
import type { AuthenticatedRequest, TokenInvalidationReader } from '../middleware/rbac.middleware';
import {
  UserProfileError,
  UserProfileService,
} from '../services/user-profile.service';
import type {
  ChangePasswordRequest,
  ChangePasswordResponse,
  UpdateUserProfileRequest,
  UserProfileResponse,
} from '@crypto-market-analysis/shared/types';

export interface UserProfileManager {
  getProfile(userId: string): Promise<UserProfileResponse>;
  updateProfile(
    userId: string,
    request: UpdateUserProfileRequest,
  ): Promise<UserProfileResponse>;
  changePassword(
    userId: string,
    request: ChangePasswordRequest,
  ): Promise<ChangePasswordResponse>;
}

export function createUsersRouter(
  userProfileService: UserProfileManager = new UserProfileService(),
  tokenInvalidations?: TokenInvalidationReader,
): Router {
  const router = Router();

  router.get('/me', requireAuth(tokenInvalidations), async (req, res, next) => {
    try {
      const response = await userProfileService.getProfile(
        (req as AuthenticatedRequest).user?.userId ?? '',
      );
      res.status(200).json(response);
    } catch (error) {
      handleUserProfileError(error, res, next);
    }
  });

  router.patch('/me', requireAuth(tokenInvalidations), async (req, res, next) => {
    try {
      const response = await userProfileService.updateProfile(
        (req as AuthenticatedRequest).user?.userId ?? '',
        req.body,
      );
      res.status(200).json(response);
    } catch (error) {
      handleUserProfileError(error, res, next);
    }
  });

  router.post(
    '/me/change-password',
    requireAuth(tokenInvalidations),
    async (req, res, next) => {
      try {
        const response = await userProfileService.changePassword(
          (req as AuthenticatedRequest).user?.userId ?? '',
          req.body,
        );
        res.status(200).json(response);
      } catch (error) {
        handleUserProfileError(error, res, next);
      }
    },
  );

  return router;
}

function handleUserProfileError(
  error: unknown,
  res: Response,
  next: NextFunction,
): void {
  if (error instanceof UserProfileError) {
    res.status(error.statusCode).json({ error: error.message });
    return;
  }

  next(error);
}
