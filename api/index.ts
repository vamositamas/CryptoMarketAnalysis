import type { IncomingMessage, ServerResponse } from 'http';
import { loadApiEnv } from '../apps/api/src/config/env.config';

loadApiEnv();

let handler: ((req: IncomingMessage, res: ServerResponse) => void) | null = null;
let initError: unknown = null;

try {
  const { createApp } = require('../apps/api/src/app');
  handler = createApp();
} catch (err) {
  initError = err;
  console.error('[api/index] App initialization failed:', err);
}

export default function (req: IncomingMessage, res: ServerResponse): void {
  if (initError || !handler) {
    const message = initError instanceof Error ? initError.message : String(initError);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'App failed to initialize', detail: message }));
    return;
  }
  handler(req, res);
}
