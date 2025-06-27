import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { authService } from '@/services/auth/authService';
import { AppError, ErrorCodes } from './errorHandler';
import { createRequestLogger } from '@/utils/logger';
import { JWTPayload, SessionUser } from '@/schemas/auth';

/**
 * Extended Request interface to include authenticated user data
 */
export interface AuthenticatedRequest extends Request {
  jwtPayload?: JWTPayload; // Renamed to avoid conflict with global Express user type
  sessionUser?: SessionUser;
  sessionId?: string;
  requestId?: string; // Made optional since it's added during middleware execution
  id?: string; // From global Express extension in server.ts
}

/**
 * User roles for role-based access control
 */
export enum UserRole {
  USER = 'user',
  ADMIN = 'admin',
  MODERATOR = 'moderator',
}

/**
 * Authentication middleware configuration
 */
export interface AuthMiddlewareConfig {
  skipExpiredCheck?: boolean;
  includeUserProfile?: boolean;
  logRequests?: boolean;
}

/**
 * Role-based access configuration
 */
export interface RoleConfig {
  requiredRoles: UserRole[];
  requireAll?: boolean; // If true, user must have ALL roles, otherwise ANY role
}

/**
 * Extract JWT token from request headers
 */
const extractTokenFromRequest = (req: Request): string | null => {
  // Check Authorization header (Bearer token)
  const authHeader = req.header('Authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }

  // Check x-access-token header (alternative format)
  const tokenHeader = req.header('x-access-token');
  if (tokenHeader) {
    return tokenHeader;
  }

  // Check cookies (for web apps)
  if (req.cookies && req.cookies.access_token) {
    return req.cookies.access_token;
  }

  return null;
};

/**
 * Get device information from request for logging
 */
const getDeviceInfo = (req: Request) => ({
  userAgent: req.get('User-Agent'),
  ipAddress: req.ip || req.connection.remoteAddress,
  fingerprint: req.get('X-Device-Fingerprint'),
});

/**
 * Create standardized auth error response
 */
const createAuthErrorResponse = (
  code: string,
  message: string,
  details?: unknown,
  requestId?: string
) => ({
  success: false,
  error: {
    code,
    message,
    details,
    timestamp: new Date().toISOString(),
  },
  meta: {
    requestId: requestId || uuidv4(),
    timestamp: new Date().toISOString(),
  },
});

/**
 * requireAuth - Middleware that requires valid authentication
 *
 * This middleware:
 * - Validates JWT token presence and authenticity
 * - Verifies session is still active
 * - Enhances request with user data
 * - Logs authentication attempts
 * - Handles all authentication errors gracefully
 *
 * @param config - Optional configuration for middleware behavior
 */
export const requireAuth = (config: AuthMiddlewareConfig = {}) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const requestId = req.id || uuidv4();
    const requestLogger = config.logRequests !== false ? createRequestLogger(requestId) : null;
    
    // Type assertion with proper interface extension
    const authReq = req as unknown as AuthenticatedRequest;
    authReq.requestId = requestId;

    try {
      // Extract token from request
      const token = extractTokenFromRequest(req);

      if (!token) {
        requestLogger?.warn('Authentication required - no token provided', {
          endpoint: req.originalUrl,
          method: req.method,
          ...getDeviceInfo(req),
        });

        res
          .status(401)
          .json(
            createAuthErrorResponse(
              ErrorCodes.AUTHENTICATION_REQUIRED,
              'Access token is required',
              undefined,
              requestId
            )
          );
        return;
      }

      // Validate JWT token
      const jwtPayload = await authService.validateJWTToken(token);
      if (!jwtPayload) {
        requestLogger?.warn('Authentication failed - invalid token', {
          endpoint: req.originalUrl,
          method: req.method,
          tokenPrefix: token.substring(0, 10) + '...',
          ...getDeviceInfo(req),
        });

        res
          .status(401)
          .json(
            createAuthErrorResponse(
              ErrorCodes.INVALID_TOKEN,
              'Invalid or expired access token',
              undefined,
              requestId
            )
          );
        return;
      }

      // Get session user data (validateJWTToken already validated the session)
      const sessionUser = await authService.validateSession(jwtPayload.sessionId);
      if (sessionUser) {
        authReq.sessionUser = sessionUser;
      }

      // Add authenticated user data to request
      authReq.jwtPayload = jwtPayload;
      authReq.sessionId = jwtPayload.sessionId;
      
      // Also add user in the format expected by the global Express type
      // (for compatibility with authNew.ts global declaration)
      (req as any).user = {
        id: jwtPayload.sub,
        email: jwtPayload.email,
        role: jwtPayload.role,
        sessionId: jwtPayload.sessionId,
      };

      // Optionally include full user profile
      if (config.includeUserProfile) {
        const userProfile = await authService.getUserById(jwtPayload.sub);
        if (userProfile) {
          (authReq as any).userProfile = userProfile;
        }
      }

      requestLogger?.info('Authentication successful', {
        userId: jwtPayload.sub,
        email: jwtPayload.email,
        role: jwtPayload.role,
        sessionId: jwtPayload.sessionId,
        endpoint: req.originalUrl,
      });

      next();
    } catch (error) {
      requestLogger?.error('Authentication middleware error', error, {
        endpoint: req.originalUrl,
        method: req.method,
        ...getDeviceInfo(req),
      });

      // Handle specific error types
      if (error instanceof z.ZodError) {
        res
          .status(400)
          .json(
            createAuthErrorResponse(
              ErrorCodes.VALIDATION_ERROR,
              'Invalid authentication data',
              error.errors,
              requestId
            )
          );
        return;
      }

      res
        .status(500)
        .json(
          createAuthErrorResponse(
            ErrorCodes.INTERNAL_SERVER_ERROR,
            'Authentication system error',
            undefined,
            requestId
          )
        );
    }
  };
};

