import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/rbac.middleware';
import type { TokenInvalidationReader } from '../middleware/rbac.middleware';

export function createAlertsRouter(tokenInvalidations?: TokenInvalidationReader): Router {
  const router = Router();

  router.post(
    '/',
    requireAuth(tokenInvalidations),
    requireRole(['free_user', 'premium_user', 'administrator']),
    (req, res) => {
      res.status(201).json({ message: 'Alert creation will be implemented next.' });
    },
  );

  return router;
}
