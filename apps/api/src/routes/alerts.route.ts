import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/rbac.middleware';
import type { AuthenticatedRequest, TokenInvalidationReader } from '../middleware/rbac.middleware';
import { AlertsError, AlertsService } from '../services/alerts.service';
import type { AlertRecord } from '../repositories/alerts.repository';

export interface AlertsManager {
  createAlert(userId: string, userRole: string, body: unknown): Promise<AlertRecord>;
}

interface AlertsRouterOptions {
  alertsService?: AlertsManager;
}

export function createAlertsRouter(
  tokenInvalidationsOrOptions?: TokenInvalidationReader | AlertsRouterOptions,
  _tokenInvalidations?: TokenInvalidationReader,
): Router {
  const router = Router();

  let alertsService: AlertsManager | undefined;
  let tokenInvalidations: TokenInvalidationReader | undefined;

  if (
    tokenInvalidationsOrOptions &&
    'findLatestInvalidationForUser' in tokenInvalidationsOrOptions
  ) {
    tokenInvalidations = tokenInvalidationsOrOptions as TokenInvalidationReader;
  } else if (tokenInvalidationsOrOptions) {
    const options = tokenInvalidationsOrOptions as AlertsRouterOptions;
    alertsService = options.alertsService;
    tokenInvalidations = _tokenInvalidations;
  }

  router.post(
    '/',
    requireAuth(tokenInvalidations),
    requireRole(['free_user', 'premium_user', 'administrator']),
    async (req, res, next) => {
      try {
        const authedReq = req as AuthenticatedRequest;
        const userId = authedReq.user?.userId ?? '';
        const userRole = authedReq.user?.role ?? 'free_user';
        const service = alertsService ?? new AlertsService();
        const alert = await service.createAlert(userId, userRole, req.body);
        res.status(201).json(alert);
      } catch (error) {
        if (error instanceof AlertsError) {
          res.status(error.statusCode).json({ error: error.message });
          return;
        }
        next(error);
      }
    },
  );

  return router;
}
