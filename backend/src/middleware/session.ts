/**
 * Session middleware for Express using Redis session store
 * Provides session management, authentication checks, and security features
 */

import { Request, Response, NextFunction } from 'express';
import { SessionStore, SessionData } from '../services/redis/sessionStore';
import { getRedisClient } from '../services/redis/redisClient';
import { AppError, ErrorCodes } from './errorHandler';

// Re-export SessionData for convenience
export type { SessionData } from '../services/redis/sessionStore';

// Extend Express Request interface to include custom session
declare global {
  namespace Express {
    interface Request {
      customSession?: SessionData;
      customSessionId?: string;
      // Keep original session type for compatibility
    }
  }
}

export interface SessionMiddlewareConfig {
  cookieName: string;
  secure: boolean;
  httpOnly: boolean;
  sameSite: 'strict' | 'lax' | 'none';
  maxAge: number;
  domain?: string;
  path: string;
}

export class SessionMiddleware {
  private sessionStore: SessionStore;
  private config: SessionMiddlewareConfig;

  constructor(config?: Partial<SessionMiddlewareConfig>) {
    const redisClient = getRedisClient();
    this.sessionStore = new SessionStore(redisClient);
    
    this.config = {
      cookieName: 'travel_agent_session',
      secure: process.env.NODE_ENV === 'production',
      httpOnly: true,
      sameSite: 'strict',
      maxAge: 24 * 60 * 60 * 1000, // 24 hours in milliseconds
      path: '/',
      ...config
    };
  }

  /**
   * Main session middleware
   */
  middleware() {
    return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        // Extract session ID from cookie
        const sessionId = this.extractSessionId(req);
        
        if (sessionId) {
          // Validate and load session
          const sessionResult = await this.sessionStore.validateSession(sessionId);
          
          if (sessionResult.ok && sessionResult.value) {
            req.customSession = sessionResult.value;
            req.customSessionId = sessionId;
            
            // Update last activity and extend cookie
            this.setCookie(res, sessionId);
          } else {
            // Invalid session - clear cookie
            this.clearCookie(res);
            req.customSession = null;
            req.customSessionId = undefined;
          }
        } else {
          req.customSession = null;
          req.customSessionId = undefined;
        }

        next();
      } catch (error) {
        console.error('Session middleware error:', error);
        req.customSession = null;
        req.customSessionId = undefined;
        next();
      }
    };
  }

  /**
   * Create a new session for authenticated user
   */
  async createSession(
    res: Response,
    userId: string,
    email: string,
    metadata?: Record<string, any>
  ): Promise<string> {
    const sessionData = {
      userId,
      email,
      isAuthenticated: true,
      metadata
    };

    const sessionResult = await this.sessionStore.createSession(sessionData);
    
    if (!sessionResult.ok) {
      throw new AppError(500, 'Failed to create session', ErrorCodes.DATABASE_ERROR);
    }

    const sessionId = sessionResult.value;
    this.setCookie(res, sessionId);
    
    return sessionId;
  }

  /**
   * Destroy current session
   */
  async destroySession(req: Request, res: Response): Promise<void> {
    if (req.customSessionId) {
      await this.sessionStore.deleteSession(req.customSessionId);
      this.clearCookie(res);
      req.customSession = null;
      req.customSessionId = undefined;
    }
  }

  /**
   * Destroy all sessions for a user
   */
  async destroyUserSessions(userId: string): Promise<number> {
    const result = await this.sessionStore.deleteUserSessions(userId);
    return result.ok ? result.value : 0;
  }

  /**
   * Update session data
   */
  async updateSession(req: Request, sessionData: Partial<SessionData>): Promise<void> {
    if (!req.customSessionId || !req.customSession) {
      throw new AppError(400, 'No active session to update', ErrorCodes.VALIDATION_ERROR);
    }

    const updatedData = { ...req.customSession, ...sessionData };
    const result = await this.sessionStore.updateSession(req.customSessionId, updatedData);
    
    if (!result.ok) {
      throw new AppError(500, 'Failed to update session', ErrorCodes.DATABASE_ERROR);
    }

    req.customSession = updatedData;
  }

  /**
   * Get all sessions for a user
   */
  async getUserSessions(userId: string): Promise<SessionData[]> {
    const result = await this.sessionStore.getUserSessions(userId);
    return result.ok ? result.value : [];
  }

  private extractSessionId(req: Request): string | null {
    // Try cookie first
    const cookieValue = req.cookies?.[this.config.cookieName];
    if (cookieValue) {
      return cookieValue;
    }

    // Fallback to Authorization header for API clients
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Session ')) {
      return authHeader.substring(8);
    }

    return null;
  }

  private setCookie(res: Response, sessionId: string): void {
    res.cookie(this.config.cookieName, sessionId, {
      httpOnly: this.config.httpOnly,
      secure: this.config.secure,
      sameSite: this.config.sameSite,
      maxAge: this.config.maxAge,
      domain: this.config.domain,
      path: this.config.path
    });
  }

  private clearCookie(res: Response): void {
    res.clearCookie(this.config.cookieName, {
      httpOnly: this.config.httpOnly,
      secure: this.config.secure,
      sameSite: this.config.sameSite,
      domain: this.config.domain,
      path: this.config.path
    });
  }
}

// Singleton instance
let sessionMiddleware: SessionMiddleware | null = null;

export const getSessionMiddleware = (): SessionMiddleware => {
  if (!sessionMiddleware) {
    sessionMiddleware = new SessionMiddleware();
  }
  return sessionMiddleware;
};

/**
 * Middleware to require authentication
 */
export const requireAuth = (req: Request, res: Response, next: NextFunction): void => {
  if (!req.customSession || !req.customSession.isAuthenticated) {
    res.status(401).json({
      success: false,
      error: {
        code: ErrorCodes.UNAUTHORIZED,
        message: 'Authentication required'
      }
    });
    return;
  }
  
  next();
};

/**
 * Middleware to require specific user (for user-specific endpoints)
 */
export const requireUser = (userIdParam: string = 'userId') => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.customSession || !req.customSession.isAuthenticated) {
      res.status(401).json({
        success: false,
        error: {
          code: ErrorCodes.UNAUTHORIZED,
          message: 'Authentication required'
        }
      });
      return;
    }

    const requestedUserId = req.params[userIdParam];
    if (requestedUserId && requestedUserId !== req.customSession.userId) {
      res.status(403).json({
        success: false,
        error: {
          code: ErrorCodes.FORBIDDEN,
          message: 'Access denied'
        }
      });
      return;
    }

    next();
  };
};

/**
 * Middleware to attach session info to response locals
 */
export const attachSessionInfo = (req: Request, res: Response, next: NextFunction): void => {
  res.locals.session = req.customSession;
  res.locals.isAuthenticated = req.customSession?.isAuthenticated || false;
  res.locals.userId = req.customSession?.userId;
  next();
};

/**
 * Helper to get session data from request
 */
export const getSessionData = (req: Request): SessionData | undefined => {
  return req.customSession;
};

/**
 * Helper to get session ID from request
 */
export const getSessionId = (req: Request): string | undefined => {
  return req.customSessionId;
};

/**
 * Session health check middleware
 */
export const sessionHealthCheck = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const redisClient = getRedisClient();
    const pingResult = await redisClient.ping();
    
    if (!pingResult.ok) {
      throw new Error('Redis connection failed');
    }
    
    next();
  } catch (error) {
    res.status(503).json({
      success: false,
      error: {
        code: ErrorCodes.SERVICE_UNAVAILABLE,
        message: 'Session service unavailable'
      }
    });
  }
};