/**
 * optionalAuth - Middleware that optionally authenticates requests
 *
 * This middleware:
 * - Attempts authentication if token is present
 * - Continues without authentication if no token
 * - Enhances request with user data when authenticated
 * - Never blocks the request
 *
 * @param config - Optional configuration for middleware behavior
 */
export const optionalAuth = (config: AuthMiddlewareConfig = {}) => {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    const requestId = req.id || uuidv4();
    const requestLogger = config.logRequests !== false ? createRequestLogger(requestId) : null;
    
    // Type assertion with proper interface extension
    const authReq = req as unknown as AuthenticatedRequest;
    authReq.requestId = requestId;

    try {
      // Extract token from request
      const token = extractTokenFromRequest(req);

      // If no token provided, continue without authentication
      if (!token) {
        requestLogger?.info('Optional authentication - no token provided', {
          endpoint: req.originalUrl,
          method: req.method,
        });
        next();
        return;
      }

      // Attempt to validate JWT token
      const jwtPayload = await authService.validateJWTToken(token);
      if (!jwtPayload) {
        requestLogger?.info('Optional authentication - invalid token (continuing)', {
          endpoint: req.originalUrl,
          tokenPrefix: token.substring(0, 10) + '...',
        });
        next();
        return;
      }

      // Validate session is still active (unless skipped in config)
      let sessionUser: SessionUser | null = null;
      if (!config.skipExpiredCheck) {
        sessionUser = await authService.validateSession(jwtPayload.sessionId);
        if (!sessionUser) {
          requestLogger?.info('Optional authentication - session expired (continuing)', {
            userId: jwtPayload.sub,
            sessionId: jwtPayload.sessionId,
            endpoint: req.originalUrl,
          });
          next();
          return;
        }

        // Add session user data to request
        authReq.sessionUser = sessionUser;
      }

      // Add authenticated user data to request
      authReq.jwtPayload = jwtPayload;
      authReq.sessionId = jwtPayload.sessionId;
      
      // Also add user in the format expected by the global Express type
      // (for compatibility with authNew.ts global declaration)
      (req as any).user = {
        id: jwtPayload.sub,
        email: jwtPayload.email,
        role: jwtPayload.role,
        sessionId: jwtPayload.sessionId,
      };

      // Optionally include full user profile
      if (config.includeUserProfile) {
        const userProfile = await authService.getUserById(jwtPayload.sub);
        if (userProfile) {
          (authReq as any).userProfile = userProfile;
        }
      }

      requestLogger?.info('Optional authentication successful', {
        userId: jwtPayload.sub,
        email: jwtPayload.email,
        role: jwtPayload.role,
        sessionId: jwtPayload.sessionId,
        endpoint: req.originalUrl,
      });

      next();
    } catch (error) {
      requestLogger?.warn('Optional authentication error (continuing)', error, {
        endpoint: req.originalUrl,
        method: req.method,
      });

      // For optional auth, we continue even on errors
      next();
    }
  };
};

