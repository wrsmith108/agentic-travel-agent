import rateLimit from 'express-rate-limit';
import type { Request, Response } from 'express';
import { costTrackingService } from '@/services/costTracking/costTrackingService';
import { AuthenticatedRequest } from './auth';
import { logWarn } from '@/utils/logger';

/**
 * Dynamic rate limiting based on user tier
 * Following 2025 best practices for API protection
 */

// Store for rate limit data (in production, use Redis)
const userRateLimitStore = new Map<string, { count: number; resetTime: number }>();

/**
 * Get rate limit for user based on their tier
 */
async function getUserRateLimit(userId: string): Promise<{ windowMs: number; max: number }> {
  try {
    const quota = await costTrackingService.getUserQuota(userId);
    return {
      windowMs: 60 * 1000, // 1 minute
      max: quota.limits.requestsPerMinute,
    };
  } catch {
    // Default limits if quota lookup fails
    return {
      windowMs: 60 * 1000,
      max: 10,
    };
  }
}

/**
 * Custom key generator for authenticated routes
 */
function keyGenerator(req: Request): string {
  const authReq = req as AuthenticatedRequest;
  if (authReq.user?.sub) {
    return `user:${authReq.user.sub}`;
  }
  // Fall back to IP for unauthenticated requests
  return `ip:${req.ip}`;
}

/**
 * Dynamic rate limiter for authenticated users
 */
export const dynamicRateLimiter = rateLimit({
  windowMs: 60 * 1000, // Default 1 minute
  max: async (req: Request) => {
    const authReq = req as AuthenticatedRequest;
    if (authReq.user?.sub) {
      const limits = await getUserRateLimit(authReq.user.sub);
      return limits.max;
    }
    return 10; // Default for unauthenticated
  },
  keyGenerator,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req: Request, res: Response) => {
    const authReq = req as AuthenticatedRequest;
    const identifier = authReq.user?.sub || req.ip;
    
    logWarn('Rate limit exceeded', {
      identifier,
      path: req.path,
      method: req.method,
    });

    res.status(429).json({
      success: false,
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Too many requests. Please slow down.',
        retryAfter: res.getHeader('Retry-After'),
      },
    });
  },
  skip: (req: Request) => {
    // Skip rate limiting for health checks
    return req.path === '/health' || req.path === '/api/v1/health';
  },
});

/**
 * Strict rate limiter for sensitive endpoints
 */
export const strictRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 requests per window
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false,
  handler: (req: Request, res: Response) => {
    logWarn('Strict rate limit exceeded', {
      ip: req.ip,
      path: req.path,
    });

    res.status(429).json({
      success: false,
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Too many attempts. Please try again later.',
        retryAfter: res.getHeader('Retry-After'),
      },
    });
  },
});

/**
 * API-specific rate limiters
 */
export const apiRateLimiters = {
  // Authentication endpoints
  auth: rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10, // 10 requests per window
    skipSuccessfulRequests: true, // Don't count successful logins
    standardHeaders: true,
    legacyHeaders: false,
  }),

  // Password reset
  passwordReset: rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 3, // 3 reset attempts per hour
    skipSuccessfulRequests: false,
    standardHeaders: true,
    legacyHeaders: false,
  }),

  // AI/Claude endpoints
  ai: rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: async (req: Request) => {
      const authReq = req as AuthenticatedRequest;
      if (authReq.user?.sub) {
        const quota = await costTrackingService.getUserQuota(authReq.user.sub);
        // More restrictive for AI endpoints
        return Math.floor(quota.limits.requestsPerMinute / 2);
      }
      return 5;
    },
    keyGenerator,
    standardHeaders: true,
    legacyHeaders: false,
  }),

  // Flight search
  flightSearch: rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 30, // 30 searches per minute
    keyGenerator,
    standardHeaders: true,
    legacyHeaders: false,
  }),

  // Email sending
  email: rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 10, // 10 emails per hour
    keyGenerator,
    standardHeaders: true,
    legacyHeaders: false,
  }),
};

/**
 * Global rate limiter for all endpoints
 */
export const globalRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100, // 100 requests per minute per IP
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req: Request) => {
    // Skip for static assets and health checks
    return req.path.startsWith('/static') || 
           req.path === '/health' || 
           req.path === '/api/v1/health';
  },
});

/**
 * Cleanup old rate limit entries periodically
 */
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of userRateLimitStore.entries()) {
    if (value.resetTime < now) {
      userRateLimitStore.delete(key);
    }
  }
}, 5 * 60 * 1000); // Clean every 5 minutes