import type { Request, Response } from 'express';
import { createAuthRouter } from './auth.route';
import {
  PasswordResetError,
  RegistrationError,
  VerificationError,
} from '../services/auth.service';

type Handler = (req: Request, res: Response, next: jest.Mock) => Promise<void>;

function getRegisterHandler(authService: { register: jest.Mock }): Handler {
  const router = createAuthRouter(authService as never);
  const layer = router.stack.find((entry) => entry.route?.path === '/register');

  const routeHandler = layer?.route?.stack.at(-1)?.handle;
  if (!routeHandler) {
    throw new Error('Register route not found');
  }

  return routeHandler as Handler;
}

function getHandler(authService: object, path: string): Handler {
  const router = createAuthRouter(authService as never);
  const layer = router.stack.find((entry) => entry.route?.path === path);

  const routeHandler = layer?.route?.stack.at(-1)?.handle;
  if (!routeHandler) {
    throw new Error(`${path} route not found`);
  }

  return routeHandler as Handler;
}

function createResponse() {
  const response = {
    statusCode: 200,
    body: undefined as unknown,
    redirectLocation: undefined as string | undefined,
    headers: new Map<string, string | string[]>(),
    setHeader(key: string, value: string | string[]) {
      this.headers.set(key, value);
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
    redirect(statusCode: number, location: string) {
      this.statusCode = statusCode;
      this.redirectLocation = location;
      return this;
    },
  };

  return response as Response & typeof response;
}

describe('auth route', () => {
  const originalGoogleClientId = process.env.GOOGLE_CLIENT_ID;
  const originalFrontendUrl = process.env.FRONTEND_URL;

  beforeEach(() => {
    process.env.GOOGLE_CLIENT_ID = 'google-client-id';
    process.env.FRONTEND_URL = 'http://localhost:4200';
  });

  afterEach(() => {
    process.env.GOOGLE_CLIENT_ID = originalGoogleClientId;
    process.env.FRONTEND_URL = originalFrontendUrl;
  });

  it('returns 201 for successful registration', async () => {
    const authService = {
      register: jest.fn().mockResolvedValue({ message: 'ok' }),
    };
    const handler = getRegisterHandler(authService);
    const response = createResponse();
    const next = jest.fn();

    await handler({ body: { email: 'user@example.com' } } as Request, response, next);

    expect(response.statusCode).toBe(201);
    expect(response.body).toEqual({ message: 'ok' });
    expect(next).not.toHaveBeenCalled();
  });

  it('returns registration errors as JSON responses', async () => {
    const authService = {
      register: jest.fn().mockRejectedValue(new RegistrationError(400, 'Email already registered')),
    };
    const handler = getRegisterHandler(authService);
    const response = createResponse();
    const next = jest.fn();

    await handler({ body: {} } as Request, response, next);

    expect(response.statusCode).toBe(400);
    expect(response.body).toEqual({ error: 'Email already registered' });
    expect(next).not.toHaveBeenCalled();
  });

  it('sets an auth cookie after successful login', async () => {
    const authService = {
      register: jest.fn(),
      verifyEmail: jest.fn(),
      login: jest.fn().mockResolvedValue({
        accessToken: 'jwt-token',
        user: {
          id: 'user-id',
          email: 'user@example.com',
          role: 'free_user',
          languagePreference: 'en',
        },
      }),
    };
    const router = createAuthRouter(authService as never);
    const layer = router.stack.find((entry) => entry.route?.path === '/login');
    const handler = layer?.route?.stack.at(-1)?.handle as Handler;
    const response = createResponse();
    const next = jest.fn();

    await handler({ body: { email: 'user@example.com' } } as Request, response, next);

    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual({
      accessToken: 'jwt-token',
      user: {
        id: 'user-id',
        email: 'user@example.com',
        role: 'free_user',
        languagePreference: 'en',
      },
    });
    expect(response.headers.get('Set-Cookie')).toContain('authToken=jwt-token');
    expect(response.headers.get('Set-Cookie')).toContain('HttpOnly');
    expect(next).not.toHaveBeenCalled();
  });

  it('redirects after successful email verification', async () => {
    const authService = {
      register: jest.fn(),
      verifyEmail: jest.fn().mockResolvedValue(undefined),
    };
    const router = createAuthRouter(authService as never);
    const layer = router.stack.find((entry) => entry.route?.path === '/verify');
    const handler = layer?.route?.stack.at(-1)?.handle as Handler;
    const response = createResponse();
    const next = jest.fn();

    await handler({ query: { token: 'valid-token' } } as unknown as Request, response, next);

    expect(authService.verifyEmail).toHaveBeenCalledWith('valid-token');
    expect(response.statusCode).toBe(302);
    expect(response.redirectLocation).toBe(
      '/login?message=Email%20verified!%20You%20can%20now%20log%20in.',
    );
    expect(next).not.toHaveBeenCalled();
  });

  it('returns verification errors as JSON responses', async () => {
    const authService = {
      register: jest.fn(),
      verifyEmail: jest
        .fn()
        .mockRejectedValue(new VerificationError(400, 'Verification link has expired')),
    };
    const router = createAuthRouter(authService as never);
    const layer = router.stack.find((entry) => entry.route?.path === '/verify');
    const handler = layer?.route?.stack.at(-1)?.handle as Handler;
    const response = createResponse();
    const next = jest.fn();

    await handler({ query: { token: 'expired-token' } } as unknown as Request, response, next);

    expect(response.statusCode).toBe(400);
    expect(response.body).toEqual({ error: 'Verification link has expired' });
    expect(next).not.toHaveBeenCalled();
  });

  it('requests password reset instructions', async () => {
    const authService = {
      requestPasswordReset: jest.fn().mockResolvedValue({
        message: "If that email exists, we've sent password reset instructions",
      }),
    };
    const handler = getHandler(authService, '/password-reset/request');
    const response = createResponse();
    const next = jest.fn();

    await handler({ body: { email: 'user@example.com' } } as Request, response, next);

    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual({
      message: "If that email exists, we've sent password reset instructions",
    });
    expect(authService.requestPasswordReset).toHaveBeenCalledWith({
      email: 'user@example.com',
    });
  });

  it('validates password reset tokens', async () => {
    const authService = {
      validatePasswordResetToken: jest.fn().mockResolvedValue({ valid: true }),
    };
    const handler = getHandler(authService, '/password-reset/validate');
    const response = createResponse();
    const next = jest.fn();

    await handler({ query: { token: 'reset-token' } } as unknown as Request, response, next);

    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual({ valid: true });
    expect(authService.validatePasswordResetToken).toHaveBeenCalledWith('reset-token');
  });

  it('returns password reset errors as JSON responses', async () => {
    const authService = {
      resetPassword: jest
        .fn()
        .mockRejectedValue(new PasswordResetError(400, 'Reset link is invalid or expired')),
    };
    const handler = getHandler(authService, '/password-reset/confirm');
    const response = createResponse();
    const next = jest.fn();

    await handler({ body: { token: 'expired-token' } } as Request, response, next);

    expect(response.statusCode).toBe(400);
    expect(response.body).toEqual({ error: 'Reset link is invalid or expired' });
    expect(next).not.toHaveBeenCalled();
  });

  it('redirects to Google OAuth with a state cookie', async () => {
    const authService = {
      register: jest.fn(),
      login: jest.fn(),
      verifyEmail: jest.fn(),
      createGoogleAuthorizationUrl: jest
        .fn()
        .mockReturnValue('https://accounts.google.com/o/oauth2/v2/auth?state=state-value'),
    };
    const router = createAuthRouter(authService as never);
    const layer = router.stack.find((entry) => entry.route?.path === '/google');
    const handler = layer?.route?.stack.at(-1)?.handle as Handler;
    const response = createResponse();
    const next = jest.fn();

    await handler({ headers: {} } as Request, response, next);

    expect(response.statusCode).toBe(302);
    expect(response.redirectLocation).toContain('https://accounts.google.com');
    expect(response.headers.get('Set-Cookie')).toContain('googleOAuthState=');
    expect(authService.createGoogleAuthorizationUrl).toHaveBeenCalledWith(expect.any(String));
  });

  it('handles a valid Google OAuth callback', async () => {
    const authService = {
      register: jest.fn(),
      login: jest.fn(),
      verifyEmail: jest.fn(),
      createGoogleAuthorizationUrl: jest.fn(),
      loginWithGoogleCode: jest.fn().mockResolvedValue({
        accessToken: 'jwt-token',
        user: { id: 'user-id', email: 'user@example.com' },
      }),
    };
    const router = createAuthRouter(authService as never);
    const layer = router.stack.find((entry) => entry.route?.path === '/google/callback');
    const handler = layer?.route?.stack.at(-1)?.handle as Handler;
    const response = createResponse();
    const next = jest.fn();

    await handler(
      {
        query: { code: 'auth-code', state: 'state-value' },
        headers: { cookie: 'googleOAuthState=state-value' },
      } as unknown as Request,
      response,
      next,
    );

    expect(authService.loginWithGoogleCode).toHaveBeenCalledWith('auth-code');
    expect(response.statusCode).toBe(302);
    expect(response.redirectLocation).toBe('http://localhost:4200/dashboard');
    expect(response.headers.get('Set-Cookie')).toEqual(
      expect.arrayContaining([expect.stringContaining('authToken=jwt-token')]),
    );
  });

  it('rejects Google OAuth callback with invalid state', async () => {
    const authService = {
      register: jest.fn(),
      login: jest.fn(),
      verifyEmail: jest.fn(),
      createGoogleAuthorizationUrl: jest.fn(),
      loginWithGoogleCode: jest.fn(),
    };
    const router = createAuthRouter(authService as never);
    const layer = router.stack.find((entry) => entry.route?.path === '/google/callback');
    const handler = layer?.route?.stack.at(-1)?.handle as Handler;
    const response = createResponse();
    const next = jest.fn();

    await handler(
      {
        query: { code: 'auth-code', state: 'state-value' },
        headers: { cookie: 'googleOAuthState=different-state' },
      } as unknown as Request,
      response,
      next,
    );

    expect(response.statusCode).toBe(400);
    expect(response.body).toEqual({ error: 'Invalid OAuth state' });
    expect(authService.loginWithGoogleCode).not.toHaveBeenCalled();
  });
});