/**
 * requireRole - Middleware that requires specific user roles
 *
 * This middleware:
 * - Requires authentication (must be used after requireAuth)
 * - Validates user has required role(s)
 * - Supports multiple role configurations
 * - Logs authorization attempts
 *
 * @param roles - Single role or array of roles, or role configuration object
 * @param config - Optional configuration for middleware behavior
 */
export const requireRole = (
  roles: UserRole | UserRole[] | RoleConfig,
  config: AuthMiddlewareConfig = {}
) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const requestId = req.id || uuidv4();
    const requestLogger = config.logRequests !== false ? createRequestLogger(requestId) : null;
    
    // Type assertion with proper interface extension
    const authReq = req as unknown as AuthenticatedRequest;
    
    // Ensure requestId is set
    if (!authReq.requestId) {
      authReq.requestId = requestId;
    }

    try {
      // Ensure user is authenticated and has session user
      if (!authReq.sessionUser) {
        requestLogger?.error('Role check attempted without authentication', {
          endpoint: req.originalUrl,
          method: req.method,
        });

        res
          .status(401)
          .json(
            createAuthErrorResponse(
              ErrorCodes.AUTHENTICATION_REQUIRED,
              'Authentication required for role-based access',
              undefined,
              requestId
            )
          );
        return;
      }

      const userRole = authReq.sessionUser.role as UserRole;

      // Normalize roles configuration
      let roleConfig: RoleConfig;
      if (typeof roles === 'string') {
        roleConfig = { requiredRoles: [roles as UserRole], requireAll: false };
      } else if (Array.isArray(roles)) {
        roleConfig = { requiredRoles: roles as UserRole[], requireAll: false };
      } else {
        roleConfig = roles as RoleConfig;
      }

      // Check role requirements
      const hasRequiredRole = roleConfig.requireAll
        ? roleConfig.requiredRoles.every((role) => userRole === role || userRole === UserRole.ADMIN)
        : roleConfig.requiredRoles.some((role) => userRole === role || userRole === UserRole.ADMIN);

      if (!hasRequiredRole) {
        requestLogger?.warn('Authorization failed - insufficient permissions', {
          userId: authReq.sessionUser?.id,
          userRole,
          requiredRoles: roleConfig.requiredRoles,
          requireAll: roleConfig.requireAll,
          endpoint: req.originalUrl,
        });

        res.status(403).json(
          createAuthErrorResponse(
            ErrorCodes.AUTHORIZATION_FAILED,
            'Insufficient permissions to access this resource',
            {
              userRole,
              requiredRoles: roleConfig.requiredRoles,
            },
            requestId
          )
        );
        return;
      }

      requestLogger?.info('Authorization successful', {
        userId: authReq.sessionUser.id,
        userRole,
        requiredRoles: roleConfig.requiredRoles,
        endpoint: req.originalUrl,
      });

      next();
    } catch (error) {
      requestLogger?.error('Role authorization middleware error', error, {
        endpoint: req.originalUrl,
        method: req.method,
        userId: authReq.sessionUser?.id,
      });

      res
        .status(500)
        .json(
          createAuthErrorResponse(ErrorCodes.INTERNAL_SERVER_ERROR, 'Authorization system error')
        );
    }
  };
};

/**
 * Utility middleware to check if user is authenticated (for conditional logic)
 */
export const isAuthenticated = (req: Request): boolean => {
  const authReq = req as unknown as AuthenticatedRequest;
  return !!(authReq.jwtPayload && authReq.sessionUser);
};

/**
 * Utility middleware to get current user from request
 */
export const getCurrentUser = (req: Request): JWTPayload | undefined => {
  const authReq = req as unknown as AuthenticatedRequest;
  return authReq.jwtPayload;
};

/**
 * Utility middleware to get current session user from request
 */
export const getCurrentSessionUser = (req: Request): SessionUser | undefined => {
  const authReq = req as unknown as AuthenticatedRequest;
  return authReq.sessionUser;
};

/**
 * Utility middleware to check if user has specific role
 */
