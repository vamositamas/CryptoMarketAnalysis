import type { Request, Response } from 'express';
import { errorHandler } from './error.middleware';

describe('errorHandler', () => {
  const originalNodeEnv = process.env.NODE_ENV;

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
  });

  it('returns the error message in development', () => {
    process.env.NODE_ENV = 'development';
    const response = createResponse();

    errorHandler(new Error('Database is not configured'), {} as Request, response, jest.fn());

    expect(response.statusCode).toBe(500);
    expect(response.body).toEqual({ error: 'Database is not configured' });
  });

  it('hides the error message in production', () => {
    process.env.NODE_ENV = 'production';
    const response = createResponse();

    errorHandler(new Error('secret failure'), {} as Request, response, jest.fn());

    expect(response.statusCode).toBe(500);
    expect(response.body).toEqual({ error: 'Internal server error' });
  });
});

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
