/**
 * Authentication Middleware Usage Examples
 * 
 * This file demonstrates how to use the authentication middleware
 * in various scenarios with Express routes.
 */

import { Router, Request, Response } from 'express';
import {
  requireAuth,
  optionalAuth,
  requireRole,
  UserRole,
  authConfigs,
  roleConfigs,
  getCurrentUser,
  isAuthenticated,
  type AuthenticatedRequest,
} from './auth';

const exampleRouter = Router();

/**
 * Example 1: Protected route that requires authentication
 */
exampleRouter.get('/protected', 
  requireAuth(), // Basic authentication required
  (req: Request, res: Response) => {
    const authReq = req as AuthenticatedRequest;
    
    res.json({
      message: 'This is a protected route',
      user: authReq.user,
      sessionId: authReq.sessionId,
    });
  }
);

/**
 * Example 2: Protected route with user profile included
 */
exampleRouter.get('/profile',
  requireAuth(authConfigs.withProfile), // Include full user profile
  (req: Request, res: Response) => {
    const authReq = req as AuthenticatedRequest;
    
    res.json({
      message: 'User profile data',
      user: authReq.user,
      profile: (authReq as any).userProfile,
    });
  }
);

/**
 * Example 3: Admin-only route
 */
exampleRouter.get('/admin',
  requireAuth(),
  requireRole(UserRole.ADMIN), // Only admins can access
  (req: Request, res: Response) => {
    res.json({
      message: 'Admin-only content',
      user: getCurrentUser(req),
    });
  }
);

/**
 * Example 4: Moderator or Admin route
 */
exampleRouter.get('/moderation',
  requireAuth(),
  requireRole(roleConfigs.moderation), // Admin or Moderator
  (req: Request, res: Response) => {
    res.json({
      message: 'Moderation panel',
      user: getCurrentUser(req),
    });
  }
);

/**
 * Example 5: Optional authentication route
 * Works with or without authentication
 */
exampleRouter.get('/public-content',
  optionalAuth(), // Authentication is optional
  (req: Request, res: Response) => {
    if (isAuthenticated(req)) {
      // User is authenticated - show personalized content
      res.json({
        message: 'Personalized content',
        user: getCurrentUser(req),
        authenticated: true,
      });
    } else {
      // User is not authenticated - show public content
      res.json({
        message: 'Public content',
        authenticated: false,
      });
    }
  }
);

/**
 * Example 6: Silent authentication (minimal logging)
 */
exampleRouter.get('/api/data',
  requireAuth(authConfigs.silent), // Minimal logging for high-traffic API
  (req: Request, res: Response) => {
    res.json({
      data: 'API response',
      userId: getCurrentUser(req)?.sub,
    });
  }
);

/**
 * Example 7: Multiple role requirements
 */
exampleRouter.post('/admin/users',
  requireAuth(),
  requireRole({
    requiredRoles: [UserRole.ADMIN],
    requireAll: true // Must have ALL specified roles
  }),
  (_req: Request, res: Response) => {
    res.json({
      message: 'User management operation',
    });
  }
);

/**
 * Example 8: Custom middleware with role checking
 */
const requireUserOrAdmin = (req: Request, res: Response, next: any): void => {
  const user = getCurrentUser(req);
  
  if (!user) {
    res.status(401).json({
      success: false,
      error: {
        code: 'AUTHENTICATION_REQUIRED',
        message: 'Authentication required',
      },
    });
    return;
  }

  // Allow users to access their own data, or admins to access any data
  const userId = req.params.userId;
  if (user.sub === userId || user.role === UserRole.ADMIN) {
    next();
  } else {
    res.status(403).json({
      success: false,
      error: {
        code: 'INSUFFICIENT_PERMISSIONS',
        message: 'You can only access your own data',
      },
    });
    return;
  }
};

exampleRouter.get('/users/:userId',
  requireAuth(),
  requireUserOrAdmin, // Custom authorization logic
  (req: Request, res: Response) => {
    const { userId } = req.params;
    
    res.json({
      message: `User data for ${userId}`,
      requestedBy: getCurrentUser(req)?.sub,
    });
  }
);

/**
 * Example 9: Skip session validation (useful for logout)
 */
exampleRouter.post('/logout',
  requireAuth(authConfigs.skipSession), // Skip session validation
  (_req: Request, res: Response) => {
    // Logout logic here - session might already be expired
    res.json({
      message: 'Logged out successfully',
    });
  }
);

/**
 * Example 10: Error handling with auth errors
 */
exampleRouter.get('/sensitive',
  requireAuth(),
  requireRole([UserRole.ADMIN, UserRole.MODERATOR]),
  (_req: Request, res: Response) => {
    try {
      // Some sensitive operation that might fail
      throw new Error('Sensitive operation failed');
    } catch (error) {
      // The authErrorHandler will catch this if needed
      res.status(500).json({
        success: false,
        error: {
          code: 'OPERATION_FAILED',
          message: 'Sensitive operation failed',
        },
      });
    }
  }
);

export default exampleRouter;

/**
 * Usage in main Express app:
 * 
 * ```typescript
 * import express from 'express';
 * import { 
 *   enhanceRequestContext, 
 *   authErrorHandler,
 *   middleware 
 * } from './middleware';
 * 
 * const app = express();
 * 
 * // Add request context enhancement early in middleware chain
 * app.use(enhanceRequestContext);
 * 
 * // Add routes
 * app.use('/api/examples', exampleRouter);
 * 
 * // Add auth error handler before general error handler
 * app.use(authErrorHandler);
 * app.use(middleware.errors.handler);
 * 
 * // Alternative usage with middleware object:
 * app.get('/protected', 
 *   middleware.auth.required(),
 *   (req, res) => { ... }
 * );
 * 
 * app.get('/admin-only',
 *   middleware.auth.required(),
 *   middleware.auth.role(UserRole.ADMIN),
 *   (req, res) => { ... }
 * );
 * ```
 */