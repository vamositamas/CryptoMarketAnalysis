import jwt from 'jsonwebtoken';
import type { Request, Response, Router } from 'express';
import { createAdminRouter } from './admin.route';
import { createAlertsRouter } from './alerts.route';
import type { TokenInvalidationReader } from '../middleware/rbac.middleware';
import { createUsersRouter } from './users.route';

type Handler = (req: Request, res: Response, next: jest.Mock) => Promise<void> | void;

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

function createRequest(token?: string, body?: unknown): Request {
  const headers = new Map<string, string>();
  if (token) {
    headers.set('authorization', `Bearer ${token}`);
  }

  return {
    body,
    headers: Object.fromEntries(headers),
    get(name: string) {
      return headers.get(name.toLowerCase());
    },
  } as unknown as Request;
}

function createToken(role: 'administrator' | 'premium_user' | 'free_user'): string {
  return jwt.sign(
    {
      userId: 'user-id',
      email: 'user@example.com',
      role,
      languagePreference: 'en',
    },
    'test-jwt-secret',
  );
}

function getHandler(router: Router, path: string, method = 'get'): Handler[] {
  const layer = router.stack.find(
    (entry) =>
      entry.route?.path === path &&
      ((entry.route as unknown as { methods: Record<string, boolean> }).methods[method]),
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

describe('protected route wiring', () => {
  const originalJwtSecret = process.env.JWT_SECRET;
  const tokenInvalidations: TokenInvalidationReader = {
    findLatestInvalidationForUser: jest.fn().mockResolvedValue(undefined),
  };

  beforeEach(() => {
    process.env.JWT_SECRET = 'test-jwt-secret';
  });

  afterEach(() => {
    process.env.JWT_SECRET = originalJwtSecret;
  });

  it('allows administrators to list admin users', async () => {
    const response = createResponse();

    await runHandlers(
      getHandler(createAdminRouter(tokenInvalidations), '/users'),
      createRequest(createToken('administrator')),
      response,
    );

    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual({ users: [] });
  });

  it('rejects non-admin users from admin routes', async () => {
    const response = createResponse();

    await runHandlers(
      getHandler(createAdminRouter(tokenInvalidations), '/users'),
      createRequest(createToken('free_user')),
      response,
    );

    expect(response.statusCode).toBe(403);
    expect(response.body).toEqual({ error: 'Insufficient permissions' });
  });

  it('allows authenticated users to create alerts', async () => {
    const response = createResponse();

  await runHandlers(
      getHandler(createAlertsRouter(tokenInvalidations), '/', 'post'),
      createRequest(createToken('free_user')),
      response,
    );

    expect(response.statusCode).toBe(201);
    expect(response.body).toEqual({ message: 'Alert creation will be implemented next.' });
  });

  it('rejects unauthenticated alert creation', async () => {
    const response = createResponse();

    await runHandlers(
      getHandler(createAlertsRouter(tokenInvalidations), '/', 'post'),
      createRequest(),
      response,
    );

  expect(response.statusCode).toBe(401);
  expect(response.body).toEqual({ error: 'Unauthorized' });
});

  it('returns the authenticated user profile', async () => {
    const userProfileService = {
      getProfile: jest.fn().mockResolvedValue({
        id: 'user-id',
        email: 'user@example.com',
        languagePreference: 'en',
        role: 'free_user',
        emailVerified: true,
        onboardingCompleted: false,
        createdAt: '2026-06-11T10:00:00.000Z',
      }),
      updateProfile: jest.fn(),
      changePassword: jest.fn(),
    };
    const response = createResponse();

    await runHandlers(
      getHandler(createUsersRouter(userProfileService, tokenInvalidations), '/me'),
      createRequest(createToken('free_user')),
      response,
    );

    expect(userProfileService.getProfile).toHaveBeenCalledWith('user-id');
    expect(response.statusCode).toBe(200);
    expect(response.body).toMatchObject({
      id: 'user-id',
      email: 'user@example.com',
    });
  });

  it('updates the authenticated user profile', async () => {
    const userProfileService = {
      getProfile: jest.fn(),
      updateProfile: jest.fn().mockResolvedValue({
        id: 'user-id',
        email: 'user@example.com',
        fullName: 'John Doe',
        languagePreference: 'hu',
        role: 'free_user',
        emailVerified: true,
        onboardingCompleted: false,
        createdAt: '2026-06-11T10:00:00.000Z',
      }),
      changePassword: jest.fn(),
    };
    const response = createResponse();
    const requestBody = { fullName: 'John Doe', languagePreference: 'hu' };

    await runHandlers(
      getHandler(createUsersRouter(userProfileService, tokenInvalidations), '/me', 'patch'),
      createRequest(createToken('free_user'), requestBody),
      response,
    );

    expect(userProfileService.updateProfile).toHaveBeenCalledWith('user-id', requestBody);
    expect(response.statusCode).toBe(200);
    expect(response.body).toMatchObject({
      fullName: 'John Doe',
      languagePreference: 'hu',
    });
  });

  it('changes the authenticated user password', async () => {
    const userProfileService = {
      getProfile: jest.fn(),
      updateProfile: jest.fn(),
      changePassword: jest.fn().mockResolvedValue({
        message: 'Password changed successfully. Please log in again.',
      }),
    };
    const response = createResponse();
    const requestBody = {
      currentPassword: 'CurrentPass123!',
      newPassword: 'NewPass123!',
    };

    await runHandlers(
      getHandler(
        createUsersRouter(userProfileService, tokenInvalidations),
        '/me/change-password',
        'post',
      ),
      createRequest(createToken('free_user'), requestBody),
      response,
    );

    expect(userProfileService.changePassword).toHaveBeenCalledWith('user-id', requestBody);
    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual({
      message: 'Password changed successfully. Please log in again.',
    });
  });
});
