import type { NextFunction, Request, Response } from 'express';
import {
  createApiRateLimitMiddleware,
  createAuthRateLimitMiddleware,
  createRateLimitMiddleware,
  type RateLimitStore,
} from './rate-limit.middleware';

function createRequest(headers: Record<string, string> = {}, ip = '127.0.0.1') {
  return {
    ip,
    socket: { remoteAddress: ip },
    get(name: string) {
      return headers[name.toLowerCase()];
    },
  } as Request;
}

function createResponse() {
  const headers = new Map<string, string>();

  return {
    statusCode: 200,
    body: undefined as unknown,
    headers,
    setHeader(key: string, value: string) {
      headers.set(key, value);
      return this;
    },
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(body: unknown) {
      this.body = body;
      return this;
    },
  } as Response & {
    body: unknown;
    headers: Map<string, string>;
    statusCode: number;
  };
}

describe('rate limit middleware', () => {
  it('allows auth requests within the configured limit', async () => {
    const store: RateLimitStore = {
      increment: jest.fn().mockResolvedValue(5),
    };
    const middleware = createAuthRateLimitMiddleware(store);
    const response = createResponse();
    const next = jest.fn();

    await middleware(createRequest({}, '192.0.2.10'), response, next as NextFunction);

    expect(store.increment).toHaveBeenCalledWith('ratelimit:auth:192.0.2.10', 60);
    expect(next).toHaveBeenCalledTimes(1);
    expect(response.statusCode).toBe(200);
  });

  it('rejects auth requests over five attempts per minute', async () => {
    const store: RateLimitStore = {
      increment: jest.fn().mockResolvedValue(6),
    };
    const middleware = createAuthRateLimitMiddleware(store);
    const response = createResponse();
    const next = jest.fn();

    await middleware(createRequest({}, '192.0.2.11'), response, next as NextFunction);

    expect(response.statusCode).toBe(429);
    expect(response.headers.get('Retry-After')).toBe('60');
    expect(response.body).toEqual({
      error: 'Too many login attempts. Please try again in 1 minute.',
    });
    expect(next).not.toHaveBeenCalled();
  });

  it('uses the first forwarded IP address when a proxy header is present', async () => {
    const store: RateLimitStore = {
      increment: jest.fn().mockResolvedValue(1),
    };
    const middleware = createAuthRateLimitMiddleware(store);

    await middleware(
      createRequest({ 'x-forwarded-for': '198.51.100.1, 203.0.113.2' }),
      createResponse(),
      jest.fn() as NextFunction,
    );

    expect(store.increment).toHaveBeenCalledWith('ratelimit:auth:198.51.100.1', 60);
  });

  it('rejects general API requests over one hundred requests per minute', async () => {
    const store: RateLimitStore = {
      increment: jest.fn().mockResolvedValue(101),
    };
    const middleware = createApiRateLimitMiddleware(store);
    const response = createResponse();
    const next = jest.fn();

    await middleware(createRequest({}, '203.0.113.10'), response, next as NextFunction);

    expect(store.increment).toHaveBeenCalledWith('ratelimit:api:203.0.113.10', 60);
    expect(response.statusCode).toBe(429);
    expect(response.headers.get('Retry-After')).toBe('60');
    expect(response.body).toEqual({ error: 'Rate limit exceeded. Please slow down.' });
    expect(next).not.toHaveBeenCalled();
  });

  it('continues when the rate-limit store is unavailable', async () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    const store: RateLimitStore = {
      increment: jest.fn().mockRejectedValue(new Error('Redis unavailable')),
    };
    const middleware = createRateLimitMiddleware({
      keyPrefix: 'ratelimit:test',
      maxRequests: 1,
      windowSeconds: 60,
      errorMessage: 'Rate limit exceeded',
      store,
    });
    const next = jest.fn();

    await middleware(createRequest({}, '203.0.113.11'), createResponse(), next as NextFunction);

    expect(next).toHaveBeenCalledTimes(1);
    expect(warnSpy).toHaveBeenCalledWith(
      'rate_limit_unavailable:ratelimit:test:203.0.113.11',
      expect.any(Error),
    );

    warnSpy.mockRestore();
  });
});
