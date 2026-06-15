import { Router } from 'express';
import { getDatabasePool } from '../config/database.config';
import { DailyDataRefreshService } from '../jobs/daily-data-refresh.controller';
import { requireAuth, requireRole } from '../middleware/rbac.middleware';
import type { TokenInvalidationReader } from '../middleware/rbac.middleware';
import { SystemConfigurationRepository } from '../repositories/system-configuration.repository';
import {
  DataRefreshConfigurationError,
  DataRefreshConfigurationService,
} from '../services/data-refresh-configuration.service';

type DataRefreshConfigurationServiceContract = Pick<
  DataRefreshConfigurationService,
  'getConfiguration' | 'updateConfiguration'
>;

interface AdminRouterOptions {
  dataRefreshConfigurationService?: DataRefreshConfigurationServiceContract;
  dailyDataRefreshService?: Pick<DailyDataRefreshService, 'run'>;
  tokenInvalidations?: TokenInvalidationReader;
}

export function createAdminRouter(
  optionsOrTokenInvalidations: AdminRouterOptions | TokenInvalidationReader = {},
): Router {
  const router = Router();
  const options = normalizeOptions(optionsOrTokenInvalidations);
  let dataRefreshConfigurationService = options.dataRefreshConfigurationService;
  const dailyDataRefreshService =
    options.dailyDataRefreshService ?? new DailyDataRefreshService();
  const adminOnly = [
    requireAuth(options.tokenInvalidations),
    requireRole(['administrator']),
  ] as const;

  router.get('/users', ...adminOnly, (_req, res) => {
    res.status(200).json({ users: [] });
  });

  router.get('/data-configuration', ...adminOnly, async (_req, res, next) => {
    try {
      res.status(200).json(await getConfigurationService().getConfiguration());
    } catch (error) {
      next(error);
    }
  });

  router.patch('/data-configuration', ...adminOnly, async (req, res, next) => {
    try {
      const configuration = await getConfigurationService().updateConfiguration(req.body);
      res.status(200).json(configuration);
    } catch (error) {
      if (error instanceof DataRefreshConfigurationError) {
        res.status(error.statusCode).json({ error: error.message });
        return;
      }

      next(error);
    }
  });

  router.post('/data-configuration/refresh-now', ...adminOnly, async (_req, res, next) => {
    try {
      res.status(200).json(await dailyDataRefreshService.run());
    } catch (error) {
      next(error);
    }
  });

  return router;

  function getConfigurationService(): DataRefreshConfigurationServiceContract {
    dataRefreshConfigurationService ??= createDefaultConfigurationService();
    return dataRefreshConfigurationService;
  }
}

function normalizeOptions(
  optionsOrTokenInvalidations: AdminRouterOptions | TokenInvalidationReader,
): AdminRouterOptions {
  if ('findLatestInvalidationForUser' in optionsOrTokenInvalidations) {
    return { tokenInvalidations: optionsOrTokenInvalidations };
  }

  return optionsOrTokenInvalidations;
}

function createDefaultConfigurationService(): DataRefreshConfigurationService {
  const database = getDatabasePool();

  if (!database) {
    throw new Error('SUPABASE_DATABASE_URL is required for admin data configuration');
  }

  return new DataRefreshConfigurationService(new SystemConfigurationRepository(database));
}
