/**
 * Authentication middleware using Result pattern
 */

import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken, asAccessToken } from '@/utils/jwt';
import { verifySession } from '@/services/auth/authServiceNew';
import { isErr } from '@/utils/result';
import { createRequestLogger } from '@/utils/logger';

// Extend Express Request type
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        role: 'user' | 'admin' | 'moderator';
        sessionId: string;
      };
    }
  }
}

/**
 * Extract JWT token from request
 */
const extractToken = (req: Request): string | null => {
  // Check Authorization header
  const authHeader = req.header('Authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }

  // Check cookie (if using cookies)
  if (req.cookies && req.cookies.accessToken) {
    return req.cookies.accessToken;
  }

  return null;
};

/**
 * Authentication middleware - verifies JWT and session
 */
export const authenticate = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const requestLogger = createRequestLogger(req.id || 'unknown');

  try {
    // Extract token
    const token = extractToken(req);
    
    if (!token) {
      requestLogger.warn('Authentication attempt without token', {
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        endpoint: req.originalUrl,
      });

      res.status(401).json({
        success: false,
        error: {
          type: 'AUTHENTICATION_REQUIRED',
          message: 'Access token is required',
        },
      });
      return;
    }

    // Verify token
    const tokenResult = verifyAccessToken(asAccessToken(token));
    
    if (isErr(tokenResult)) {
      requestLogger.warn('Invalid JWT token provided', {
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        endpoint: req.originalUrl,
        error: tokenResult.error,
      });

      const statusCode = isErr(tokenResult) ? tokenResult.error : null.type === 'TOKEN_EXPIRED' ? 401 : 403;
      res.status(statusCode).json({
        success: false,
        error: tokenResult.error,
      });
      return;
    }

    const payload = tokenResult.value;

    // Verify session is still active
    const sessionResult = await verifySession(payload.sessionId);
    
    if (isErr(sessionResult)) {
      requestLogger.warn('Invalid or expired session', {
        userId: payload.sub,
        sessionId: payload.sessionId,
        error: sessionResult.error,
      });

      res.status(401).json({
        success: false,
        error: {
          type: 'SESSION_INVALID',
          message: 'Session is invalid or expired',
        },
      });
      return;
    }

    // Add user info to request
    req.user = {
      id: payload.sub,
      email: payload.email,
      role: payload.role,
      sessionId: payload.sessionId,
    };

    requestLogger.info('User authenticated successfully', {
      userId: payload.sub,
      email: payload.email,
      sessionId: payload.sessionId,
    });

    next();
  } catch (error) {
    requestLogger.error('Authentication middleware error', error);
    res.status(500).json({
      success: false,
      error: {
        type: 'SYSTEM_ERROR',
        message: 'Authentication system error',
      },
    });
  }
};

/**
 * Optional authentication - doesn't fail if no token, but sets user if valid
 */
export const optionalAuthenticate = async (
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  const token = extractToken(req);
  
  if (!token) {
    next();
    return;
  }

  // Try to verify token
  const tokenResult = verifyAccessToken(asAccessToken(token));
  
  if (tokenResult.ok) {
    const payload = tokenResult.value;
    
    // Try to verify session
    const sessionResult = await verifySession(payload.sessionId);
    
    if (sessionResult.ok) {
      req.user = {
        id: payload.sub,
        email: payload.email,
        role: payload.role,
        sessionId: payload.sessionId,
      };
    }
  }

  next();
};

/**
 * Require specific role(s)
 */
export const requireRole = (...roles: Array<'user' | 'admin' | 'moderator'>) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: {
          type: 'AUTHENTICATION_REQUIRED',
          message: 'Authentication required',
        },
      });
      return;
    }

    if (!roles.includes(req.user.role)) {
      res.status(403).json({
        success: false,
        error: {
          type: 'INSUFFICIENT_PERMISSIONS',
          message: `Requires one of these roles: ${roles.join(', ')}`,
        },
      });
      return;
    }

    next();
  };
};

/**
 * Require email verification
 */
export const requireEmailVerified = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  if (!req.user) {
    res.status(401).json({
      success: false,
      error: {
        type: 'AUTHENTICATION_REQUIRED',
        message: 'Authentication required',
      },
    });
    return;
  }

  // In production, check if user's email is verified
  // For now, we'll skip this check
  next();
};

/**
 * Rate limiting per user
 */
export const userRateLimit = (
  windowMs: number,
  maxRequests: number
) => {
  const userRequests = new Map<string, { count: number; resetTime: number }>();

  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      next();
      return;
    }

    const userId = req.user.id;
    const now = Date.now();
    const userLimit = userRequests.get(userId);

    if (!userLimit || now > userLimit.resetTime) {
      // Create new window
      userRequests.set(userId, {
        count: 1,
        resetTime: now + windowMs,
      });
      next();
      return;
    }

    if (userLimit.count >= maxRequests) {
      const retryAfter = Math.ceil((userLimit.resetTime - now) / 1000);
      res.status(429).json({
        success: false,
        error: {
          type: 'RATE_LIMIT_EXCEEDED',
          message: 'Too many requests',
          retryAfter,
        },
      });
      return;
    }

    userLimit.count++;
    next();
  };
};