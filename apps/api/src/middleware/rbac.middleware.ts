import jwt from 'jsonwebtoken';
import type { NextFunction, Request, Response } from 'express';
import type { UserRole } from '@crypto-market-analysis/shared/types';
import { TokenBlacklistRepository } from '../repositories/token-blacklist.repository';

export interface AuthenticatedRequest extends Request {
  user?: {
    userId: string;
    email: string;
    role: UserRole;
    languagePreference: 'en' | 'hu';
    issuedAt: Date;
  };
}

interface JwtPayload {
  userId?: string;
  email?: string;
  role?: UserRole;
  languagePreference?: 'en' | 'hu';
  iat?: number;
}

export interface TokenInvalidationReader {
  findLatestInvalidationForUser(userId: string): Promise<Date | undefined>;
}

export function requireAuth(
  tokenInvalidations: TokenInvalidationReader = new TokenBlacklistRepository(),
) {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const token = getRequestToken(req);

    if (!token) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    try {
      const payload = jwt.verify(token, getJwtSecret()) as JwtPayload;

      if (
        !payload.userId ||
        !payload.email ||
        !payload.role ||
        !payload.languagePreference ||
        !payload.iat
      ) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const issuedAt = new Date(payload.iat * 1000);
      const invalidatedAt = await tokenInvalidations.findLatestInvalidationForUser(
        payload.userId,
      );
      if (invalidatedAt && issuedAt.getTime() <= invalidatedAt.getTime()) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      req.user = {
        userId: payload.userId,
        email: payload.email,
        role: payload.role,
        languagePreference: payload.languagePreference,
        issuedAt,
      };
      next();
    } catch {
      res.status(401).json({ error: 'Unauthorized' });
    }
  };
}

export function requireRole(allowedRoles: UserRole[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      res.status(403).json({ error: 'Insufficient permissions' });
      return;
    }

    next();
  };
}

function getRequestToken(req: Request): string | undefined {
  const authorizationHeader = req.get('authorization');
  if (authorizationHeader?.startsWith('Bearer ')) {
    return authorizationHeader.slice('Bearer '.length);
  }

  return getCookieValue(req.headers.cookie, 'authToken');
}

function getCookieValue(cookieHeader: string | undefined, name: string): string | undefined {
  return cookieHeader
    ?.split(';')
    .map((cookie) => cookie.trim())
    .find((cookie) => cookie.startsWith(`${name}=`))
    ?.slice(name.length + 1);
}

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;

  if (!secret && process.env.NODE_ENV === 'production') {
    throw new Error('JWT_SECRET is required in production');
  }

  return secret ?? 'local-development-jwt-secret';
}
