import type { Request, Response } from 'express';
import { createHealthRouter } from './health.route';

type Handler = (req: Request, res: Response) => void | Promise<void>;

function getRouteHandler(path: string): Handler {
  const router = createHealthRouter();
  const layer = router.stack.find((entry) => entry.route?.path === path);

  if (!layer?.route?.stack[0]?.handle) {
    throw new Error(`Route not found: ${path}`);
  }

  return layer.route.stack[0].handle as Handler;
}

function createResponse() {
  const response = {
    statusCode: 200,
    body: undefined as unknown,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(body: unknown) {
      this.body = body;
      return this;
    },
  };

  return response as Response & typeof response;
}

describe('health routes', () => {
  const originalDatabaseUrl = process.env.SUPABASE_DATABASE_URL;

  beforeEach(() => {
    delete process.env.SUPABASE_DATABASE_URL;
  });

  afterEach(() => {
    process.env.SUPABASE_DATABASE_URL = originalDatabaseUrl;
  });

  it('returns API health status', async () => {
    const handler = getRouteHandler('/');
    const response = createResponse();

    await handler({} as Request, response);

    const body = response.body as {
      status: string;
      timestamp: string;
      version: string;
    };

    expect(response.statusCode).toBe(200);
    expect(body.status).toBe('healthy');
    expect(Date.parse(body.timestamp)).not.toBeNaN();
    expect(body.version).toBe('0.0.0');
  });

  it('returns disconnected database health without database configuration', async () => {
    const handler = getRouteHandler('/db');
    const response = createResponse();

    await handler({} as Request, response);

    expect(response.statusCode).toBe(503);
    expect(response.body).toEqual({ database: 'disconnected' });
  });
});
