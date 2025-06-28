import { Router, Request, Response, NextFunction } from 'express';
import { createTimestamp } from '@/services/auth/functional/types';
import { isErr } from '@/utils/result';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { authServiceWrapper as authService } from '@/services/auth/authServiceWrapper';
import { AppError } from '@/middleware/errorHandler';
import { createRequestLogger } from '@/utils/logger';
import { getSessionMiddleware, requireAuth, attachSessionInfo, getSessionData, getSessionId } from '@/middleware/session';
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
const sessionMiddleware = getSessionMiddleware();

// Rate limiting configurations
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: AUTH_CONSTANTS.RATE_LIMITS.LOGIN_ATTEMPTS,
  message: {
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many authentication attempts. Please try again in 15 minutes.',
      timestamp: createTimestamp(),
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
        timestamp: createTimestamp(),
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
      timestamp: createTimestamp(),
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
      timestamp: createTimestamp(),
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Apply session middleware to all routes
router.use(sessionMiddleware.middleware());
router.use(attachSessionInfo);

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
            timestamp: createTimestamp(),
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

      const result = await authService.register(req.body);

      if (!isErr(result)) {
        requestLogger.info('User registration successful', {
          userId: result.value.user.id,
          email: result.value.user.email,
        });

        res.status(201).json({
          success: true,
          data: result.value
        });
      } else {
        requestLogger.warn('User registration failed', {
          errorType: result.error.type,
          message: result.error.message,
          email: req.body.email,
        });

        // Map auth error types to HTTP status codes
        const statusCode = getStatusCodeFromAuthError(result.error.type);
        res.status(statusCode).json({
          success: false,
          error: result.error
        });
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
      requestLogger.info('Login attempt started', {
        email: req.body.email,
        rememberMe: req.body.rememberMe,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
      });

      // Validate user credentials
      const loginResult = await authService.validateCredentials(req.body.email, req.body.password);
      
      if (!loginResult.success) {
        requestLogger.warn('User login failed - invalid credentials', {
          email: req.body.email,
          message: loginResult.message,
        });

        res.status(401).json({
          success: false,
          error: {
            code: 'INVALID_CREDENTIALS',
            message: 'Invalid email or password',
            timestamp: createTimestamp(),
          },
        });
        return;
      }

      const user = loginResult.user;
      
      // Create session
      const sessionId = await sessionMiddleware.createSession(
        res,
        user.id,
        user.email,
        {
          ipAddress: req.ip,
          userAgent: req.get('User-Agent'),
          rememberMe: req.body.rememberMe,
          loginTime: new Date().toISOString()
        }
      );

      requestLogger.info('User login successful', {
        userId: user.id,
        email: user.email,
        sessionId,
      });

      res.status(200).json({
        success: true,
        data: {
          user: {
            id: user.id,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
          },
          sessionId,
          message: 'Login successful',
        },
        timestamp: createTimestamp(),
      });
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
  requireAuth,
  validateRequest(LogoutRequestSchema.optional()),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const requestLogger = createRequestLogger(req.id || uuidv4());

    try {
      const sessionId = getSessionId(req);
      const userId = getSessionData(req)?.userId;

      requestLogger.info('Logout attempt started', {
        userId,
        sessionId,
        ip: req.ip,
      });

      // Destroy the session
      await sessionMiddleware.destroySession(req, res);

      requestLogger.info('User logout successful', {
        userId,
        sessionId,
      });

      res.status(200).json({
        success: true,
        message: 'Logout successful',
        timestamp: createTimestamp(),
      });
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
  requireAuth,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const requestLogger = createRequestLogger(req.id || uuidv4());

    try {
      const userId = getSessionData(req)?.userId;
      const sessionId = getSessionId(req);

      requestLogger.info('Current user request', {
        userId,
        sessionId,
        ip: req.ip,
      });

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
            timestamp: createTimestamp(),
          },
        });
        return;
      }

      requestLogger.info('Current user request successful', {
        userId,
        email: getSessionData(req)?.email,
      });

      res.status(200).json({
        success: true,
        data: {
          user: {
            id: userProfile.id,
            email: userProfile.email,
            firstName: userProfile.firstName,
            lastName: userProfile.lastName,
          },
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
            loginTime: getSessionData(req)?.loginTime,
            lastActivity: getSessionData(req)?.lastActivity,
          },
        },
        timestamp: createTimestamp(),
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
          timestamp: createTimestamp(),
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

      const result = await authService.requestPasswordReset(req.body.email);

      if (!isErr(result)) {
        requestLogger.info('Password reset request successful', {
          email: req.body.email,
          tokenGenerated: !!result.value.token,
        });

        res.status(200).json({
          success: true,
          message: result.value.message,
          // In production, don't return the token - send it via email
          ...(process.env.NODE_ENV !== 'production' &&
            result.value.token && {
              debug: { resetToken: result.value.token },
            }),
          timestamp: createTimestamp(),
        });
      } else {
        requestLogger.warn('Password reset request failed', {
          email: req.body.email,
          message: result.error.message,
        });

        res.status(400).json({
          success: false,
          error: {
            code: 'PASSWORD_RESET_FAILED',
            message: result.error.message,
            timestamp: createTimestamp(),
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

      if (!isErr(result)) {
        
        requestLogger.info('Password reset successful', {
          userId: result.value.user.id,
          email: result.value.user.email,
        });

        res.status(200).json({ success: true, data: result.value });
      } else {
        
        requestLogger.warn('Password reset failed', {
          errorType: result.error.type,
          message: result.error.message,
          token: req.body.token.substring(0, 8) + '...',
        });

        const statusCode = getStatusCodeFromAuthError(result.error.type);
        res.status(statusCode).json({ success: false, error: result.error });
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
