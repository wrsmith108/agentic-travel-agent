/**
 * Price alerts routes
 * REST API endpoints for price alert management
 */

import { Router, Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { requireAuth } from '@/middleware/auth';
import type { AuthenticatedRequest } from '@/middleware/auth';
import { flightSearchService } from '@/services/flights/flightSearchService';
import { createRequestLogger } from '@/utils/logger';
import { isOk, isErr } from '@/utils/result';

const router = Router();

/**
 * GET /api/v1/price-alerts
 * Get price alerts
 */
router.get('/', requireAuth(), async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  const requestLogger = createRequestLogger(req.id || uuidv4());

  try {
    // Extract userId from JWT payload
    if (!req.jwtPayload || !req.jwtPayload.sub) {
      res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'User not authenticated',
        },
      });
      return;
    }
    
    const userId = req.jwtPayload.sub;
    const unreadOnly = req.query.unread === 'true';
    
    requestLogger.info('Get price alerts request', {
      userId,
      unreadOnly,
    });

    const result = await flightSearchService.getPriceAlerts(userId, unreadOnly);

    if (!isOk(result)) {
      requestLogger.warn('Get price alerts failed', {
        error: result.error,
        userId,
      });

      res.status(400).json({
        success: false,
        error: {
          code: (isErr(result) ? result.error.code : ""),
          message: (isErr(result) ? result.error.message : "An error occurred"),
        },
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: result.value,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /api/v1/price-alerts/:id/read
 * Mark price alert as read
 */
router.put('/:id/read', requireAuth(), async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  const requestLogger = createRequestLogger(req.id || uuidv4());

  try {
    // Extract userId from JWT payload
    if (!req.jwtPayload || !req.jwtPayload.sub) {
      res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'User not authenticated',
        },
      });
      return;
    }
    
    const userId = req.jwtPayload.sub;
    const alertId = req.params.id;
    
    requestLogger.info('Mark alert as read request', {
      userId,
      alertId,
    });

    const result = await flightSearchService.markAlertAsRead(userId, alertId);

    if (!isOk(result)) {
      requestLogger.warn('Mark alert as read failed', {
        error: result.error,
        alertId,
      });

      res.status((isErr(result) ? result.error.code : "") === 'NOT_FOUND' ? 404 : 400).json({
        success: false,
        error: {
          code: (isErr(result) ? result.error.code : ""),
          message: (isErr(result) ? result.error.message : "An error occurred"),
        },
      });
      return;
    }

    res.status(200).json({
      success: true,
      message: 'Alert marked as read',
    });
  } catch (error) {
    next(error);
  }
});

export default router;