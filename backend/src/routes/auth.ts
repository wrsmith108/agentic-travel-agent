import { Router, Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { authService } from '@/services/auth/authService';
import { AppError } from '@/middleware/errorHandler';
import { createRequestLogger } from '@/utils/logger';
import {
  RegisterRequestSchema,
  LoginRequestSchema,
  PasswordResetRequestSchema,
  PasswordResetConfirmSchema,
  TokenRefreshRequestSchema,
  LogoutRequestSchema,
  AuthSuccessResponse,
  AuthErrorResponse,
  AUTH_CONSTANTS,
} from '@/schemas/auth';

const router = Router();

// Rate limiting configurations
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: AUTH_CONSTANTS.RATE_LIMITS.LOGIN_ATTEMPTS,
  message: {
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many authentication attempts. Please try again in 15 minutes.',
      timestamp: new Date().toISOString(),
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req: Request, res: Response) => {
    const requestLogger = createRequestLogger(req.id || uuidv4());
    requestLogger.warn('Rate limit exceeded for auth endpoint', {
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      endpoint: req.originalUrl,
    });

    res.status(429).json({
      success: false,
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Too many authentication attempts. Please try again in 15 minutes.',
        timestamp: new Date().toISOString(),
      },
    });
  },
});

const passwordResetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: AUTH_CONSTANTS.RATE_LIMITS.PASSWORD_RESET,
  message: {
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many password reset attempts. Please try again in 1 hour.',
      timestamp: new Date().toISOString(),
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
});

const registrationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: AUTH_CONSTANTS.RATE_LIMITS.REGISTRATION,
  message: {
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many registration attempts. Please try again in 1 hour.',
      timestamp: new Date().toISOString(),
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// JWT Authentication middleware
const authenticateJWT = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const requestLogger = createRequestLogger(req.id || uuidv4());

  try {
    const authHeader = req.header('Authorization');
    const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.substring(7) : null;

    if (!token) {
      requestLogger.warn('Authentication attempt without token', {
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        endpoint: req.originalUrl,
      });

      res.status(401).json({
        success: false,
        error: {
          code: 'AUTHENTICATION_REQUIRED',
          message: 'Access token is required',
          timestamp: new Date().toISOString(),
        },
      });
      return;
    }

    const payload = await authService.validateJWTToken(token);
    if (!payload) {
      requestLogger.warn('Invalid JWT token provided', {
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        endpoint: req.originalUrl,
      });

      res.status(401).json({
        success: false,
        error: {
          code: 'TOKEN_INVALID',
          message: 'Invalid or expired access token',
          timestamp: new Date().toISOString(),
        },
      });
      return;
    }

    // Add user info to request
    (req as any).user = payload;
    (req as any).sessionId = payload.sessionId;

    next();
  } catch (error) {
    requestLogger.error('JWT authentication failed', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'AUTHENTICATION_ERROR',
        message: 'Authentication system error',
        timestamp: new Date().toISOString(),
      },
    });
  }
};

// Request validation middleware factory
const validateRequest = <T extends z.ZodSchema>(schema: T) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const requestLogger = createRequestLogger(req.id || uuidv4());

    try {
      schema.parse(req.body);
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        requestLogger.warn('Request validation failed', {
          errors: error.errors,
          body: req.body,
          endpoint: req.originalUrl,
        });

        res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Request validation failed',
            details: error.errors,
            timestamp: new Date().toISOString(),
          },
        });
      } else {
        next(error);
      }
    }
  };
};

// Helper function to get device info from request
const getDeviceInfo = (req: Request) => ({
  userAgent: req.get('User-Agent'),
  ipAddress: req.ip,
  fingerprint: req.get('X-Device-Fingerprint'),
});

// Routes

/**
 * POST /api/v1/auth/register
 * User registration endpoint
 */
router.post(
  '/register',
  registrationLimiter,
  validateRequest(RegisterRequestSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const requestLogger = createRequestLogger(req.id || uuidv4());

    try {
      requestLogger.info('Registration attempt started', {
        email: req.body.email,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
      });

      const result = await authService.registerUser(req.body);

      if (result.success) {
        const successResult = result as AuthSuccessResponse;
        requestLogger.info('User registration successful', {
          userId: successResult.data.user.id,
          email: successResult.data.user.email,
        });

        res.status(201).json(result);
      } else {
        const errorResult = result as AuthErrorResponse;
        requestLogger.warn('User registration failed', {
          errorType: errorResult.error.type,
          message: errorResult.error.message,
          email: req.body.email,
        });

        // Map auth error types to HTTP status codes
        const statusCode = getStatusCodeFromAuthError(errorResult.error.type);
        res.status(statusCode).json(result);
      }
    } catch (error) {
      requestLogger.error('Registration endpoint error', error);
      next(new AppError(500, 'Registration failed due to server error', 'AUTH_REGISTER_ERROR'));
    }
  }
);

