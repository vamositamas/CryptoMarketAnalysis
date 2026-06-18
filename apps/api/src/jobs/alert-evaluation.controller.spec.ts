import { createHash } from 'crypto';
import jwt from 'jsonwebtoken';
import type { Request, Response } from 'express';
import { createAlertEvaluationRouter } from './alert-evaluation.controller';
import type { AlertEvaluationSummary } from '../services/alert-evaluation.service';

type Handler = (req: Request, res: Response, next: jest.Mock) => Promise<void> | void;

function createQStashSignature(input: {
  body: string;
  signingKey: string;
  url: string;
}): string {
  return jwt.sign(
    {
      iss: 'Upstash',
      sub: input.url,
      body: createHash('sha256').update(input.body).digest('base64url'),
    },
    input.signingKey,
  );
}

function createRequest(input: { rawBody?: string; headers?: Record<string, string> } = {}): Request {
  const headers = new Map(
    Object.entries(input.headers ?? {}).map(([key, value]) => [key.toLowerCase(), value]),
  );
  return {
    rawBody: input.rawBody ?? '',
    protocol: 'https',
    originalUrl: '/api/jobs/evaluate-alerts',
    get(name: string) {
      return headers.get(name.toLowerCase());
    },
  } as unknown as Request;
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

function getHandlers(
  router: ReturnType<typeof createAlertEvaluationRouter>,
  path: string,
  method: string,
): Handler[] {
  const layer = router.stack.find(
    (entry) =>
      entry.route?.path === path &&
      (entry.route as unknown as { methods: Record<string, boolean> }).methods[method],
  );

  if (!layer?.route?.stack) {
    throw new Error(`${path} route not found`);
  }

  return layer.route.stack.map((entry) => entry.handle as Handler);
}

async function runHandlers(handlers: Handler[], req: Request, res: Response): Promise<void> {
  for (const handler of handlers) {
    let shouldContinue = false;
    await handler(req, res, jest.fn(() => (shouldContinue = true)));

    if (!shouldContinue) {
      return;
    }
  }
}

describe('alert evaluation job', () => {
  it('returns 401 when QStash signature is missing', async () => {
    const router = createAlertEvaluationRouter({
      alertEvaluationService: { evaluateAlerts: jest.fn() },
      qstash: {
        currentSigningKey: 'current',
        nextSigningKey: 'next',
        expectedUrl: 'https://example.com/api/jobs/evaluate-alerts',
      },
    });

    const handlers = getHandlers(router, '/evaluate-alerts', 'post');
    const response = createResponse();

    await runHandlers(handlers, createRequest(), response);

    expect(response.statusCode).toBe(401);
    expect(response.body).toEqual({ error: 'Unauthorized' });
  });

  it('returns 200 with evaluation summary on success', async () => {
    const summary: AlertEvaluationSummary = { evaluated: 5, triggered: 2, skipped: 0 };
    const alertEvaluationService = { evaluateAlerts: jest.fn().mockResolvedValue(summary) };
    const rawBody = '';
    const signature = createQStashSignature({
      body: rawBody,
      signingKey: 'current',
      url: 'https://example.com/api/jobs/evaluate-alerts',
    });

    const router = createAlertEvaluationRouter({
      alertEvaluationService,
      qstash: {
        currentSigningKey: 'current',
        nextSigningKey: 'next',
        expectedUrl: 'https://example.com/api/jobs/evaluate-alerts',
      },
    });

    const handlers = getHandlers(router, '/evaluate-alerts', 'post');
    const response = createResponse();

    await runHandlers(
      handlers,
      createRequest({ rawBody, headers: { 'upstash-signature': signature } }),
      response,
    );

    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual(summary);
  });
});
