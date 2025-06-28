import { v4 as uuidv4 } from 'uuid';
import { Result, ok, err } from '../../utils/result';
import { AppError, ErrorCodes } from '../../middleware/errorHandler';
import createLogger from '../../utils/logger';
const logger = createLogger('UerrorTracker');
const logError = (message: string, error?: any, context?: any) => logger.error(message, { error, ...context });
const logWarn = (message: string, context?: any) => logger.warn(message, context);

interface ErrorContext {
  [key: string]: any;
  timestamp?: number;
  severity?: 'low' | 'medium' | 'high' | 'critical';
}

interface TrackedError {
  id: string;
  message: string;
  code: string;
  stack?: string;
  context: ErrorContext;
  timestamp: number;
  count: number;
}

interface ErrorGroup {
  message: string;
  code: string;
  count: number;
  firstSeen: number;
  lastSeen: number;
  examples: TrackedError[];
}

interface ErrorTrendPoint {
  timestamp: number;
  count: number;
  errorRate: number;
}

interface ThresholdAlert {
  errorRate: number;
  window: number;
  callback: (alert: { threshold: number; actual: number; window: number }) => void;
}

interface SpikeDetection {
  multiplier: number;
  baselineWindow: number;
  callback: (spike: { baseline: number; current: number; multiplier: number }) => void;
}

interface ErrorImpact {
  score: number;
  criticalErrors: number;
  highErrors: number;
  totalErrors: number;
  errorRate: number;
}

export class ErrorTracker {
  private errors: TrackedError[] = [];
  private errorGroups: Map<string, ErrorGroup> = new Map();
  private thresholdAlerts: ThresholdAlert[] = [];
  private spikeDetection?: SpikeDetection;
  private checkInterval?: NodeJS.Timeout;
  private maxErrors: number = 10000;

  constructor() {
    this.startPeriodicChecks();
  }

  captureError(error: Error | AppError, context: ErrorContext = {}): Result<void, AppError> {
    try {
      const trackedError: TrackedError = {
        id: uuidv4(),
        message: error.message,
        code: error instanceof AppError ? error.code : 'UNKNOWN_ERROR',
        stack: error.stack,
        context: {
          ...context,
          timestamp: context.timestamp || Date.now()
        },
        timestamp: context.timestamp || Date.now(),
        count: 1
      };

      this.errors.push(trackedError);
      this.updateErrorGroup(trackedError);

      // Limit stored errors
      if (this.errors.length > this.maxErrors) {
        this.errors = this.errors.slice(-this.maxErrors);
      }

      // Log the error
      logError('Error captured', error, { errorId: trackedError.id, ...context });

      return ok(undefined);
    } catch (err) {
      logError('Failed to capture error', err);
      return err(new AppError(500, 'Failed to capture error', ErrorCodes.INTERNAL_SERVER_ERROR));
    }
  }

  getRecentErrors(limit: number): TrackedError[] {
    return this.errors
      .slice(-limit)
      .sort((a, b) => b.timestamp - a.timestamp);
  }

  getErrorsByCode(code: string): TrackedError[] {
    return this.errors.filter(error => error.code === code);
  }

  getErrorsInTimeRange(start: number, end: number): TrackedError[] {
    return this.errors.filter(error => 
      error.timestamp >= start && error.timestamp <= end
    );
  }

  searchErrors(query: string): TrackedError[] {
    const lowerQuery = query.toLowerCase();
    return this.errors.filter(error =>
      error.message.toLowerCase().includes(lowerQuery) ||
      error.code.toLowerCase().includes(lowerQuery) ||
      JSON.stringify(error.context).toLowerCase().includes(lowerQuery)
    );
  }

  getErrorGroups(): ErrorGroup[] {
    return Array.from(this.errorGroups.values())
      .sort((a, b) => b.count - a.count);
  }

  getErrorTrend(interval: '1m' | '5m' | '15m' | '1h', points: number): ErrorTrendPoint[] {
    const now = Date.now();
    const intervalMs = this.getIntervalMs(interval);
    const trend: ErrorTrendPoint[] = [];

    for (let i = points - 1; i >= 0; i--) {
      const endTime = now - (i * intervalMs);
      const startTime = endTime - intervalMs;
      
      const errors = this.getErrorsInTimeRange(startTime, endTime);
      const errorRate = errors.length / (intervalMs / 1000 / 60); // Per minute

      trend.push({
        timestamp: endTime,
        count: errors.length,
        errorRate
      });
    }

    return trend;
  }

  getErrorRate(windowSeconds: number): number {
    const now = Date.now();
    const cutoff = now - (windowSeconds * 1000);
    const recentErrors = this.errors.filter(e => e.timestamp >= cutoff);
    return recentErrors.length / windowSeconds * 60; // Per minute
  }

