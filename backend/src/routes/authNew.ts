/**
 * Authentication routes using new functional auth service and Result pattern
 */

import { Router, Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import * as authService from '@/services/auth/authServiceNew';
import { authenticate, userRateLimit } from '@/middleware/authNew';
import { createRequestLogger } from '@/utils/logger';
import { isOk, isErr } from '@/utils/result';
import { getStatusCodeFromError } from '@/types/auth';
import {
  RegisterRequestSchema,
  LoginRequestSchema,
  PasswordResetRequestSchema,
  PasswordResetConfirmSchema,
  TokenRefreshRequestSchema,
  AUTH_CONSTANTS,
} from '@/schemas/auth';

const router = Router();

// Rate limiting
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: AUTH_CONSTANTS.RATE_LIMITS.LOGIN_ATTEMPTS,
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

// Request validation middleware
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
 * Register a new user
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

      const result = await authService.register(req.body);

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
      next(error);
    }
  }
);

/**
 * POST /api/v1/auth/login
 * User login
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

      const result = await authService.login(req.body);

      if (isOk(result)) {
        requestLogger.info('User login successful', {
          userId: result.value.user.id,
          email: result.value.user.email,
        });

        // Set secure cookie with refresh token (optional)
        if (result.value.refreshToken) {
          res.cookie('refreshToken', result.value.refreshToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: req.body.rememberMe ? 30 * 24 * 60 * 60 * 1000 : 7 * 24 * 60 * 60 * 1000,
          });
        }

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
      next(error);
    }
  }
);

/**
 * POST /api/v1/auth/logout
 * User logout
 */
router.post(
  '/logout',
  authenticate,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const requestLogger = createRequestLogger(req.id || uuidv4());

    try {
      const sessionId = req.user?.sessionId;
      const logoutAll = req.body.logoutAll === true;

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
        userId: req.user?.id,
        sessionId,
        logoutAll,
        ip: req.ip,
      });

      const result = await authService.logout(sessionId, logoutAll);

      if (isOk(result)) {
        requestLogger.info('User logout successful', {
          userId: req.user?.id,
          sessionId,
        });

        // Clear refresh token cookie
        res.clearCookie('refreshToken');

        res.status(200).json({
          success: true,
          message: logoutAll ? 'Logged out from all devices' : 'Logged out successfully',
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
      next(error);
    }
  }
);

/**
 * GET /api/v1/auth/me
 * Get current user information
 */
router.get(
  '/me',
  authenticate,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const requestLogger = createRequestLogger(req.id || uuidv4());

    try {
      const userId = req.user?.id;

      requestLogger.info('Current user request', {
        userId,
        sessionId: req.user?.sessionId,
        ip: req.ip,
      });

      res.status(200).json({
        success: true,
        data: {
          user: req.user,
        },
      });
    } catch (error) {
      requestLogger.error('Current user endpoint error', error);
      next(error);
    }
  }
);

/**
 * POST /api/v1/auth/refresh
 * Refresh access token
 */
router.post(
  '/refresh',
  validateRequest(TokenRefreshRequestSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const requestLogger = createRequestLogger(req.id || uuidv4());

    try {
      // Get refresh token from body or cookie
      const refreshToken = req.body.refreshToken || req.cookies?.refreshToken;

      if (!refreshToken) {
        res.status(400).json({
          success: false,
          error: {
            type: 'VALIDATION_ERROR',
            message: 'Refresh token is required',
          },
        });
        return;
      }

      requestLogger.info('Token refresh attempt started', {
        ip: req.ip,
      });

      const result = await authService.refreshAccessToken(refreshToken);

      if (isOk(result)) {
        requestLogger.info('Token refresh successful');

        res.status(200).json({
          success: true,
          data: result.value,
        });
      } else {
        requestLogger.warn('Token refresh failed', {
          error: result.error,
        });

        const statusCode = isErr(result) && result.error.type === 'TOKEN_EXPIRED' ? 401 : 403;
        res.status(statusCode).json({
          success: false,
          error: result.error,
        });
      }
    } catch (error) {
      requestLogger.error('Token refresh endpoint error', error);
      next(error);
    }
  }
);

/**
 * POST /api/v1/auth/forgot-password
 * Request password reset
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

      const result = await authService.requestPasswordReset(req.body.email);

      // Always return success for security (don't reveal if email exists)
      res.status(200).json({
        success: true,
        message: 'If an account exists with this email, you will receive password reset instructions.',
      });

      // Log the actual result
      if (isOk(result) && result.value.token) {
        requestLogger.info('Password reset token generated', {
          email: req.body.email,
          // In development, log token for testing
          ...(process.env.NODE_ENV !== 'production' && { token: result.value.token }),
        });
      }
    } catch (error) {
      requestLogger.error('Password reset request endpoint error', error);
      next(error);
    }
  }
);

/**
 * POST /api/v1/auth/reset-password
 * Reset password with token
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

      const result = await authService.resetPassword(
        req.body.token,
        req.body.password
      );

      if (isOk(result)) {
        requestLogger.info('Password reset successful');

        res.status(200).json({
          success: true,
          message: 'Password has been reset successfully. Please login with your new password.',
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
      next(error);
    }
  }
);

/**
 * POST /api/v1/auth/verify-email
 * Verify email address (placeholder)
 */
router.post(
  '/verify-email',
  async (_req: Request, res: Response): Promise<void> => {
    res.status(501).json({
      success: false,
      error: {
        type: 'NOT_IMPLEMENTED',
        message: 'Email verification not yet implemented',
      },
    });
  }
);

/**
 * POST /api/v1/auth/resend-verification
 * Resend verification email (placeholder)
 */
router.post(
  '/resend-verification',
  authenticate,
  userRateLimit(60 * 60 * 1000, 3), // 3 requests per hour
  async (_req: Request, res: Response): Promise<void> => {
    res.status(501).json({
      success: false,
      error: {
        type: 'NOT_IMPLEMENTED',
        message: 'Email verification not yet implemented',
      },
    });
  }
);

export default router;