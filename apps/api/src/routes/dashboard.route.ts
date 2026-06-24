import { Router } from 'express';
import { getDatabasePool } from '../config/database.config';
import { DailyDataRefreshService } from '../jobs/daily-data-refresh.controller';
import { requireAuth } from '../middleware/rbac.middleware';
import type { AuthenticatedRequest, TokenInvalidationReader } from '../middleware/rbac.middleware';
import { DashboardMetricsRepository } from '../repositories/dashboard-metrics.repository';
import { DashboardWidgetRepository } from '../repositories/dashboard-widget.repository';
import { DashboardError, DashboardService } from '../services/dashboard.service';
import { LivePriceService } from '../services/live-price.service';
import { CoinGeckoClient } from '@crypto-market-analysis/calculation-engines/data-sources';

interface DashboardRouterOptions {
  dashboardService?: Pick<DashboardService, 'getWidgets' | 'addWidget' | 'reorderWidgets' | 'removeWidget'>;
  dailyDataRefreshService?: Pick<DailyDataRefreshService, 'run'>;
  livePriceService?: Pick<LivePriceService, 'getLivePrice'>;
}

export function createDashboardRouter(
  options: DashboardRouterOptions = {},
  tokenInvalidations?: TokenInvalidationReader,
): Router {
  const router = Router();
  let dashboardService = options.dashboardService;
  const refreshService = options.dailyDataRefreshService ?? new DailyDataRefreshService();
  let livePriceService = options.livePriceService;

  router.get('/widgets', requireAuth(tokenInvalidations), async (req, res, next) => {
    try {
      const response = await getDashboardService().getWidgets(
        (req as AuthenticatedRequest).user?.userId ?? '',
      );
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  });

  router.post('/widgets', requireAuth(tokenInvalidations), async (req, res, next) => {
    try {
      const response = await getDashboardService().addWidget(
        (req as AuthenticatedRequest).user?.userId ?? '',
        req.body,
      );
      res.status(201).json(response);
    } catch (error) {
      if (error instanceof DashboardError) {
        res.status(error.statusCode).json({ error: error.message });
        return;
      }

      next(error);
    }
  });

  router.patch('/widgets/reorder', requireAuth(tokenInvalidations), async (req, res, next) => {
    try {
      await getDashboardService().reorderWidgets(
        (req as AuthenticatedRequest).user?.userId ?? '',
        req.body?.orderedIds,
      );
      res.status(200).json({ success: true });
    } catch (error) {
      if (error instanceof DashboardError) {
        res.status(error.statusCode).json({ error: error.message });
        return;
      }

      next(error);
    }
  });

  router.delete('/widgets/:widgetId', requireAuth(tokenInvalidations), async (req, res, next) => {
    try {
      await getDashboardService().removeWidget(
        (req as AuthenticatedRequest).user?.userId ?? '',
        req.params['widgetId'] ?? '',
      );
      res.status(204).send();
    } catch (error) {
      if (error instanceof DashboardError) {
        res.status(error.statusCode).json({ error: error.message });
        return;
      }

      next(error);
    }
  });

  router.post('/refresh', requireAuth(tokenInvalidations), async (_req, res, next) => {
    try {
      res.status(200).json(await refreshService.run());
    } catch (error) {
      next(error);
    }
  });

  router.get('/live-price', requireAuth(tokenInvalidations), async (_req, res, next) => {
    try {
      res.status(200).json(await getLivePriceService().getLivePrice());
    } catch (error) {
      next(error);
    }
  });

  return router;

  function getDashboardService(): Pick<DashboardService, 'getWidgets' | 'addWidget' | 'reorderWidgets' | 'removeWidget'> {
    dashboardService ??= createDefaultDashboardService();
    return dashboardService;
  }

  function getLivePriceService(): Pick<LivePriceService, 'getLivePrice'> {
    livePriceService ??= createDefaultLivePriceService();
    return livePriceService;
  }
}

function createDefaultDashboardService(): DashboardService {
  const database = getDatabasePool();

  if (!database) {
    throw new Error('SUPABASE_DATABASE_URL is required for dashboard endpoints');
  }

  return new DashboardService(
    new DashboardWidgetRepository(database),
    new DashboardMetricsRepository(database),
  );
}

function createDefaultLivePriceService(): LivePriceService {
  const database = getDatabasePool();

  if (!database) {
    throw new Error('SUPABASE_DATABASE_URL is required for live price endpoint');
  }

  return new LivePriceService(new CoinGeckoClient(), database);
}