export const hasRole = (req: Request, role: UserRole | RoleConfig): boolean => {
  const authReq = req as unknown as AuthenticatedRequest;
  if (!authReq.sessionUser) return false;

  const userRole = authReq.sessionUser.role as UserRole;

  // Handle single role
  if (typeof role === 'string') {
    return userRole === role || userRole === UserRole.ADMIN;
  }

  // Handle role config
  const config = role as RoleConfig;
  if (config.requireAll) {
    return config.requiredRoles.every((r) => userRole === r || userRole === UserRole.ADMIN);
  } else {
    return config.requiredRoles.some((r) => userRole === r) || userRole === UserRole.ADMIN;
  }
};

/**
 * Utility middleware to check if user has any of the specified roles
 */
export const hasAnyRole = (req: Request, roles: UserRole[]): boolean => {
  const authReq = req as unknown as AuthenticatedRequest;
  if (!authReq.sessionUser) return false;

  const userRole = authReq.sessionUser.role as UserRole;
  return roles.some((role) => userRole === role) || userRole === UserRole.ADMIN;
};

/**
 * Utility middleware to check if user has all of the specified roles
 */
export const hasAllRoles = (req: Request, roles: UserRole[]): boolean => {
  const authReq = req as unknown as AuthenticatedRequest;
  if (!authReq.sessionUser) return false;

  const userRole = authReq.sessionUser.role as UserRole;
  if (userRole === UserRole.ADMIN) return true;

  return roles.every((role) => userRole === role);
};

/**
 * Error handler specifically for authentication errors
 */
export const authErrorHandler = (
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const requestLogger = createRequestLogger(req.id || uuidv4());

  requestLogger.error('Authentication error occurred', err, {
    endpoint: req.originalUrl,
    method: req.method,
    ...getDeviceInfo(req),
  });

  // If it's already an AppError, let the main error handler deal with it
  if (err instanceof AppError) {
    next(err);
    return;
  }

  // Handle JWT-specific errors
  if (err.name === 'JsonWebTokenError') {
    res
      .status(401)
      .json(createAuthErrorResponse(ErrorCodes.AUTHENTICATION_REQUIRED, 'Invalid access token'));
    return;
  }

  if (err.name === 'TokenExpiredError') {
    res
      .status(401)
      .json(
        createAuthErrorResponse(ErrorCodes.AUTHENTICATION_REQUIRED, 'Access token has expired')
      );
    return;
  }

  // Generic authentication error
  res
    .status(500)
    .json(
      createAuthErrorResponse(ErrorCodes.INTERNAL_SERVER_ERROR, 'Authentication system error', 500)
    );
};

/**
 * Middleware to add request context enhancement
 * This should be used early in the middleware chain
 */
export const enhanceRequestContext = (req: Request, _res: Response, next: NextFunction): void => {
  // Type assertion with proper interface extension
  const authReq = req as unknown as AuthenticatedRequest;

  // Add request ID if not already present
  if (!authReq.requestId) {
    authReq.requestId = req.id || uuidv4();
  }

  // Add device info helper
  (authReq as any).getDeviceInfo = () => getDeviceInfo(req);

  // Add authentication status helper
  (authReq as any).isAuthenticated = () => isAuthenticated(req);

  next();
};

// Export commonly used configurations
export const authConfigs = {
  // Standard authentication with full logging
  standard: { logRequests: true, includeUserProfile: false },

  // Silent authentication (minimal logging)
  silent: { logRequests: false, includeUserProfile: false },

  // Full authentication with user profile
  withProfile: { logRequests: true, includeUserProfile: true },

  // Skip session validation (useful for logout endpoints)
  skipSession: { logRequests: true, skipExpiredCheck: true },
} as const;

// Export role configurations
export const roleConfigs = {
  // Admin only
  adminOnly: { requiredRoles: [UserRole.ADMIN], requireAll: true } as RoleConfig,

  // Admin or moderator
  moderation: {
    requiredRoles: [UserRole.ADMIN, UserRole.MODERATOR],
    requireAll: false,
  } as RoleConfig,

  // Any authenticated user
  anyUser: {
    requiredRoles: [UserRole.USER, UserRole.MODERATOR, UserRole.ADMIN],
    requireAll: false,
  } as RoleConfig,
};
