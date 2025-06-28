/**
 * Monitoring routes
 * Endpoints for system monitoring and batch processing management
 */

import { Router, Request, Response } from 'express';
import { requireAuth, getSessionData } from '@/middleware/session';
import { createRequestLogger } from '@/utils/logger';
import { priceMonitoringProcessor } from '@/services/batch/priceMonitoringProcessor';
import { emailService } from '@/services/notifications/emailService';
import { metricsService } from '@/services/monitoring/metricsService';
import { errorTracker } from '@/services/monitoring/errorTracker';
import { env } from '@/config/env';
import { isOk, isErr } from '@/utils/result';

const router = Router();

/**
 * GET /api/v1/monitoring/price-processor/status
 * Get price monitoring processor status
 */
router.get('/price-processor/status', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const requestLogger = createRequestLogger(req.id || '');
  
  try {
    requestLogger.info('Price processor status request', {
      userId: getSessionData(req)?.userId,
    });

    const status = priceMonitoringProcessor.getStatus();
    
    res.status(200).json({
      success: true,
      data: status,
    });
  } catch (error) {
    requestLogger.error('Failed to get processor status', { error });
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVICE_ERROR',
        message: 'Failed to get processor status',
      },
    });
  }
});

/**
 * POST /api/v1/monitoring/price-processor/start
 * Start the price monitoring processor
 */
router.post('/price-processor/start', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const requestLogger = createRequestLogger(req.id || '');
  
  try {
    // Check if user has admin permissions (simplified for now)
    // TODO: Implement proper role-based access control
    if (!getSessionData(req)?.userId) {
      res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Admin access required',
        },
      });
      return;
    }

    requestLogger.info('Starting price processor', {
      userId: getSessionData(req)?.userId,
      cronPattern: req.body.cronPattern,
    });

    const cronPattern = req.body.cronPattern || env.PRICE_MONITOR_CRON_PATTERN;
    priceMonitoringProcessor.start(cronPattern);
    
    const status = priceMonitoringProcessor.getStatus();
    
    res.status(200).json({
      success: true,
      message: 'Price monitoring processor started',
      data: status,
    });
  } catch (error) {
    requestLogger.error('Failed to start processor', { error });
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVICE_ERROR',
        message: 'Failed to start processor',
      },
    });
  }
});

/**
 * POST /api/v1/monitoring/price-processor/stop
 * Stop the price monitoring processor
 */
router.post('/price-processor/stop', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const requestLogger = createRequestLogger(req.id || '');
  
  try {
    if (!getSessionData(req)?.userId) {
      res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Admin access required',
        },
      });
      return;
    }

    requestLogger.info('Stopping price processor', {
      userId: getSessionData(req)?.userId,
    });

    priceMonitoringProcessor.stop();
    
    res.status(200).json({
      success: true,
      message: 'Price monitoring processor stopped',
    });
  } catch (error) {
    requestLogger.error('Failed to stop processor', { error });
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVICE_ERROR',
        message: 'Failed to stop processor',
      },
    });
  }
});

/**
 * POST /api/v1/monitoring/price-processor/run-now
 * Manually trigger price check batch
 */
router.post('/price-processor/run-now', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const requestLogger = createRequestLogger(req.id || '');
  
  try {
    if (!getSessionData(req)?.userId) {
      res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Admin access required',
        },
      });
      return;
    }

    requestLogger.info('Manual price check triggered', {
      userId: getSessionData(req)?.userId,
    });

    const result = await priceMonitoringProcessor.processNow();
    
    if (!isOk(result)) {
      res.status(400).json({
        success: false,
        error: {
          code: (isErr(result) ? result.error.code : ""),
          message: (isErr(result) ? result.error.message : ""),
        },
      });
      return;
    }

    res.status(200).json({
      success: true,
      message: 'Price check batch completed',
      data: result.value,
    });
  } catch (error) {
    requestLogger.error('Failed to run price check', { error });
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVICE_ERROR',
        message: 'Failed to run price check',
      },
    });
  }
});

/**
 * GET /api/v1/monitoring/email/stats
 * Get email service statistics
 */
router.get('/email/stats', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const requestLogger = createRequestLogger(req.id || '');
  
  try {
    requestLogger.info('Email stats request', {
      userId: getSessionData(req)?.userId,
    });

    const stats = await emailService.getStatistics();
    
    if (!isOk(stats)) {
      res.status(500).json({
        success: false,
        error: {
          code: 'SERVICE_ERROR',
          message: 'Failed to get email statistics',
        },
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: stats.value,
    });
  } catch (error) {
    requestLogger.error('Failed to get email stats', { error });
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVICE_ERROR',
        message: 'Failed to get email statistics',
      },
    });
  }
});

/**
 * POST /api/v1/monitoring/email/process-queue
 * Process queued emails
 */
router.post('/email/process-queue', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const requestLogger = createRequestLogger(req.id || '');
  
  try {
    if (!getSessionData(req)?.userId) {
      res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Admin access required',
        },
      });
      return;
    }

    requestLogger.info('Processing email queue', {
      userId: getSessionData(req)?.userId,
    });

    // Process queue asynchronously
    emailService.processQueue().catch(error => {
      requestLogger.error('Email queue processing failed', { error });
    });
    
    res.status(200).json({
      success: true,
      message: 'Email queue processing started',
    });
  } catch (error) {
    requestLogger.error('Failed to process email queue', { error });
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVICE_ERROR',
        message: 'Failed to process email queue',
      },
    });
  }
});

/**
 * GET /api/v1/monitoring/metrics
 * Get application metrics
 */
router.get('/metrics', async (req: Request, res: Response): Promise<void> => {
  const requestLogger = createRequestLogger(req.id || '');
  
  try {
    requestLogger.info('Metrics request');

    const metrics = metricsService.exportMetrics();
    
    res.status(200).json({
      success: true,
      data: metrics,
    });
  } catch (error) {
    requestLogger.error('Failed to get metrics', { error });
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVICE_ERROR',
        message: 'Failed to get metrics',
      },
    });
  }
});

/**
 * GET /api/v1/monitoring/errors
 * Get recent errors
 */
router.get('/errors', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const requestLogger = createRequestLogger(req.id || '');
  
  try {
    if (!getSessionData(req)?.userId) {
      res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Admin access required',
        },
      });
      return;
    }

    requestLogger.info('Recent errors request', {
      userId: getSessionData(req)?.userId,
    });

    const limit = parseInt(req.query.limit as string) || 100;
    const errors = errorTracker.getRecentErrors(limit);
    
    res.status(200).json({
      success: true,
      data: errors,
    });
  } catch (error) {
    requestLogger.error('Failed to get recent errors', { error });
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVICE_ERROR',
        message: 'Failed to get recent errors',
      },
    });
  }
});

export default router;