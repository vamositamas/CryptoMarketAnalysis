import type { NextFunction, Request, Response } from 'express';

export interface RateLimitStore {
  increment(key: string, windowSeconds: number): Promise<number>;
}

export interface RateLimitOptions {
  keyPrefix: string;
  maxRequests: number;
  windowSeconds: number;
  errorMessage: string;
  store?: RateLimitStore;
}

export function createRateLimitMiddleware(options: RateLimitOptions) {
  const store = options.store ?? createDefaultRateLimitStore();

  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const ipAddress = getClientIpAddress(req);
    const key = `${options.keyPrefix}:${ipAddress}`;

    try {
      const requestCount = await store.increment(key, options.windowSeconds);

      if (requestCount > options.maxRequests) {
        res.setHeader('Retry-After', options.windowSeconds.toString());
        res.status(429).json({ error: options.errorMessage });
        return;
      }
    } catch (error) {
      console.warn(`rate_limit_unavailable:${key}`, error);
    }

    next();
  };
}

export function createAuthRateLimitMiddleware(store?: RateLimitStore) {
  return createRateLimitMiddleware({
    keyPrefix: 'ratelimit:auth',
    maxRequests: 5,
    windowSeconds: 60,
    errorMessage: 'Too many login attempts. Please try again in 1 minute.',
    store,
  });
}

export function createApiRateLimitMiddleware(store?: RateLimitStore) {
  return createRateLimitMiddleware({
    keyPrefix: 'ratelimit:api',
    maxRequests: 100,
    windowSeconds: 60,
    errorMessage: 'Rate limit exceeded. Please slow down.',
    store,
  });
}

export function createDefaultRateLimitStore(): RateLimitStore {
  if (process.env.UPSTASH_REDIS_URL && process.env.UPSTASH_REDIS_TOKEN) {
    return new UpstashRateLimitStore(
      process.env.UPSTASH_REDIS_URL,
      process.env.UPSTASH_REDIS_TOKEN,
    );
  }

  return new InMemoryRateLimitStore();
}

class UpstashRateLimitStore implements RateLimitStore {
  constructor(
    private readonly redisUrl: string,
    private readonly redisToken: string,
  ) {}

  async increment(key: string, windowSeconds: number): Promise<number> {
    const response = await fetch(`${this.redisUrl}/pipeline`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${this.redisToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify([
        ['INCR', key],
        ['EXPIRE', key, windowSeconds, 'NX'],
      ]),
    });

    if (!response.ok) {
      throw new Error(`Upstash rate limit request failed with ${response.status}`);
    }

    const [incrementResult] = (await response.json()) as Array<{ result?: unknown }>;
    const count = Number(incrementResult?.result);

    if (!Number.isFinite(count)) {
      throw new Error('Upstash rate limit response did not include a numeric count');
    }

    return count;
  }
}

class InMemoryRateLimitStore implements RateLimitStore {
  private readonly entries = new Map<string, { count: number; expiresAt: number }>();

  async increment(key: string, windowSeconds: number): Promise<number> {
    const now = Date.now();
    const existing = this.entries.get(key);

    if (!existing || existing.expiresAt <= now) {
      this.entries.set(key, {
        count: 1,
        expiresAt: now + windowSeconds * 1000,
      });
      return 1;
    }

    existing.count += 1;
    return existing.count;
  }
}

function getClientIpAddress(req: Request): string {
  const forwardedFor = req.get('x-forwarded-for')?.split(',')[0]?.trim();
  return forwardedFor || req.ip || req.socket.remoteAddress || 'unknown';
}
