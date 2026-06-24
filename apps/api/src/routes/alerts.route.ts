import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/rbac.middleware';
import type { AuthenticatedRequest, TokenInvalidationReader } from '../middleware/rbac.middleware';
import { AlertsError, AlertsService } from '../services/alerts.service';
import type { AlertRecord, } from '../repositories/alerts.repository';
import type { AlertWithTitle, AlertsListResponse } from '../services/alerts.service';

export interface AlertsManager {
  createAlert(userId: string, userRole: string, body: unknown): Promise<AlertRecord>;
  listAlerts(userId: string): Promise<AlertsListResponse>;
  updateAlert(userId: string, alertId: string, body: unknown): Promise<AlertWithTitle>;
  deleteAlert(userId: string, alertId: string): Promise<void>;
  resetAlert(userId: string, alertId: string): Promise<AlertWithTitle>;
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

  const auth = requireAuth(tokenInvalidations);
  const anyRole = requireRole(['free_user', 'premium_user', 'administrator']);

  function getService(): AlertsManager {
    return alertsService ?? new AlertsService();
  }

  function userFrom(req: AuthenticatedRequest) {
    return { userId: req.user?.userId ?? '', userRole: req.user?.role ?? 'free_user' };
  }

  router.get('/', auth, anyRole, async (req, res, next) => {
    try {
      const { userId } = userFrom(req as AuthenticatedRequest);
      const response = await getService().listAlerts(userId);
      res.status(200).json(response);
    } catch (error) {
      if (error instanceof AlertsError) {
        res.status(error.statusCode).json({ error: error.message });
        return;
      }
      next(error);
    }
  });

  router.post('/', auth, anyRole, async (req, res, next) => {
    try {
      const { userId, userRole } = userFrom(req as AuthenticatedRequest);
      const alert = await getService().createAlert(userId, userRole, req.body);
      res.status(201).json(alert);
    } catch (error) {
      if (error instanceof AlertsError) {
        res.status(error.statusCode).json({ error: error.message });
        return;
      }
      next(error);
    }
  });

  router.patch('/:alertId', auth, anyRole, async (req, res, next) => {
    try {
      const { userId } = userFrom(req as AuthenticatedRequest);
      const alert = await getService().updateAlert(userId, req.params.alertId, req.body);
      res.status(200).json(alert);
    } catch (error) {
      if (error instanceof AlertsError) {
        res.status(error.statusCode).json({ error: error.message });
        return;
      }
      next(error);
    }
  });

  router.delete('/:alertId', auth, anyRole, async (req, res, next) => {
    try {
      const { userId } = userFrom(req as AuthenticatedRequest);
      await getService().deleteAlert(userId, req.params.alertId);
      res.status(200).json({ success: true });
    } catch (error) {
      if (error instanceof AlertsError) {
        res.status(error.statusCode).json({ error: error.message });
        return;
      }
      next(error);
    }
  });

  router.patch('/:alertId/reset', auth, anyRole, async (req, res, next) => {
    try {
      const { userId } = userFrom(req as AuthenticatedRequest);
      const alert = await getService().resetAlert(userId, req.params.alertId);
      res.status(200).json(alert);
    } catch (error) {
      if (error instanceof AlertsError) {
        res.status(error.statusCode).json({ error: error.message });
        return;
      }
      next(error);
    }
  });

  return router;
}
