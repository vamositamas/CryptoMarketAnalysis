import express from 'express';
import { createHealthRouter } from './routes/health.route';

export function createApp() {
  const app = express();

  app.use(express.json());
  app.use('/api/health', createHealthRouter());

  app.get('/', (req, res) => {
    res.send({ message: 'Hello API' });
  });

  return app;
}