/**
 * POST /api/v1/auth/login
 * User login endpoint
 */
router.post(
  '/login',
  authLimiter,
  validateRequest(LoginRequestSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const requestLogger = createRequestLogger(req.id || uuidv4());

    try {
      // Add device info to request body
      const loginData = {
        ...req.body,
        deviceInfo: getDeviceInfo(req),
      };

      requestLogger.info('Login attempt started', {
        email: req.body.email,
        rememberMe: req.body.rememberMe,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
      });

      const result = await authService.loginUser(loginData);

      if (result.success) {
        const successResult = result as AuthSuccessResponse;
        requestLogger.info('User login successful', {
          userId: successResult.data.user.id,
          email: successResult.data.user.email,
          sessionId: successResult.data.sessionId,
        });

        res.status(200).json(result);
      } else {
        const errorResult = result as AuthErrorResponse;
        requestLogger.warn('User login failed', {
          errorType: errorResult.error.type,
          message: errorResult.error.message,
          email: req.body.email,
        });

        const statusCode = getStatusCodeFromAuthError(errorResult.error.type);
        res.status(statusCode).json(result);
      }
    } catch (error) {
      requestLogger.error('Login endpoint error', error);
      next(new AppError(500, 'Login failed due to server error', 'AUTH_LOGIN_ERROR'));
    }
  }
);

/**
 * POST /api/v1/auth/logout
 * User logout endpoint
 */
router.post(
  '/logout',
  authenticateJWT,
  validateRequest(LogoutRequestSchema.optional()),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const requestLogger = createRequestLogger(req.id || uuidv4());

    try {
      const sessionId = (req as any).sessionId || req.body?.sessionId;
      const userId = (req as any).user?.sub;

      requestLogger.info('Logout attempt started', {
        userId,
        sessionId,
        ip: req.ip,
      });

      const result = await authService.logoutUser(sessionId);

      if (result.success) {
        requestLogger.info('User logout successful', {
          userId,
          sessionId,
        });

        res.status(200).json({
          success: true,
          message: result.message,
          timestamp: new Date().toISOString(),
        });
      } else {
        requestLogger.warn('User logout failed', {
          userId,
          sessionId,
          message: result.message,
        });

        res.status(400).json({
          success: false,
          error: {
            code: 'LOGOUT_FAILED',
            message: result.message,
            timestamp: new Date().toISOString(),
          },
        });
      }
    } catch (error) {
      requestLogger.error('Logout endpoint error', error);
      next(new AppError(500, 'Logout failed due to server error', 'AUTH_LOGOUT_ERROR'));
    }
  }
);

/**
 * GET /api/v1/auth/me
 * Get current user information
 */
