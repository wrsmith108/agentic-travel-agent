import type { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { costTrackingService } from '@/services/costTracking/costTrackingService';
import { CostContext } from '@/schemas/costControl';
import { logInfo, logWarn, logError } from '@/utils/logger';
import { AuthenticatedRequest } from './auth';

/**
 * Cost control middleware for API usage tracking and enforcement
 * Following 2025 best practices for LLM cost management
 */

// Extend request to include cost tracking context
export interface CostTrackedRequest extends AuthenticatedRequest {
  costContext?: CostContext;
  costTracking?: {
    startTime: number;
    estimatedTokens?: number;
    actualTokens?: number;
    cost?: number;
  };
}

/**
 * Middleware to track costs for LLM API calls
 */
export const trackLLMCosts = () => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const costReq = req as CostTrackedRequest;
    
    // Skip if not authenticated
    if (!costReq.user || !costReq.sessionUser) {
      next();
      return;
    }

    const userId = costReq.user.sub;
    const requestId = costReq.requestId || uuidv4();
    const startTime = Date.now();

    // Initialize cost tracking
    costReq.costTracking = {
      startTime,
      estimatedTokens: 0,
      actualTokens: 0,
      cost: 0,
    };

    // Create cost context
    costReq.costContext = {
      userId,
      requestId,
      service: 'anthropic',
      startTime,
    };

    // Estimate tokens from request body
    if (req.body?.messages) {
      const messages = Array.isArray(req.body.messages) ? req.body.messages : [req.body.messages];
      let estimatedTokens = 0;
      
      for (const message of messages) {
        if (typeof message === 'string') {
          estimatedTokens += costTrackingService.estimateTokens(message);
        } else if (message?.content) {
          estimatedTokens += costTrackingService.estimateTokens(message.content);
        }
      }

      // Add system prompt estimate
      estimatedTokens += 500; // Rough estimate for system prompt

      costReq.costTracking.estimatedTokens = estimatedTokens;
    }

    // Check quota before proceeding
    const quotaCheck = await costTrackingService.checkQuota(
      userId,
      costReq.costTracking.estimatedTokens || 1000
    );

    if (!quotaCheck.allowed) {
      logWarn('Request blocked due to quota limit', {
        userId,
        reason: quotaCheck.reason,
        requestId,
      });

      res.status(429).json({
        success: false,
        error: {
          code: 'QUOTA_EXCEEDED',
          message: quotaCheck.reason || 'API quota exceeded',
          details: {
            fallbackModel: quotaCheck.fallbackModel,
            upgradeUrl: '/api/v1/billing/upgrade',
          },
        },
        meta: {
          requestId,
          timestamp: new Date().toISOString(),
        },
      });
      return;
    }

    // If fallback model suggested, add to request
    if (quotaCheck.fallbackModel) {
      req.body = {
        ...req.body,
        model: quotaCheck.fallbackModel,
        _originalModel: req.body?.model,
        _fallbackReason: quotaCheck.reason,
      };

      logInfo('Using fallback model due to quota', {
        userId,
        originalModel: req.body._originalModel,
        fallbackModel: quotaCheck.fallbackModel,
        reason: quotaCheck.reason,
      });
    }

    // Intercept response to track actual usage
    const originalJson = res.json;
    res.json = function(data: any) {
      // Track token usage from response
      if (data?.usage) {
        const inputTokens = data.usage.input_tokens || 0;
        const outputTokens = data.usage.output_tokens || 0;
        const modelId = req.body?.model || 'claude-3-opus-20240229';
        
        // Track asynchronously to not block response
        costTrackingService.trackTokenUsage(
          userId,
          modelId,
          inputTokens,
          outputTokens,
          req.path
        ).catch(error => {
          logError('Failed to track token usage', error, {
            userId,
            requestId,
          });
        });

        // Add cost info to response
        const pricing = {
          inputTokens,
          outputTokens,
          totalTokens: inputTokens + outputTokens,
          estimatedCost: data.usage.estimated_cost || 0,
          model: modelId,
        };

        data._costTracking = pricing;
      }

      // Call original json method
      return originalJson.call(this, data);
    };

    next();
  };
};

/**
 * Middleware to enforce rate limits based on user tier
 */
