import type { NextFunction, Request, Response } from 'express';

const SECURITY_HEADERS = {
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
  'X-Frame-Options': 'DENY',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'geolocation=(), microphone=(), camera=()',
} as const;

export function securityHeaders(req: Request, res: Response, next: NextFunction): void {
  for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
    res.setHeader(key, value);
  }

  next();
}

export function enforceHttps(req: Request, res: Response, next: NextFunction): void {
  if (process.env.NODE_ENV !== 'production') {
    next();
    return;
  }

  const protocol = req.get('x-forwarded-proto') ?? req.protocol;

  if (protocol === 'https') {
    next();
    return;
  }

  res.redirect(308, `https://${req.get('host')}${req.originalUrl}`);
}
