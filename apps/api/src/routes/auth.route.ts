import { randomUUID } from 'crypto';
import { Router } from 'express';
import {
  AuthService,
  LoginError,
  OAuthError,
  RegistrationError,
  VerificationError,
} from '../services/auth.service';

export function createAuthRouter(authService = new AuthService()): Router {
  const router = Router();

  router.post('/register', async (req, res, next) => {
    try {
      const response = await authService.register(req.body);
      res.status(201).json(response);
    } catch (error) {
      if (error instanceof RegistrationError) {
        res.status(error.statusCode).json({ error: error.message });
        return;
      }

      next(error);
    }
  });

  router.post('/login', async (req, res, next) => {
    try {
      const response = await authService.login(req.body);
      const secure = process.env.NODE_ENV === 'production' ? ' Secure;' : '';

      res.setHeader(
        'Set-Cookie',
        `authToken=${response.accessToken}; Path=/; Max-Age=86400; SameSite=Strict;${secure} HttpOnly`,
      );
      res.status(200).json(response);
    } catch (error) {
      if (error instanceof LoginError) {
        res.status(error.statusCode).json({ error: error.message });
        return;
      }

      next(error);
    }
  });

  router.get('/verify', async (req, res, next) => {
    try {
      await authService.verifyEmail(req.query.token?.toString());
      res.redirect(302, '/login?message=Email%20verified!%20You%20can%20now%20log%20in.');
    } catch (error) {
      if (error instanceof VerificationError) {
        res.status(error.statusCode).json({ error: error.message });
        return;
      }

      next(error);
    }
  });

  router.get('/google', (req, res, next) => {
    try {
      const state = createOAuthState();
      const secure = process.env.NODE_ENV === 'production' ? ' Secure;' : '';

      res.setHeader(
        'Set-Cookie',
        `googleOAuthState=${state}; Path=/api/auth/google/callback; Max-Age=600; SameSite=Lax;${secure} HttpOnly`,
      );
      res.redirect(302, authService.createGoogleAuthorizationUrl(state));
    } catch (error) {
      if (error instanceof OAuthError) {
        res.status(error.statusCode).json({ error: error.message });
        return;
      }

      next(error);
    }
  });

  router.get('/google/callback', async (req, res, next) => {
    try {
      const state = req.query.state?.toString();
      const cookieState = getCookieValue(req.headers.cookie, 'googleOAuthState');

      if (!state || !cookieState || state !== cookieState) {
        res.status(400).json({ error: 'Invalid OAuth state' });
        return;
      }

      const response = await authService.loginWithGoogleCode(req.query.code?.toString());
      const secure = process.env.NODE_ENV === 'production' ? ' Secure;' : '';

      res.setHeader('Set-Cookie', [
        `authToken=${response.accessToken}; Path=/; Max-Age=86400; SameSite=Strict;${secure} HttpOnly`,
        `googleOAuthState=; Path=/api/auth/google/callback; Max-Age=0; SameSite=Lax;${secure} HttpOnly`,
      ]);
      res.redirect(302, `${getFrontendUrl()}/dashboard`);
    } catch (error) {
      if (error instanceof OAuthError) {
        res.status(error.statusCode).json({ error: error.message });
        return;
      }

      next(error);
    }
  });

  return router;
}

function createOAuthState(): string {
  return randomUUID();
}

function getCookieValue(cookieHeader: string | undefined, name: string): string | undefined {
  return cookieHeader
    ?.split(';')
    .map((cookie) => cookie.trim())
    .find((cookie) => cookie.startsWith(`${name}=`))
    ?.slice(name.length + 1);
}

function getFrontendUrl(): string {
  return process.env.FRONTEND_URL ?? 'http://localhost:4200';
}
