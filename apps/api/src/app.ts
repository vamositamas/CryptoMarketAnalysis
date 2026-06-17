import express from 'express';
import { csrfProtection, issueCsrfToken } from './middleware/csrf.middleware';
import { createApiRateLimitMiddleware } from './middleware/rate-limit.middleware';
import { enforceHttps, securityHeaders } from './middleware/security.middleware';
import { createAdminRouter } from './routes/admin.route';
import { createAlertsRouter } from './routes/alerts.route';
import { createAuthRouter } from './routes/auth.route';
import { createChartsRouter } from './routes/charts.route';
import { createDashboardRouter } from './routes/dashboard.route';
import { errorHandler } from './middleware/error.middleware';
import { createHealthRouter } from './routes/health.route';
import { createUsersRouter } from './routes/users.route';
import { createDailyDataRefreshRouter } from './jobs/daily-data-refresh.controller';

export function createApp() {
  const app = express();

  app.set('trust proxy', 1);
  app.use(securityHeaders);
  app.use(enforceHttps);
  app.use('/api', createApiRateLimitMiddleware());
  app.use(express.json({ verify: captureRawBody }));
  app.get('/api/csrf-token', issueCsrfToken);
  app.use('/api/jobs', createDailyDataRefreshRouter());
  app.use(csrfProtection);
  app.use('/api/auth', createAuthRouter());
  app.use('/api/users', createUsersRouter());
  app.use('/api/admin', createAdminRouter());
  app.use('/api/alerts', createAlertsRouter());
  app.use('/api/charts', createChartsRouter());
  app.use('/api/dashboard', createDashboardRouter());
  app.use('/api/health', createHealthRouter());

  app.get('/', (req, res) => {
    res.send({ message: 'Hello API' });
  });
  app.use(errorHandler);

  return app;
}

function captureRawBody(req: express.Request & { rawBody?: string }, _res: express.Response, buffer: Buffer): void {
  req.rawBody = buffer.toString('utf8');
}