  getTopErrorTypes(limit: number): Array<{ code: string; count: number }> {
    const counts = new Map<string, number>();
    
    this.errors.forEach(error => {
      counts.set(error.code, (counts.get(error.code) || 0) + 1);
    });

    return Array.from(counts.entries())
      .map(([code, count]) => ({ code, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);
  }

  calculateErrorImpact(): ErrorImpact {
    const criticalErrors = this.errors.filter(e => 
      e.context.severity === 'critical'
    ).length;
    
    const highErrors = this.errors.filter(e => 
      e.context.severity === 'high'
    ).length;

    const errorRate = this.getErrorRate(300); // 5 minute rate
    
    // Impact score based on severity and rate
    const score = (criticalErrors * 10) + (highErrors * 5) + (errorRate * 2);

    return {
      score,
      criticalErrors,
      highErrors,
      totalErrors: this.errors.length,
      errorRate
    };
  }

  setThresholdAlert(alert: ThresholdAlert): void {
    this.thresholdAlerts.push(alert);
  }

  setSpikeDetection(detection: SpikeDetection): void {
    this.spikeDetection = detection;
  }

  checkThresholds(): void {
    this.thresholdAlerts.forEach(alert => {
      const currentRate = this.getErrorRate(alert.window);
      
      if (currentRate > alert.errorRate) {
        alert.callback({
          threshold: alert.errorRate,
          actual: currentRate,
          window: alert.window
        });
      }
    });
  }

  detectSpikes(): void {
    if (!this.spikeDetection) return;

    const { multiplier, baselineWindow } = this.spikeDetection;
    
    // Calculate baseline (average over baseline window)
    const baselineEnd = Date.now() - 60000; // Exclude last minute
    const baselineStart = baselineEnd - (baselineWindow * 1000);
    const baselineErrors = this.getErrorsInTimeRange(baselineStart, baselineEnd);
    const baselineRate = baselineErrors.length / baselineWindow * 60;

    // Calculate current rate (last minute)
    const currentRate = this.getErrorRate(60);

    if (currentRate > baselineRate * multiplier && baselineRate > 0) {
      this.spikeDetection.callback({
        baseline: baselineRate,
        current: currentRate,
        multiplier
      });
    }
  }

  exportSummary() {
    const errorsByCode: { [code: string]: number } = {};
    
    this.errors.forEach(error => {
      errorsByCode[error.code] = (errorsByCode[error.code] || 0) + 1;
    });

    return {
      totalErrors: this.errors.length,
      errorsByCode,
      errorGroups: this.getErrorGroups().length,
      errorRate: this.getErrorRate(300),
      impact: this.calculateErrorImpact(),
      recentErrors: this.getRecentErrors(10),
      timestamp: new Date().toISOString()
    };
  }

  exportJSON(): string {
    return JSON.stringify({
      errors: this.errors,
      groups: Array.from(this.errorGroups.values()),
      summary: this.exportSummary()
    }, null, 2);
  }

  cleanOldErrors(daysToKeep: number): void {
    const cutoff = Date.now() - (daysToKeep * 24 * 60 * 60 * 1000);
    const beforeCount = this.errors.length;
    
    this.errors = this.errors.filter(error => error.timestamp >= cutoff);
    
    const removed = beforeCount - this.errors.length;
    if (removed > 0) {
      logWarn(`Cleaned ${removed} old errors`);
    }

    // Rebuild groups
    this.rebuildErrorGroups();
  }

  reset(): void {
    this.errors = [];
    this.errorGroups.clear();
  }

  shutdown(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
    }
  }

  private updateErrorGroup(error: TrackedError): void {
    const key = `${error.code}:${error.message}`;
    const existing = this.errorGroups.get(key);

    if (existing) {
      existing.count++;
      existing.lastSeen = error.timestamp;
      existing.examples.push(error);
      
      // Keep only recent examples
      if (existing.examples.length > 5) {
        existing.examples = existing.examples.slice(-5);
      }
    } else {
      this.errorGroups.set(key, {
        message: error.message,
        code: error.code,
        count: 1,
        firstSeen: error.timestamp,
        lastSeen: error.timestamp,
        examples: [error]
      });
    }
  }

  private rebuildErrorGroups(): void {
    this.errorGroups.clear();
    this.errors.forEach(error => this.updateErrorGroup(error));
  }

  private startPeriodicChecks(): void {
    // Check thresholds and spikes every 30 seconds
    this.checkInterval = setInterval(() => {
      this.checkThresholds();
      this.detectSpikes();
      
      // Clean old errors daily
      if (Math.random() < 0.001) { // ~once per day with 30s intervals
        this.cleanOldErrors(7);
      }
    }, 30000);
  }

  private getIntervalMs(interval: '1m' | '5m' | '15m' | '1h'): number {
    switch (interval) {
      case '1m': return 60 * 1000;
      case '5m': return 5 * 60 * 1000;
      case '15m': return 15 * 60 * 1000;
      case '1h': return 60 * 60 * 1000;
    }
  }
}

// Export singleton instance
export const errorTracker = new ErrorTracker();

// Also export for testing
export default ErrorTracker;