router.get(
  '/me',
  authenticateJWT,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const requestLogger = createRequestLogger(req.id || uuidv4());

    try {
      const userId = (req as any).user?.sub;
      const sessionId = (req as any).sessionId;

      requestLogger.info('Current user request', {
        userId,
        sessionId,
        ip: req.ip,
      });

      // Validate session is still active
      const sessionUser = await authService.validateSession(sessionId);
      if (!sessionUser) {
        requestLogger.warn('Session validation failed for current user request', {
          userId,
          sessionId,
        });

        res.status(401).json({
          success: false,
          error: {
            code: 'SESSION_EXPIRED',
            message: 'Session has expired. Please log in again.',
            timestamp: new Date().toISOString(),
          },
        });
        return;
      }

      // Get full user profile
      const userProfile = await authService.getUserById(userId);
      if (!userProfile) {
        requestLogger.error('User profile not found for authenticated user', {
          userId,
          sessionId,
        });

        res.status(404).json({
          success: false,
          error: {
            code: 'USER_NOT_FOUND',
            message: 'User profile not found',
            timestamp: new Date().toISOString(),
          },
        });
        return;
      }

      requestLogger.info('Current user request successful', {
        userId,
        email: sessionUser.email,
      });

      res.status(200).json({
        success: true,
        data: {
          user: sessionUser,
          profile: {
            id: userProfile.id,
            firstName: userProfile.firstName,
            lastName: userProfile.lastName,
            email: userProfile.email,
            preferences: userProfile.preferences,
            createdAt: userProfile.createdAt,
            updatedAt: userProfile.updatedAt,
          },
          session: {
            sessionId,
            isActive: true,
          },
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      requestLogger.error('Current user endpoint error', error);
      next(new AppError(500, 'Failed to get current user', 'AUTH_CURRENT_USER_ERROR'));
    }
  }
);

/**
 * POST /api/v1/auth/refresh
 * Refresh JWT token
 */
router.post(
  '/refresh',
  validateRequest(TokenRefreshRequestSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const requestLogger = createRequestLogger(req.id || uuidv4());

    try {
      requestLogger.info('Token refresh attempt started', {
        ip: req.ip,
        userAgent: req.get('User-Agent'),
      });

      // For now, return an error indicating refresh tokens are not implemented
      // In a full implementation, you would:
      // 1. Validate the refresh token
      // 2. Check if it's not expired or revoked
      // 3. Generate new access token
      // 4. Optionally rotate the refresh token

      requestLogger.warn('Token refresh not implemented', {
        ip: req.ip,
        userAgent: req.get('User-Agent'),
      });

      res.status(501).json({
        success: false,
        error: {
          code: 'NOT_IMPLEMENTED',
          message: 'Token refresh is not yet implemented. Please log in again.',
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      requestLogger.error('Token refresh endpoint error', error);
      next(new AppError(500, 'Token refresh failed due to server error', 'AUTH_REFRESH_ERROR'));
    }
  }
);

/**
 * POST /api/v1/auth/forgot-password
 * Password reset request
 */
router.post(
  '/forgot-password',
  passwordResetLimiter,
  validateRequest(PasswordResetRequestSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const requestLogger = createRequestLogger(req.id || uuidv4());

    try {
      requestLogger.info('Password reset request started', {
        email: req.body.email,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
      });

      const result = await authService.requestPasswordReset(req.body);

      if (result.success) {
        requestLogger.info('Password reset request successful', {
          email: req.body.email,
          tokenGenerated: !!result.token,
        });

        res.status(200).json({
          success: true,
          message: result.message,
          // In production, don't return the token - send it via email
          ...(process.env.NODE_ENV !== 'production' &&
            result.token && {
              debug: { resetToken: result.token },
            }),
          timestamp: new Date().toISOString(),
        });
      } else {
        requestLogger.warn('Password reset request failed', {
          email: req.body.email,
          message: result.message,
        });

        res.status(400).json({
          success: false,
          error: {
            code: 'PASSWORD_RESET_FAILED',
            message: result.message,
            timestamp: new Date().toISOString(),
          },
        });
      }
    } catch (error) {
      requestLogger.error('Password reset request endpoint error', error);
      next(
        new AppError(
          500,
          'Password reset request failed due to server error',
          'AUTH_FORGOT_PASSWORD_ERROR'
        )
      );
    }
  }
);

/**
 * POST /api/v1/auth/reset-password
 * Password reset confirmation
 */
router.post(
  '/reset-password',
  validateRequest(PasswordResetConfirmSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const requestLogger = createRequestLogger(req.id || uuidv4());

    try {
      requestLogger.info('Password reset confirmation started', {
        token: req.body.token.substring(0, 8) + '...',
        ip: req.ip,
        userAgent: req.get('User-Agent'),
      });

      const result = await authService.resetPassword(req.body);

      if (result.success) {
        const successResult = result as AuthSuccessResponse;
        requestLogger.info('Password reset successful', {
          userId: successResult.data.user.id,
          email: successResult.data.user.email,
        });

        res.status(200).json(result);
      } else {
        const errorResult = result as AuthErrorResponse;
        requestLogger.warn('Password reset failed', {
          errorType: errorResult.error.type,
          message: errorResult.error.message,
          token: req.body.token.substring(0, 8) + '...',
        });

        const statusCode = getStatusCodeFromAuthError(errorResult.error.type);
        res.status(statusCode).json(result);
      }
    } catch (error) {
      requestLogger.error('Password reset confirmation endpoint error', error);
      next(
        new AppError(500, 'Password reset failed due to server error', 'AUTH_RESET_PASSWORD_ERROR')
      );
    }
  }
);

// Helper function to map auth error types to HTTP status codes
function getStatusCodeFromAuthError(errorType: string): number {
  switch (errorType) {
    case 'INVALID_CREDENTIALS':
    case 'TOKEN_INVALID':
    case 'TOKEN_EXPIRED':
    case 'EMAIL_NOT_VERIFIED':
      return 401;
    case 'USER_NOT_FOUND':
      return 404;
    case 'USER_ALREADY_EXISTS':
      return 409;
    case 'ACCOUNT_LOCKED':
    case 'ACCOUNT_SUSPENDED':
      return 403;
    case 'RATE_LIMIT_EXCEEDED':
      return 429;
    case 'VALIDATION_ERROR':
      return 400;
    case 'INSUFFICIENT_PERMISSIONS':
      return 403;
    case 'SESSION_EXPIRED':
      return 401;
    case 'SERVER_ERROR':
    case 'NETWORK_ERROR':
    case 'UNKNOWN_ERROR':
    default:
      return 500;
  }
}

export default router;
