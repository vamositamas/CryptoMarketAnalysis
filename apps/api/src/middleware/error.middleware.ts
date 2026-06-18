import type { ErrorRequestHandler } from 'express';

const DATABASE_ERROR_CODES = new Set(['ENOTFOUND', 'ECONNREFUSED', 'ECONNRESET', 'ETIMEDOUT', 'EPIPE']);

function isDatabaseConnectionError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const code = (error as NodeJS.ErrnoException).code;
  if (code && DATABASE_ERROR_CODES.has(code)) return true;
  return error.message.includes('ENOTFOUND') || error.message.includes('ECONNREFUSED');
}

export const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  void _next;

  const message = error instanceof Error ? error.message : 'Internal server error';

  console.error('api_error', {
    message,
    stack: error instanceof Error ? error.stack : undefined,
  });

  if (isDatabaseConnectionError(error)) {
    res.status(503).json({ error: 'The database is temporarily unavailable. Please try again shortly.' });
    return;
  }

  res.status(500).json({
    error: process.env.NODE_ENV === 'production' ? 'Internal server error' : message,
  });
};
