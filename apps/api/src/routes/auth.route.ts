import { createHmac, randomBytes, timingSafeEqual } from 'crypto';
import { Router } from 'express';
import { createAuthRateLimitMiddleware } from '../middleware/rate-limit.middleware';
import {
  AuthService,
  LoginError,
  OAuthError,
  PasswordResetError,
  RegistrationError,
  VerificationError,
} from '../services/auth.service';

export function createAuthRouter(authService = new AuthService()): Router {
  const router = Router();
  const authRateLimit = createAuthRateLimitMiddleware();

  router.post('/register', authRateLimit, async (req, res, next) => {
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

  router.post('/login', authRateLimit, async (req, res, next) => {
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

  router.post('/verify/resend', authRateLimit, async (req, res, next) => {
    try {
      const response = await authService.requestEmailVerification(req.body);
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  });

  router.post('/verify/code', authRateLimit, async (req, res, next) => {
    try {
      const response = await authService.verifyEmailCode(req.body);
      res.status(200).json(response);
    } catch (error) {
      if (error instanceof VerificationError) {
        res.status(error.statusCode).json({ error: error.message });
        return;
      }

      next(error);
    }
  });

  router.post('/password-reset/request', authRateLimit, async (req, res, next) => {
    try {
      const response = await authService.requestPasswordReset(req.body);
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  });

  router.get('/password-reset/validate', async (req, res, next) => {
    try {
      const response = await authService.validatePasswordResetToken(
        req.query.token?.toString(),
      );
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  });

  router.post('/password-reset/confirm', authRateLimit, async (req, res, next) => {
    try {
      const response = await authService.resetPassword(req.body);
      res.status(200).json(response);
    } catch (error) {
      if (error instanceof PasswordResetError) {
        res.status(error.statusCode).json({ error: error.message });
        return;
      }

      next(error);
    }
  });

  router.get('/google', authRateLimit, (req, res, next) => {
    try {
      const state = createOAuthState();
      const secure = process.env.NODE_ENV === 'production' ? ' Secure;' : '';

      res.setHeader(
        'Set-Cookie',
        `googleOAuthState=${state}; Path=/; Max-Age=600; SameSite=Lax;${secure} HttpOnly`,
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

      if (!isValidOAuthState(state, cookieState)) {
        res.status(400).json({ error: 'Invalid OAuth state' });
        return;
      }

      const response = await authService.loginWithGoogleCode(req.query.code?.toString());
      const secure = process.env.NODE_ENV === 'production' ? ' Secure;' : '';

      res.setHeader('Set-Cookie', [
        `authToken=${response.accessToken}; Path=/; Max-Age=86400; SameSite=Strict;${secure} HttpOnly`,
        `googleOAuthState=; Path=/; Max-Age=0; SameSite=Lax;${secure} HttpOnly`,
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
  const nonce = randomBytes(32).toString('base64url');
  const expiresAt = Date.now() + 10 * 60 * 1000;
  const payload = `${nonce}.${expiresAt}`;

  return `${payload}.${signOAuthState(payload)}`;
}

function isValidOAuthState(state: string | undefined, cookieState: string | undefined): boolean {
  if (!state) {
    return false;
  }

  const [nonce, expiresAtValue, signature] = state.split('.');
  if (!nonce || !expiresAtValue || !signature) {
    return cookieState === state;
  }

  const expiresAt = Number(expiresAtValue);
  if (!Number.isSafeInteger(expiresAt) || expiresAt <= Date.now()) {
    return false;
  }

  const expectedSignature = signOAuthState(`${nonce}.${expiresAtValue}`);
  const actualBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expectedSignature);

  return (
    actualBuffer.length === expectedBuffer.length &&
    timingSafeEqual(actualBuffer, expectedBuffer)
  );
}

function signOAuthState(value: string): string {
  return createHmac('sha256', getOAuthStateSecret()).update(value).digest('base64url');
}

function getOAuthStateSecret(): string {
  return (
    process.env.OAUTH_STATE_SECRET ??
    process.env.CSRF_SECRET ??
    process.env.JWT_SECRET ??
    'local-development-oauth-state-secret'
  );
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
