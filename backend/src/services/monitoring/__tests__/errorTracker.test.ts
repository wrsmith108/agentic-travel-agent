import { ErrorTracker } from '../errorTracker';
import { AppError, ErrorCodes } from '../../../middleware/errorHandler';
import { isOk, isErr } from '../../../utils/result';

describe('ErrorTracker', () => {
  let errorTracker: ErrorTracker;

  beforeEach(() => {
    jest.clearAllMocks();
    errorTracker = new ErrorTracker();
  });

  afterEach(() => {
    errorTracker.shutdown();
  });

  describe('Error Capture', () => {
    it('should capture application errors', () => {
      const error = new AppError(400, 'Test error', ErrorCodes.VALIDATION_ERROR);
      const context = { userId: 'user123', endpoint: '/api/test' };
      
      const result = errorTracker.captureError(error, context);
      
      expect(isOk(result)).toBe(true);
      
      const errors = errorTracker.getRecentErrors(10);
      expect(errors).toHaveLength(1);
      expect(errors[0].message).toBe('Test error');
      expect(errors[0].code).toBe(ErrorCodes.VALIDATION_ERROR);
      expect(errors[0].context).toMatchObject(context);
    });

    it('should capture standard errors', () => {
      const error = new Error('Standard error');
      
      const result = errorTracker.captureError(error);
      
      expect(isOk(result)).toBe(true);
      
      const errors = errorTracker.getRecentErrors(10);
      expect(errors).toHaveLength(1);
      expect(errors[0].message).toBe('Standard error');
      expect(errors[0].code).toBe('UNKNOWN_ERROR');
    });

    it('should capture error stack traces', () => {
      const error = new Error('Error with stack');
      
      errorTracker.captureError(error);
      
      const errors = errorTracker.getRecentErrors(1);
      expect(errors[0].stack).toBeDefined();
      expect(errors[0].stack).toContain('Error with stack');
    });

    it('should assign unique IDs to errors', () => {
      errorTracker.captureError(new Error('Error 1'));
      errorTracker.captureError(new Error('Error 2'));
      
      const errors = errorTracker.getRecentErrors(2);
      expect(errors[0].id).toBeDefined();
      expect(errors[1].id).toBeDefined();
      expect(errors[0].id).not.toBe(errors[1].id);
    });
  });

  describe('Error Aggregation', () => {
    it('should group similar errors', () => {
      // Capture same error multiple times
      for (let i = 0; i < 5; i++) {
        errorTracker.captureError(
          new AppError(400, 'Email invalid', ErrorCodes.VALIDATION_ERROR)
        );
      }
      
      const groups = errorTracker.getErrorGroups();
      expect(groups).toHaveLength(1);
      expect(groups[0].count).toBe(5);
      expect(groups[0].message).toBe('Email invalid');
      expect(groups[0].firstSeen).toBeDefined();
      expect(groups[0].lastSeen).toBeDefined();
    });

    it('should separate different errors', () => {
      errorTracker.captureError(new AppError(400, 'Email invalid', ErrorCodes.VALIDATION_ERROR));
      errorTracker.captureError(new AppError(401, 'Token expired', ErrorCodes.AUTH_ERROR));
      errorTracker.captureError(new AppError(400, 'Email invalid', ErrorCodes.VALIDATION_ERROR));
      
      const groups = errorTracker.getErrorGroups();
      expect(groups).toHaveLength(2);
      
      const emailGroup = groups.find(g => g.message === 'Email invalid');
      const tokenGroup = groups.find(g => g.message === 'Token expired');
      
      expect(emailGroup?.count).toBe(2);
      expect(tokenGroup?.count).toBe(1);
    });

    it('should track error trends over time', () => {
      const now = Date.now();
      
      // Simulate errors over time
      errorTracker.captureError(new Error('Test error'), { timestamp: now - 3600000 }); // 1 hour ago
      errorTracker.captureError(new Error('Test error'), { timestamp: now - 1800000 }); // 30 min ago
      errorTracker.captureError(new Error('Test error'), { timestamp: now - 300000 });  // 5 min ago
      
      const hourlyTrend = errorTracker.getErrorTrend('1h', 4);
      expect(hourlyTrend.length).toBeGreaterThan(0);
      expect(hourlyTrend[hourlyTrend.length - 1].count).toBe(3);
    });
  });

  describe('Error Filtering', () => {
    it('should filter errors by code', () => {
      errorTracker.captureError(new AppError(400, 'Validation 1', ErrorCodes.VALIDATION_ERROR));
      errorTracker.captureError(new AppError(401, 'Auth error', ErrorCodes.AUTH_ERROR));
      errorTracker.captureError(new AppError(400, 'Validation 2', ErrorCodes.VALIDATION_ERROR));
      
      const validationErrors = errorTracker.getErrorsByCode(ErrorCodes.VALIDATION_ERROR);
      expect(validationErrors).toHaveLength(2);
      expect(validationErrors.every(e => e.code === ErrorCodes.VALIDATION_ERROR)).toBe(true);
    });

    it('should filter errors by time range', () => {
      const now = Date.now();
      
      errorTracker.captureError(new Error('Old error'), { timestamp: now - 7200000 }); // 2 hours ago
      errorTracker.captureError(new Error('Recent error'), { timestamp: now - 600000 }); // 10 min ago
      
      const recentErrors = errorTracker.getErrorsInTimeRange(now - 3600000, now); // Last hour
      expect(recentErrors).toHaveLength(1);
      expect(recentErrors[0].message).toBe('Recent error');
    });

    it('should search errors by message', () => {
      errorTracker.captureError(new Error('Database connection failed'));
      errorTracker.captureError(new Error('Network timeout'));
      errorTracker.captureError(new Error('Database query error'));
      
      const dbErrors = errorTracker.searchErrors('database');
      expect(dbErrors).toHaveLength(2);
    });
  });

  describe('Error Statistics', () => {
    it('should calculate error rate', () => {
      // Capture 10 errors in the last minute
      for (let i = 0; i < 10; i++) {
        errorTracker.captureError(new Error(`Error ${i}`));
      }
      
      const errorRate = errorTracker.getErrorRate(60); // Per minute
      expect(errorRate).toBeCloseTo(10, 1);
    });

    it('should get top error types', () => {
      errorTracker.captureError(new AppError(400, 'Error 1', ErrorCodes.VALIDATION_ERROR));
      errorTracker.captureError(new AppError(400, 'Error 2', ErrorCodes.VALIDATION_ERROR));
      errorTracker.captureError(new AppError(401, 'Error 3', ErrorCodes.AUTH_ERROR));
      errorTracker.captureError(new AppError(400, 'Error 4', ErrorCodes.VALIDATION_ERROR));
      
      const topErrors = errorTracker.getTopErrorTypes(2);
      expect(topErrors).toHaveLength(2);
      expect(topErrors[0].code).toBe(ErrorCodes.VALIDATION_ERROR);
      expect(topErrors[0].count).toBe(3);
    });

    it('should calculate error impact score', () => {
      // High severity errors
      for (let i = 0; i < 5; i++) {
        errorTracker.captureError(
          new AppError(500, 'Critical error', ErrorCodes.INTERNAL_ERROR),
          { severity: 'critical' }
        );
      }
      
      // Low severity errors
      for (let i = 0; i < 10; i++) {
        errorTracker.captureError(
          new AppError(400, 'Minor error', ErrorCodes.VALIDATION_ERROR),
          { severity: 'low' }
        );
      }
      
      const impact = errorTracker.calculateErrorImpact();
      expect(impact.score).toBeGreaterThan(0);
      expect(impact.criticalErrors).toBe(5);
      expect(impact.totalErrors).toBe(15);
    });
  });

  describe('Error Notifications', () => {
    it('should trigger threshold alerts', () => {
      const mockCallback = jest.fn();
      
      errorTracker.setThresholdAlert({
        errorRate: 5, // 5 errors per minute
        window: 60,
        callback: mockCallback
      });
      
      // Trigger 6 errors
      for (let i = 0; i < 6; i++) {
        errorTracker.captureError(new Error('Test error'));
      }
      
      // Check threshold (this would normally be done periodically)
      errorTracker.checkThresholds();
      
      expect(mockCallback).toHaveBeenCalledWith({
        threshold: 5,
        actual: 6,
        window: 60
      });
    });

    it('should detect error spikes', () => {
      const mockCallback = jest.fn();
      
      errorTracker.setSpikeDetection({
        multiplier: 2, // 2x normal rate
        baselineWindow: 300, // 5 minutes
        callback: mockCallback
      });
      
      // Simulate normal rate (2 errors)
      errorTracker.captureError(new Error('Normal 1'), { timestamp: Date.now() - 180000 });
      errorTracker.captureError(new Error('Normal 2'), { timestamp: Date.now() - 120000 });
      
      // Simulate spike (5 errors in last minute)
      for (let i = 0; i < 5; i++) {
        errorTracker.captureError(new Error(`Spike ${i}`));
      }
      
      errorTracker.detectSpikes();
      
      expect(mockCallback).toHaveBeenCalled();
    });
  });

  describe('Error Export', () => {
    it('should export error summary', () => {
      errorTracker.captureError(new AppError(400, 'Error 1', ErrorCodes.VALIDATION_ERROR));
      errorTracker.captureError(new AppError(401, 'Error 2', ErrorCodes.AUTH_ERROR));
      
      const summary = errorTracker.exportSummary();
      
      expect(summary.totalErrors).toBe(2);
      expect(summary.errorsByCode).toBeDefined();
      expect(summary.errorsByCode[ErrorCodes.VALIDATION_ERROR]).toBe(1);
      expect(summary.errorsByCode[ErrorCodes.AUTH_ERROR]).toBe(1);
      expect(summary.recentErrors).toHaveLength(2);
    });

    it('should export errors in JSON format', () => {
      errorTracker.captureError(new Error('Test error'), { userId: '123' });
      
      const json = errorTracker.exportJSON();
      const parsed = JSON.parse(json);
      
      expect(parsed.errors).toHaveLength(1);
      expect(parsed.errors[0].message).toBe('Test error');
      expect(parsed.errors[0].context.userId).toBe('123');
    });
  });

  describe('Error Cleanup', () => {
    it('should clean old errors', () => {
      const now = Date.now();
      
      // Add old errors
      errorTracker.captureError(new Error('Old 1'), { timestamp: now - 86400000 * 8 }); // 8 days old
      errorTracker.captureError(new Error('Old 2'), { timestamp: now - 86400000 * 8 }); // 8 days old
      errorTracker.captureError(new Error('Recent'), { timestamp: now - 3600000 }); // 1 hour old
      
      errorTracker.cleanOldErrors(7); // Keep 7 days
      
      const errors = errorTracker.getRecentErrors(10);
      expect(errors).toHaveLength(1);
      expect(errors[0].message).toBe('Recent');
    });

    it('should reset all errors', () => {
      errorTracker.captureError(new Error('Error 1'));
      errorTracker.captureError(new Error('Error 2'));
      
      errorTracker.reset();
      
      const errors = errorTracker.getRecentErrors(10);
      expect(errors).toHaveLength(0);
    });
  });

  describe('Integration', () => {
    it('should handle high volume of errors', () => {
      const startTime = Date.now();
      
      // Capture 1000 errors
      for (let i = 0; i < 1000; i++) {
        errorTracker.captureError(
          new AppError(
            i % 2 === 0 ? ErrorCodes.VALIDATION_ERROR : ErrorCodes.AUTH_ERROR,
            `Error ${i}`
          ),
          { index: i }
        );
      }
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      // Should complete quickly
      expect(duration).toBeLessThan(1000);
      
      // Should maintain accuracy
      expect(errorTracker.getRecentErrors(1100)).toHaveLength(1000);
      expect(errorTracker.getErrorsByCode(ErrorCodes.VALIDATION_ERROR)).toHaveLength(500);
    });
  });
});