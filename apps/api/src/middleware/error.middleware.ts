import type { ErrorRequestHandler } from 'express';

export const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  void _next;

  const message = error instanceof Error ? error.message : 'Internal server error';

  console.error('api_error', {
    message,
    stack: error instanceof Error ? error.stack : undefined,
  });

  res.status(500).json({
    error: process.env.NODE_ENV === 'production' ? 'Internal server error' : message,
  });
};
