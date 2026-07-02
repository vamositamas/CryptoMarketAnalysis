import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/rbac.middleware';
import type { AuthenticatedRequest } from '../middleware/rbac.middleware';
import { TradingPlansService, TradingPlansError } from '../services/trading-plans.service';
import { SignalAggregationError, SignalAggregationService } from '../services/signal-aggregation.service';
import { PriceProjectionsService } from '../services/price-projections.service';

export function createTradingPlansRouter(): Router {
  const router = Router();
  const auth = requireAuth();
  const anyRole = requireRole(['free_user', 'premium_user', 'administrator']);

  function userId(req: AuthenticatedRequest): string {
    return req.user?.userId ?? '';
  }

  const plansService = new TradingPlansService();
  const signalsService = new SignalAggregationService();
  const projectionsService = new PriceProjectionsService();

  router.get('/signals', auth, anyRole, async (req, res, next) => {
    try {
      const summary = await signalsService.getSummary(userId(req as AuthenticatedRequest));
      res.status(200).json(summary);
    } catch (error) {
      next(error);
    }
  });

  router.put('/signals/preferences', auth, anyRole, async (req, res, next) => {
    try {
      const summary = await signalsService.updateSelectedSignals(
        userId(req as AuthenticatedRequest),
        req.body,
      );
      res.status(200).json(summary);
    } catch (error) {
      if (error instanceof SignalAggregationError) {
        res.status(error.statusCode).json({ error: error.message });
        return;
      }
      next(error);
    }
  });

  router.get('/projections', auth, anyRole, async (_req, res, next) => {
    try {
      const projections = await projectionsService.getProjections();
      res.status(200).json(projections);
    } catch (error) {
      next(error);
    }
  });

  router.get('/', auth, anyRole, async (req, res, next) => {
    try {
      const result = await plansService.list(userId(req as AuthenticatedRequest));
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  });

  router.post('/', auth, anyRole, async (req, res, next) => {
    try {
      const plan = await plansService.create(userId(req as AuthenticatedRequest), req.body);
      res.status(201).json(plan);
    } catch (error) {
      if (error instanceof TradingPlansError) {
        res.status(error.statusCode).json({ error: error.message });
        return;
      }
      next(error);
    }
  });

  router.patch('/:planId/close', auth, anyRole, async (req, res, next) => {
    try {
      const plan = await plansService.close(
        userId(req as AuthenticatedRequest),
        req.params.planId,
        req.body,
      );
      res.status(200).json(plan);
    } catch (error) {
      if (error instanceof TradingPlansError) {
        res.status(error.statusCode).json({ error: error.message });
        return;
      }
      next(error);
    }
  });

  router.patch('/:planId/cancel', auth, anyRole, async (req, res, next) => {
    try {
      const plan = await plansService.cancel(
        userId(req as AuthenticatedRequest),
        req.params.planId,
      );
      res.status(200).json(plan);
    } catch (error) {
      if (error instanceof TradingPlansError) {
        res.status(error.statusCode).json({ error: error.message });
        return;
      }
      next(error);
    }
  });

  router.delete('/:planId', auth, anyRole, async (req, res, next) => {
    try {
      await plansService.delete(userId(req as AuthenticatedRequest), req.params.planId);
      res.status(200).json({ success: true });
    } catch (error) {
      if (error instanceof TradingPlansError) {
        res.status(error.statusCode).json({ error: error.message });
        return;
      }
      next(error);
    }
  });

  return router;
}
