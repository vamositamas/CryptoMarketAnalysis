import type { NextFunction, Request, Response } from 'express';
import { csrfProtection, issueCsrfToken } from './csrf.middleware';

function createResponse() {
  return {
    statusCode: 200,
    body: undefined as unknown,
    headers: new Map<string, string | string[]>(),
    setHeader(key: string, value: string | string[]) {
      this.headers.set(key, value);
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
    statusCode: number;
    body: unknown;
    headers: Map<string, string | string[]>;
  };
}

describe('csrf middleware', () => {
  it('issues a CSRF token and matching cookie', () => {
    const response = createResponse();

    issueCsrfToken({} as Request, response);

    const body = response.body as { csrfToken: string };
    const cookie = response.headers.get('Set-Cookie') as string;

    expect(response.statusCode).toBe(200);
    expect(body.csrfToken).toContain('.');
    expect(cookie).toContain(`csrf_token=${body.csrfToken}`);
  });

  it('allows mutating requests with a valid CSRF token', () => {
    const tokenResponse = createResponse();
    issueCsrfToken({} as Request, tokenResponse);
    const token = (tokenResponse.body as { csrfToken: string }).csrfToken;
    const request = {
      method: 'POST',
      headers: {
        cookie: `csrf_token=${token}`,
      },
      get: (name: string) => (name.toLowerCase() === 'x-csrf-token' ? token : undefined),
    } as Request;
    const response = createResponse();
    const next = jest.fn();

    csrfProtection(request, response, next as NextFunction);

    expect(next).toHaveBeenCalledTimes(1);
    expect(response.statusCode).toBe(200);
  });

  it('rejects mutating requests without a valid CSRF token', () => {
    const request = {
      method: 'DELETE',
      headers: {},
      get: () => undefined,
    } as unknown as Request;
    const response = createResponse();
    const next = jest.fn();

    csrfProtection(request, response, next as NextFunction);

    expect(next).not.toHaveBeenCalled();
    expect(response.statusCode).toBe(403);
    expect(response.body).toEqual({ error: 'Invalid CSRF token' });
  });
});
