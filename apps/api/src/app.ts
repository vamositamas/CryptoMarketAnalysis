import express from 'express';
import { csrfProtection, issueCsrfToken } from './middleware/csrf.middleware';
import { enforceHttps, securityHeaders } from './middleware/security.middleware';
import { createAuthRouter } from './routes/auth.route';
import { createHealthRouter } from './routes/health.route';

export function createApp() {
  const app = express();

  app.set('trust proxy', 1);
  app.use(securityHeaders);
  app.use(enforceHttps);
  app.use(express.json());
  app.get('/api/csrf-token', issueCsrfToken);
  app.use(csrfProtection);
  app.use('/api/auth', createAuthRouter());
  app.use('/api/health', createHealthRouter());

  app.get('/', (req, res) => {
    res.send({ message: 'Hello API' });
  });

  return app;
}