export const enforceRateLimits = () => {
  const requestCounts = new Map<string, { count: number; resetTime: number }>();
  
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const costReq = req as CostTrackedRequest;
    
    if (!costReq.user || !costReq.sessionUser) {
      next();
      return;
    }

    const userId = costReq.user.sub;
    const now = Date.now();
    const windowMs = 60 * 1000; // 1 minute window

    // Get user quota to check rate limits
    const quota = await costTrackingService.getUserQuota(userId);
    const limit = quota.limits.requestsPerMinute;

    // Get or create request count
    let userRequests = requestCounts.get(userId);
    if (!userRequests || userRequests.resetTime < now) {
      userRequests = {
        count: 0,
        resetTime: now + windowMs,
      };
      requestCounts.set(userId, userRequests);
    }

    // Increment count
    userRequests.count++;

    // Check if limit exceeded
    if (userRequests.count > limit) {
      const retryAfter = Math.ceil((userRequests.resetTime - now) / 1000);
      
      logWarn('Rate limit exceeded', {
        userId,
        limit,
        count: userRequests.count,
        retryAfter,
      });

      res.status(429)
        .set('Retry-After', String(retryAfter))
        .json({
          success: false,
          error: {
            code: 'RATE_LIMIT_EXCEEDED',
            message: `Rate limit exceeded. Please retry after ${retryAfter} seconds.`,
            details: {
              limit,
              windowMs,
              retryAfter,
            },
          },
          meta: {
            requestId: costReq.requestId || uuidv4(),
            timestamp: new Date().toISOString(),
          },
        });
      return;
    }

    // Clean up old entries periodically
    if (requestCounts.size > 1000) {
      for (const [key, value] of requestCounts.entries()) {
        if (value.resetTime < now) {
          requestCounts.delete(key);
        }
      }
    }

    next();
  };
};

/**
 * Middleware to track non-LLM API costs (Amadeus, SendGrid, etc.)
 */
export const trackAPICosts = (service: 'amadeus' | 'sendgrid') => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const costReq = req as CostTrackedRequest;
    
    if (!costReq.user || !costReq.sessionUser) {
      next();
      return;
    }

    const userId = costReq.user.sub;
    const requestId = costReq.requestId || uuidv4();
    const startTime = Date.now();

    // Create cost context
    costReq.costContext = {
      userId,
      requestId,
      service,
      startTime,
    };

    // Define cost per request (simplified for MVP)
    const costPerRequest = {
      amadeus: 0.01, // $0.01 per flight search
      sendgrid: 0.001, // $0.001 per email
    };

    // Intercept response to track cost
    const originalJson = res.json;
    res.json = function(data: any) {
      const duration = Date.now() - startTime;
      const cost = costPerRequest[service] || 0;

      // Track API call
      costTrackingService.trackTokenUsage(
        userId,
        service,
        0, // No input tokens for non-LLM
        0, // No output tokens for non-LLM
        req.path
      ).catch(error => {
        logError('Failed to track API cost', error, {
          userId,
          service,
          requestId,
        });
      });

      // Add cost info to response
      data._costTracking = {
        service,
        cost,
        duration,
      };

      return originalJson.call(this, data);
    };

    next();
  };
};

/**
 * Get user's cost summary
 */
export const getCostSummary = () => {
  return async (req: Request, res: Response): Promise<void> => {
    const costReq = req as CostTrackedRequest;
    
    if (!costReq.user || !costReq.sessionUser) {
      res.status(401).json({
        success: false,
        error: {
          code: 'AUTHENTICATION_REQUIRED',
          message: 'Authentication required',
        },
      });
      return;
    }

    try {
      const userId = costReq.user.sub;
      const { startDate, endDate } = req.query;

      // Get user quota
      const quota = await costTrackingService.getUserQuota(userId);
      
      // Get cost breakdown
      const breakdown = await costTrackingService.getUserCostBreakdown(
        userId,
        startDate as string,
        endDate as string
      );

      // Get recommended model
      const recommendedModel = await costTrackingService.getRecommendedModel(userId);

      res.json({
        success: true,
        data: {
          quota: {
            tier: quota.tier,
            limits: quota.limits,
            usage: quota.usage,
            percentUsed: {
              dailyTokens: (quota.usage.dailyTokensUsed / quota.limits.dailyTokens) * 100,
              monthlyTokens: (quota.usage.monthlyTokensUsed / quota.limits.monthlyTokens) * 100,
              dailyCost: (quota.usage.dailyCostUsed / quota.limits.dailyCost) * 100,
              monthlyCost: (quota.usage.monthlyCostUsed / quota.limits.monthlyCost) * 100,
            },
          },
          breakdown,
          recommendedModel,
        },
        meta: {
          requestId: costReq.requestId || uuidv4(),
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      logError('Failed to get cost summary', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to retrieve cost summary',
        },
      });
    }
  };
};

/**
 * Audit logging middleware for security
 */
export const auditLog = (action: string) => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const costReq = req as CostTrackedRequest;
    const userId = costReq.user?.sub || 'anonymous';
    const requestId = costReq.requestId || uuidv4();

    logInfo('Audit log', {
      action,
      userId,
      requestId,
      method: req.method,
      path: req.path,
      ip: req.ip,
      userAgent: req.get('user-agent'),
      timestamp: new Date().toISOString(),
    });

    next();
  };
};