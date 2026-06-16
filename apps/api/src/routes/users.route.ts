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
import {
  ChartAnnotationError,
  ChartAnnotationService,
  type CreateChartAnnotationRequest,
} from '../services/chart-annotation.service';
import type { ChartAnnotationRecord } from '../repositories/chart-annotation.repository';

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
  completeOnboarding(userId: string): Promise<UserProfileResponse>;
}

export interface ChartAnnotationManager {
  list(userId: string, chartId: unknown): Promise<ChartAnnotationRecord[]>;
  create(userId: string, request: CreateChartAnnotationRequest): Promise<ChartAnnotationRecord>;
  delete(userId: string, annotationId: string): Promise<void>;
}

export function createUsersRouter(
  userProfileService: UserProfileManager = new UserProfileService(),
  tokenInvalidations?: TokenInvalidationReader,
  chartAnnotationService: ChartAnnotationManager = new ChartAnnotationService(),
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

  router.post(
    '/me/complete-onboarding',
    requireAuth(tokenInvalidations),
    async (req, res, next) => {
      try {
        const response = await userProfileService.completeOnboarding(
          (req as AuthenticatedRequest).user?.userId ?? '',
        );
        res.status(200).json(response);
      } catch (error) {
        handleUserProfileError(error, res, next);
      }
    },
  );

  router.get('/me/annotations', requireAuth(tokenInvalidations), async (req, res, next) => {
    try {
      const response = await chartAnnotationService.list(
        (req as AuthenticatedRequest).user?.userId ?? '',
        req.query['chartId'],
      );
      res.status(200).json(response);
    } catch (error) {
      handleChartAnnotationError(error, res, next);
    }
  });

  router.post('/me/annotations', requireAuth(tokenInvalidations), async (req, res, next) => {
    try {
      const response = await chartAnnotationService.create(
        (req as AuthenticatedRequest).user?.userId ?? '',
        req.body,
      );
      res.status(201).json(response);
    } catch (error) {
      handleChartAnnotationError(error, res, next);
    }
  });

  router.delete(
    '/me/annotations/:annotationId',
    requireAuth(tokenInvalidations),
    async (req, res, next) => {
      try {
        await chartAnnotationService.delete(
          (req as AuthenticatedRequest).user?.userId ?? '',
          req.params['annotationId'],
        );
        res.status(204).send();
      } catch (error) {
        handleChartAnnotationError(error, res, next);
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

function handleChartAnnotationError(
  error: unknown,
  res: Response,
  next: NextFunction,
): void {
  if (error instanceof ChartAnnotationError) {
    res.status(error.statusCode).json({ error: error.message });
    return;
  }

  next(error);
}
