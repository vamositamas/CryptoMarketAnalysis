import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/rbac.middleware';
import type { TokenInvalidationReader } from '../middleware/rbac.middleware';

export function createAdminRouter(tokenInvalidations?: TokenInvalidationReader): Router {
  const router = Router();

  router.get(
    '/users',
    requireAuth(tokenInvalidations),
    requireRole(['administrator']),
    (req, res) => {
      res.status(200).json({ users: [] });
    },
  );

  return router;
}
