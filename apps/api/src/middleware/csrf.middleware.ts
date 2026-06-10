import { createHmac, randomBytes, timingSafeEqual } from 'crypto';
import type { NextFunction, Request, Response } from 'express';

const CSRF_COOKIE_NAME = 'csrf_token';
const CSRF_HEADER_NAME = 'x-csrf-token';
const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

export function issueCsrfToken(req: Request, res: Response): void {
  const token = createCsrfToken();
  const secure = process.env.NODE_ENV === 'production' ? ' Secure;' : '';

  res.setHeader(
    'Set-Cookie',
    `${CSRF_COOKIE_NAME}=${token}; Path=/; SameSite=Strict;${secure} HttpOnly`,
  );
  res.status(200).json({ csrfToken: token });
}

export function csrfProtection(req: Request, res: Response, next: NextFunction): void {
  if (!MUTATING_METHODS.has(req.method)) {
    next();
    return;
  }

  const headerToken = req.get(CSRF_HEADER_NAME);
  const cookieToken = getCookieValue(req.headers.cookie, CSRF_COOKIE_NAME);

  if (!headerToken || !cookieToken || headerToken !== cookieToken || !isValidCsrfToken(headerToken)) {
    res.status(403).json({ error: 'Invalid CSRF token' });
    return;
  }

  next();
}

function createCsrfToken(): string {
  const nonce = randomBytes(32).toString('base64url');
  return `${nonce}.${sign(nonce)}`;
}

function isValidCsrfToken(token: string): boolean {
  const [nonce, signature] = token.split('.');

  if (!nonce || !signature) {
    return false;
  }

  const expected = sign(nonce);
  const actualBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);

  return (
    actualBuffer.length === expectedBuffer.length &&
    timingSafeEqual(actualBuffer, expectedBuffer)
  );
}

function sign(value: string): string {
  return createHmac('sha256', getCsrfSecret()).update(value).digest('base64url');
}

function getCsrfSecret(): string {
  return process.env.CSRF_SECRET ?? 'local-development-csrf-secret';
}

function getCookieValue(cookieHeader: string | undefined, name: string): string | undefined {
  return cookieHeader
    ?.split(';')
    .map((cookie) => cookie.trim())
    .find((cookie) => cookie.startsWith(`${name}=`))
    ?.slice(name.length + 1);
}
