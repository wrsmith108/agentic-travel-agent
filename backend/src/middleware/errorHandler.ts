import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import logger from '../utils/logger';

// Custom error class
export class AppError extends Error {
  public statusCode: number;
  public code?: string;
  public details?: unknown;

  constructor(
    statusCode: number,
    message: string,
    code?: string,
    details?: unknown
  ) {
    super(message);
    this.statusCode = statusCode;
    if (code !== undefined) {
      this.code = code;
    }
    if (details !== undefined) {
      this.details = details;
    }
    this.name = 'AppError';
    Error.captureStackTrace(this, this.constructor);
  }
}

// API response format
export interface ApiErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
  meta?: {
    timestamp: string;
    requestId?: string;
  };
}

// Error codes
export const ErrorCodes = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  AUTHENTICATION_REQUIRED: 'AUTHENTICATION_REQUIRED',
  AUTHORIZATION_FAILED: 'AUTHORIZATION_FAILED',
  INVALID_TOKEN: 'INVALID_TOKEN',
  RESOURCE_NOT_FOUND: 'RESOURCE_NOT_FOUND',
  DUPLICATE_RESOURCE: 'DUPLICATE_RESOURCE',
  EXTERNAL_API_ERROR: 'EXTERNAL_API_ERROR',
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
  INTERNAL_SERVER_ERROR: 'INTERNAL_SERVER_ERROR',
  BAD_REQUEST: 'BAD_REQUEST',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
} as const;

// 404 handler
export const notFoundHandler = (req: Request, res: Response): void => {
  const error: ApiErrorResponse = {
    success: false,
    error: {
      code: ErrorCodes.RESOURCE_NOT_FOUND,
      message: `Resource not found: ${req.method} ${req.originalUrl}`,
    },
    meta: {
      timestamp: new Date().toISOString(),
      ...(req.id && { requestId: req.id }),
    },
  };

  res.status(404).json(error);
};

// Global error handler
export const errorHandler = (
  err: Error | AppError | z.ZodError,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction
): void => {
  // Log error
  logger.error('Request error:', {
    error: err.message,
    stack: err.stack,
    method: req.method,
    url: req.originalUrl,
    requestId: req.id,
  });

  let statusCode = 500;
  let errorCode: string = ErrorCodes.INTERNAL_SERVER_ERROR;
  let message = 'An unexpected error occurred';
  let details: unknown = undefined;

  // Handle different error types
  if (err instanceof AppError) {
    statusCode = err.statusCode;
    errorCode = err.code || ErrorCodes.INTERNAL_SERVER_ERROR;
    message = err.message;
    details = err.details;
  } else if (err instanceof z.ZodError) {
    statusCode = 400;
    errorCode = ErrorCodes.VALIDATION_ERROR;
    message = 'Validation failed';
    details = err.errors;
  } else if (err.name === 'UnauthorizedError') {
    statusCode = 401;
    errorCode = ErrorCodes.AUTHENTICATION_REQUIRED;
    message = 'Authentication required';
  } else if (err.message.includes('ECONNREFUSED')) {
    statusCode = 503;
    errorCode = ErrorCodes.SERVICE_UNAVAILABLE;
    message = 'External service unavailable';
  }

  const errorResponse: ApiErrorResponse = {
    success: false,
    error: {
      code: errorCode,
      message,
      details: process.env.NODE_ENV === 'development' ? details : undefined,
    },
    meta: {
      timestamp: new Date().toISOString(),
      ...(req.id && { requestId: req.id }),
    },
  };

  res.status(statusCode).json(errorResponse);
};