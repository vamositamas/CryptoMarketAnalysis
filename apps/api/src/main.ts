import { loadApiEnv } from './config/env.config';

loadApiEnv();

const host = process.env.HOST ?? 'localhost';
const port = process.env.PORT ? Number(process.env.PORT) : 3000;

void import('./app.js').then(({ createApp }) => {
  const app = createApp();

  app.listen(port, host, () => {
    console.log(`[ ready ] http://${host}:${port}`);
  });
});
