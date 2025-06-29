import { Router, Request, Response, NextFunction } from 'express';
import { createTimestamp } from '@/services/auth/functional/types';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { authServiceWrapper } from '@/services/auth/authServiceWrapper';
import { AppError } from '@/middleware/errorHandler';
import { createRequestLogger } from '@/utils/logger';
import { isOk, isErr } from '@/utils/result';
import { getStatusCodeFromError } from '@/types/auth';
import {
  RegisterRequestSchema,
  LoginRequestSchema,
  PasswordResetRequestSchema,
  PasswordResetConfirmSchema,
  AUTH_CONSTANTS,
} from '@/schemas/auth';

const router = Router();

// Rate limiting configurations (same as original)
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
});

const passwordResetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: AUTH_CONSTANTS.RATE_LIMITS.PASSWORD_RESET,
  standardHeaders: true,
  legacyHeaders: false,
});

const registrationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: AUTH_CONSTANTS.RATE_LIMITS.REGISTRATION,
  standardHeaders: true,
  legacyHeaders: false,
});

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
            type: 'VALIDATION_ERROR',
            message: 'Request validation failed',
            details: error.errors,
          },
        });
      } else {
        next(error);
      }
    }
  };
};

/**
 * POST /api/v1/auth/register
 * User registration endpoint using Result pattern
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
      });

      // Call auth service that returns Result<AuthSuccess, AuthError>
      const result = await authServiceWrapper.register(req.body);

      if (isOk(result)) {
        requestLogger.info('User registration successful', {
          userId: result.value.user.id,
          email: result.value.user.email,
        });

        res.status(201).json({
          success: true,
          data: result.value,
        });
      } else {
        requestLogger.warn('User registration failed', {
          errorType: (isErr(result) ? result.error.type : ""),
          message: (isErr(result) ? result.error.message : "An error occurred"),
          email: req.body.email,
        });

        const statusCode = getStatusCodeFromError(result.error);
        res.status(statusCode).json({
          success: false,
          error: result.error,
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
 * User login endpoint using Result pattern
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
      });

      const result = await authServiceWrapper.login(req.body);

      if (isOk(result)) {
        requestLogger.info('User login successful', {
          userId: result.value.user.id,
          email: result.value.user.email,
        });

        res.status(200).json({
          success: true,
          data: result.value,
        });
      } else {
        requestLogger.warn('User login failed', {
          errorType: (isErr(result) ? result.error.type : ""),
          message: (isErr(result) ? result.error.message : "An error occurred"),
          email: req.body.email,
        });

        const statusCode = getStatusCodeFromError(result.error);
        res.status(statusCode).json({
          success: false,
          error: result.error,
        });
      }
    } catch (error) {
      requestLogger.error('Login endpoint error', error);
      next(new AppError(500, 'Login failed due to server error', 'AUTH_LOGIN_ERROR'));
    }
  }
);

/**
 * POST /api/v1/auth/logout
 * User logout endpoint using Result pattern
 */
router.post(
  '/logout',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const requestLogger = createRequestLogger(req.id || uuidv4());

    try {
      const sessionId = req.body?.sessionId || req.header('X-Session-Id');
      
      if (!sessionId) {
        res.status(400).json({
          success: false,
          error: {
            type: 'VALIDATION_ERROR',
            message: 'Session ID is required',
          },
        });
        return;
      }

      requestLogger.info('Logout attempt started', {
        sessionId,
        ip: req.ip,
      });

      const result = await authServiceWrapper.logout(sessionId);

      if (isOk(result)) {
        requestLogger.info('User logout successful', {
          sessionId,
        });

        res.status(200).json({
          success: true,
          message: 'Logged out successfully',
        });
      } else {
        requestLogger.warn('User logout failed', {
          sessionId,
          error: result.error,
        });

        const statusCode = getStatusCodeFromError(result.error);
        res.status(statusCode).json({
          success: false,
          error: result.error,
        });
      }
    } catch (error) {
      requestLogger.error('Logout endpoint error', error);
      next(new AppError(500, 'Logout failed due to server error', 'AUTH_LOGOUT_ERROR'));
    }
  }
);

/**
 * POST /api/v1/auth/forgot-password
 * Password reset request using Result pattern
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
      });

      const result = await authServiceWrapper.requestPasswordReset(req.body.email);

      if (isOk(result)) {
        requestLogger.info('Password reset request successful', {
          email: req.body.email,
        });

        // Always return the same message for security
        res.status(200).json({
          success: true,
          message: 'If an account exists with this email, you will receive password reset instructions.',
        });
      } else {
        // For security, don't reveal if user exists or not
        if ((isErr(result) ? result.error.type : "") === 'USER_NOT_FOUND') {
          res.status(200).json({
            success: true,
            message: 'If an account exists with this email, you will receive password reset instructions.',
          });
        } else {
          const statusCode = getStatusCodeFromError(result.error);
          res.status(statusCode).json({
            success: false,
            error: result.error,
          });
        }
      }
    } catch (error) {
      requestLogger.error('Password reset request endpoint error', error);
      next(new AppError(500, 'Password reset request failed', 'AUTH_FORGOT_PASSWORD_ERROR'));
    }
  }
);

/**
 * POST /api/v1/auth/reset-password
 * Password reset confirmation using Result pattern
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
      });

      const result = await authServiceWrapper.resetPassword(req.body.token, req.body.password);

      if (isOk(result)) {
        requestLogger.info('Password reset successful');

        res.status(200).json({
          success: true,
          message: 'Password has been reset successfully',
        });
      } else {
        requestLogger.warn('Password reset failed', {
          errorType: (isErr(result) ? result.error.type : ""),
          message: (isErr(result) ? result.error.message : "An error occurred"),
        });

        const statusCode = getStatusCodeFromError(result.error);
        res.status(statusCode).json({
          success: false,
          error: result.error,
        });
      }
    } catch (error) {
      requestLogger.error('Password reset confirmation endpoint error', error);
      next(new AppError(500, 'Password reset failed', 'AUTH_RESET_PASSWORD_ERROR'));
    }
  }
);

export default router;