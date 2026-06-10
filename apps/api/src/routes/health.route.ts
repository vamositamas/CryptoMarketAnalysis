import { Router } from 'express';
import { checkDatabaseConnection } from '../services/database-health.service';

export function createHealthRouter(): Router {
  const router = Router();

  router.get('/', (req, res) => {
    res.status(200).json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version ?? '0.0.0',
    });
  });

  router.get('/db', async (req, res) => {
    const connected = await checkDatabaseConnection();

    if (connected) {
      res.status(200).json({ database: 'connected' });
      return;
    }

    res.status(503).json({ database: 'disconnected' });
  });

  return router;
}
