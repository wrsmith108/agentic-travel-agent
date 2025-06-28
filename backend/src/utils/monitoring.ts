import type { Request, Response, NextFunction } from 'express';
import { env } from '../config/env';
import createLogger from './logger';
const logger = createLogger('Umonitoring');
// Simple request logging middleware
export const requestLoggingMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  const start = Date.now();

  // Skip health and metrics endpoints
  if (req.path === '/health') {
    next();
    return;
  }

  // Log response after it's sent
  res.on('finish', () => {
    const duration = Date.now() - start;
    const route = req.route?.path || req.path || 'unknown';

    // Log slow requests
    if (duration > 2000) {
      logger.warn('Slow request detected', {
        method: req.method,
        route,
        duration: `${duration}ms`,
        statusCode: res.statusCode,
      });
    }
  });

  next();
};

// Health check data
export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  version: string;
  uptime: number;
  timestamp: string;
  environment: string;
  checks: {
    database: boolean;
    externalApis: {
      anthropic: boolean;
      amadeus: boolean;
      sendgrid: boolean;
    };
    diskSpace: boolean;
    memory: boolean;
  };
}

// Health check function
export const getHealthStatus = async (): Promise<HealthStatus> => {
  const uptime = process.uptime();
  const memUsage = process.memoryUsage();
  const memThreshold = 0.9; // 90% memory usage threshold

  // Basic health status
  const health: HealthStatus = {
    status: 'healthy',
    version: '1.0.0',
    uptime,
    timestamp: new Date().toISOString(),
    environment: env.NODE_ENV,
    checks: {
      database: true, // File-based storage for MVP
      externalApis: {
        anthropic: true,
        amadeus: true,
        sendgrid: true,
      },
      diskSpace: true,
      memory: memUsage.heapUsed / memUsage.heapTotal < memThreshold,
    },
  };

  // Determine overall health status
  const checks = Object.values(health.checks).flat();
  const apiChecks = Object.values(health.checks.externalApis);

  if (checks.some((check) => check === false)) {
    health.status = 'unhealthy';
  } else if (apiChecks.some((check) => check === false)) {
    health.status = 'degraded';
  }

  return health;
};

// Simple counters for monitoring (stored in memory for MVP)
let flightSearchCount = 0;
let priceAlertCount = 0;

export const recordFlightSearch = (status: 'success' | 'failure'): void => {
  flightSearchCount++;
  logger.info('Flight search recorded', { status, totalSearches: flightSearchCount });
};

export const recordPriceAlert = (status: 'success' | 'failure'): void => {
  priceAlertCount++;
  logger.info('Price alert recorded', { status, totalAlerts: priceAlertCount });
};

export const getSimpleMetrics = () => ({
  flightSearches: flightSearchCount,
  priceAlerts: priceAlertCount,
  uptime: process.uptime(),
});
