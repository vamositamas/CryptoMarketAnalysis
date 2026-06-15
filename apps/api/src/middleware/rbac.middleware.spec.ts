import jwt from 'jsonwebtoken';
import type { NextFunction, Response } from 'express';
import { requireAuth, requireRole, type AuthenticatedRequest } from './rbac.middleware';

type TestRequest = AuthenticatedRequest & {
  setHeader(name: string, value: string): void;
};

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

function createRequest(overrides: Partial<AuthenticatedRequest> = {}): TestRequest {
  const headers = new Map<string, string>();
  const request = {
    headers: {},
    get(name: string) {
      return headers.get(name.toLowerCase());
    },
    setHeader(name: string, value: string) {
      headers.set(name.toLowerCase(), value);
    },
    ...overrides,
  } as TestRequest;

  return request;
}

function createToken(overrides: Record<string, unknown> = {}): string {
  return jwt.sign(
    {
      userId: 'user-id',
      email: 'user@example.com',
      role: 'free_user',
      languagePreference: 'en',
      ...overrides,
    },
    'test-jwt-secret',
  );
}

describe('RBAC middleware', () => {
  const originalJwtSecret = process.env.JWT_SECRET;

  beforeEach(() => {
    process.env.JWT_SECRET = 'test-jwt-secret';
  });

  afterEach(() => {
    process.env.JWT_SECRET = originalJwtSecret;
  });

  it('rejects unauthenticated requests', async () => {
    const req = createRequest();
    const res = createResponse();
    const next = jest.fn() as NextFunction;

    await requireAuth({ findLatestInvalidationForUser: jest.fn() })(req, res, next);

    expect(res.statusCode).toBe(401);
    expect(res.body).toEqual({ error: 'Unauthorized' });
    expect(next).not.toHaveBeenCalled();
  });

  it('authenticates bearer tokens and attaches the user payload', async () => {
    const req = createRequest();
    req.setHeader('authorization', `Bearer ${createToken({ role: 'premium_user' })}`);
    const res = createResponse();
    const next = jest.fn() as NextFunction;

    await requireAuth({
      findLatestInvalidationForUser: jest.fn().mockResolvedValue(undefined),
    })(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(req.user).toMatchObject({
      userId: 'user-id',
      email: 'user@example.com',
      role: 'premium_user',
      languagePreference: 'en',
    });
  });

  it('authenticates authToken cookies', async () => {
    const req = createRequest({ headers: { cookie: `authToken=${createToken()}` } });
    const res = createResponse();
    const next = jest.fn() as NextFunction;

    await requireAuth({
      findLatestInvalidationForUser: jest.fn().mockResolvedValue(undefined),
    })(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(req.user?.role).toBe('free_user');
  });

  it('allows the development admin token when token invalidation storage is unavailable', async () => {
    const req = createRequest();
    req.setHeader(
      'authorization',
      `Bearer ${createToken({
        userId: 'development-admin-user',
        email: 'admin@cryptomarketanalysis.com',
        role: 'administrator',
      })}`,
    );
    const res = createResponse();
    const next = jest.fn() as NextFunction;

    await requireAuth({
      findLatestInvalidationForUser: jest
        .fn()
        .mockRejectedValue(new Error('getaddrinfo ENOTFOUND db.example.supabase.co')),
    })(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(req.user).toMatchObject({
      userId: 'development-admin-user',
      role: 'administrator',
    });
  });

  it('rejects tokens invalidated after issue time', async () => {
    const token = jwt.sign(
      {
        userId: 'user-id',
        email: 'user@example.com',
        role: 'free_user',
        languagePreference: 'en',
        iat: 1_000,
      },
      'test-jwt-secret',
    );
    const req = createRequest();
    req.setHeader('authorization', `Bearer ${token}`);
    const res = createResponse();
    const next = jest.fn() as NextFunction;

    await requireAuth({
      findLatestInvalidationForUser: jest
        .fn()
        .mockResolvedValue(new Date(1_001_000)),
    })(req, res, next);

    expect(res.statusCode).toBe(401);
    expect(res.body).toEqual({ error: 'Unauthorized' });
    expect(next).not.toHaveBeenCalled();
  });

  it('allows users with an accepted role', () => {
    const req = createRequest({ user: { role: 'administrator' } as never });
    const res = createResponse();
    const next = jest.fn() as NextFunction;

    requireRole(['administrator'])(req, res, next);

    expect(next).toHaveBeenCalled();
  });

  it('rejects users without an accepted role', () => {
    const req = createRequest({ user: { role: 'free_user' } as never });
    const res = createResponse();
    const next = jest.fn() as NextFunction;

    requireRole(['administrator'])(req, res, next);

    expect(res.statusCode).toBe(403);
    expect(res.body).toEqual({ error: 'Insufficient permissions' });
    expect(next).not.toHaveBeenCalled();
  });
});
