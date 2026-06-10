import type { NextFunction, Request, Response } from 'express';
import { enforceHttps, securityHeaders } from './security.middleware';

function createResponse() {
  const headers = new Map<string, string>();

  return {
    headers,
    redirectedTo: undefined as string | undefined,
    statusCode: undefined as number | undefined,
    setHeader(key: string, value: string) {
      headers.set(key, value);
    },
    redirect(statusCode: number, location: string) {
      this.statusCode = statusCode;
      this.redirectedTo = location;
    },
  } as Response & {
    headers: Map<string, string>;
    redirectedTo?: string;
    statusCode?: number;
  };
}

describe('security middleware', () => {
  const originalNodeEnv = process.env.NODE_ENV;

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
  });

  it('sets baseline security headers', () => {
    const response = createResponse();
    const next = jest.fn();

    securityHeaders({} as Request, response, next);

    expect(response.headers.get('Strict-Transport-Security')).toBe(
      'max-age=31536000; includeSubDomains',
    );
    expect(response.headers.get('X-Frame-Options')).toBe('DENY');
    expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff');
    expect(response.headers.get('Referrer-Policy')).toBe('strict-origin-when-cross-origin');
    expect(response.headers.get('Permissions-Policy')).toBe(
      'geolocation=(), microphone=(), camera=()',
    );
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('redirects HTTP traffic to HTTPS in production', () => {
    process.env.NODE_ENV = 'production';
    const response = createResponse();
    const next = jest.fn();
    const request = {
      originalUrl: '/api/health',
      protocol: 'http',
      get: (name: string) => (name === 'host' ? 'example.com' : 'http'),
    } as Request;

    enforceHttps(request, response, next as NextFunction);

    expect(response.statusCode).toBe(308);
    expect(response.redirectedTo).toBe('https://example.com/api/health');
    expect(next).not.toHaveBeenCalled();
  });
});
