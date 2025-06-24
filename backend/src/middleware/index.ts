/**
 * Middleware exports - Central export point for all middleware
 */

// Authentication middleware
export {
  requireAuth,
  optionalAuth,
  requireRole,
  isAuthenticated,
  getCurrentUser,
  getCurrentSessionUser,
  hasRole,
  hasAnyRole,
  hasAllRoles,
  authErrorHandler,
  enhanceRequestContext,
  authConfigs,
  roleConfigs,
  UserRole,
  type AuthenticatedRequest,
  type AuthMiddlewareConfig,
  type RoleConfig,
} from './auth';

// Error handling middleware
export {
  errorHandler,
  notFoundHandler,
  AppError,
  ErrorCodes,
  type ApiErrorResponse,
} from './errorHandler';

// Import only what we need for the middleware combinations
import {
  requireAuth,
  optionalAuth,
  requireRole,
  authErrorHandler,
  enhanceRequestContext,
} from './auth';

import {
  errorHandler,
  notFoundHandler,
} from './errorHandler';

// Re-export commonly used middleware combinations
export const middleware = {
  // Authentication middleware
  auth: {
    required: requireAuth,
    optional: optionalAuth,
    role: requireRole,
  },
  
  // Error handling middleware
  errors: {
    handler: errorHandler,
    notFound: notFoundHandler,
    auth: authErrorHandler,
  },
  
  // Request enhancement
  enhance: {
    context: enhanceRequestContext,
  },
} as const;