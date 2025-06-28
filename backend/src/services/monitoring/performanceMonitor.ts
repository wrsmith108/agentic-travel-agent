import { v4 as uuidv4 } from 'uuid';
import { createTimestamp } from '@/services/auth/functional/types';
import { Result, ok, err, isErr } from '../../utils/result';
import { AppError, ErrorCodes } from '../../middleware/errorHandler';
import createLogger from '../../utils/logger';
const logger = createLogger('UperformanceMonitor');
const logWarn = (message: string, context?: any) => logger.warn(message, context);

interface TransactionContext {
  [key: string]: any;
}

interface Span {
  id: string;
  name: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  context?: TransactionContext;
}

interface Transaction {
  id: string;
  name: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  spans: Span[];
  context: TransactionContext;
  error?: Error;
  sampled: boolean;
  isSampled: () => boolean;
  startSpan: (name: string, context?: TransactionContext) => SpanInstance;
  setError: (error: Error) => void;
  end: () => Result<void, AppError>;
}

interface SpanInstance {
  id: string;
  end: () => void;
}

interface Trace {
  id: string;
  name: string;
  duration: number;
  spans: Span[];
  timestamp: number;
  error?: Error;
}

interface TransactionStats {
  name: string;
  count: number;
  totalDuration: number;
  avgDuration: number;
  minDuration: number;
  maxDuration: number;
  errorCount: number;
  errorRate: number;
  throughput: number;
}

interface DatabaseQuery {
  query: string;
  duration: number;
  rowCount?: number;
  operation: 'select' | 'insert' | 'update' | 'delete' | 'other';
  error?: string;
}

interface DatabaseStats {
  totalQueries: number;
  avgDuration: number;
  slowQueryCount: number;
  operationCounts: {
    select: number;
    insert: number;
    update: number;
    delete: number;
    other: number;
  };
}

interface APICall {
  method: string;
  endpoint: string;
  duration: number;
  statusCode: number;
  responseSize?: number;
  error?: string;
}

interface APIStats {
  endpoint: string;
  count: number;
  avgDuration: number;
  successRate: number;
  errorRate: number;
  avgResponseSize?: number;
  throughput: number;
}

interface CPUStats {
  usage: number;
  user: number;
  system: number;
}

interface MemoryStats {
  heapUsed: number;
  heapTotal: number;
  rss: number;
  external: number;
  heapUsedPercent: number;
}

interface PerformanceThreshold {
  metric: 'transaction' | 'memory' | 'cpu' | 'database' | 'api';
  threshold: number;
  callback: (alert: {
    metric: string;
    name?: string;
    value: number;
    threshold: number;
  }) => void;
}

export class PerformanceMonitor {
  private transactions: Map<string, TransactionStats> = new Map();
  private traces: Trace[] = [];
  private apiCalls: Map<string, APICall[]> = new Map();
  private databaseQueries: DatabaseQuery[] = [];
  private thresholds: PerformanceThreshold[] = [];
  private samplingRate: number = 1.0;
  private maxTraces: number = 1000;
  private checkInterval?: NodeJS.Timeout;

  constructor() {
    this.startPeriodicChecks();
  }

  startTransaction(name: string, context: TransactionContext = {}): Transaction {
    const id = uuidv4();
    const startTime = performance.now();
    const sampled = Math.random() < this.samplingRate;
    
    const transaction: Transaction = {
      id,
      name,
      startTime,
      spans: [],
      context,
      sampled,
      isSampled: () => sampled,
      startSpan: (spanName: string, spanContext?: TransactionContext) => {
        const spanId = uuidv4();
        const span: Span = {
          id: spanId,
          name: spanName,
          startTime: performance.now(),
          context: spanContext
        };
        
        transaction.spans.push(span);
        
        return {
          id: spanId,
          end: () => {
            span.endTime = performance.now();
            span.duration = span.endTime - span.startTime;
          }
        };
      },
      setError: (error: Error) => {
        transaction.error = error;
      },
      end: () => {
        transaction.endTime = performance.now();
        transaction.duration = transaction.endTime - transaction.startTime;
        
        this.recordTransaction(transaction);
        
        return ok(undefined);
      }
    };

    return transaction;
  }

  recordTransaction(transaction: Transaction): void {
    if (!transaction.duration) return;

    const existing = this.transactions.get(transaction.name);
    
    if (existing) {
      existing.count++;
      existing.totalDuration += transaction.duration;
      existing.avgDuration = existing.totalDuration / existing.count;
      existing.minDuration = Math.min(existing.minDuration, transaction.duration);
      existing.maxDuration = Math.max(existing.maxDuration, transaction.duration);
      
      if (isErr(transaction)) {
        existing.errorCount++;
      }
      
      existing.errorRate = existing.errorCount / existing.count;
      existing.throughput = existing.count / ((Date.now() - (Date.now() - existing.totalDuration)) / 1000);
    } else {
      this.transactions.set(transaction.name, {
        name: transaction.name,
        count: 1,
        totalDuration: transaction.duration,
        avgDuration: transaction.duration,
        minDuration: transaction.duration,
        maxDuration: transaction.duration,
        errorCount: isErr(transaction) ? 1 : 0,
        errorRate: isErr(transaction) ? 1 : 0,
        throughput: 1
      });
    }

    // Store trace if sampled
    if (transaction.sampled) {
      const trace: Trace = {
        id: transaction.id,
        name: transaction.name,
        duration: transaction.duration,
        spans: [...transaction.spans],
        timestamp: Date.now(),
        error: transaction.error
      };

      this.traces.push(trace);
      
      // Limit stored traces
      if (this.traces.length > this.maxTraces) {
        this.traces = this.traces.slice(-this.maxTraces);
      }
    }

    // Check performance thresholds
    this.checkTransactionThreshold(transaction);
  }

  getTransactionStats(name: string): TransactionStats | undefined {
    return this.transactions.get(name);
  }

  getLastTrace(): Trace | undefined {
    return this.traces[this.traces.length - 1];
  }

  getTraces(): Trace[] {
    return [...this.traces];
  }

  recordDatabaseQuery(query: DatabaseQuery): void {
    this.databaseQueries.push({
      ...query,
      operation: query.operation || 'other'
    });

    this.checkDatabaseThreshold(query);
  }

  getDatabaseStats(): DatabaseStats {
    const total = this.databaseQueries.length;
    const totalDuration = this.databaseQueries.reduce((sum, q) => sum + q.duration, 0);
    
    const operationCounts = {
      select: 0,
      insert: 0,
      update: 0,
      delete: 0,
      other: 0
    };

    this.databaseQueries.forEach(query => {
      operationCounts[query.operation]++;
    });

    const slowQueryCount = this.databaseQueries.filter(q => q.duration > 1000).length;

    return {
      totalQueries: total,
      avgDuration: total > 0 ? totalDuration / total : 0,
      slowQueryCount,
      operationCounts
    };
  }

  getSlowQueries(thresholdMs: number): DatabaseQuery[] {
    return this.databaseQueries
      .filter(query => query.duration > thresholdMs)
      .sort((a, b) => b.duration - a.duration);
  }

  recordAPICall(call: APICall): void {
    const key = call.endpoint;
    const existing = this.apiCalls.get(key) || [];
    existing.push(call);
    this.apiCalls.set(key, existing);

    this.checkAPIThreshold(call);
  }

  getAPIStats(endpoint: string): APIStats | undefined {
    const calls = this.apiCalls.get(endpoint);
    if (!calls || calls.length === 0) return undefined;

    const totalDuration = calls.reduce((sum, call) => sum + call.duration, 0);
    const successfulCalls = calls.filter(call => call.statusCode >= 200 && call.statusCode < 400);
    const responseSizes = calls.filter(call => call.responseSize).map(call => call.responseSize!);
    
    return {
      endpoint,
      count: calls.length,
      avgDuration: totalDuration / calls.length,
      successRate: successfulCalls.length / calls.length,
      errorRate: (calls.length - successfulCalls.length) / calls.length,
      avgResponseSize: responseSizes.length > 0 
        ? responseSizes.reduce((sum, size) => sum + size, 0) / responseSizes.length 
        : undefined,
      throughput: calls.length
    };
  }

  getCPUStats(): CPUStats {
    const cpuUsage = process.cpuUsage();
    const totalUsage = cpuUsage.user + cpuUsage.system;
    
    return {
      usage: Math.min(100, (totalUsage / 1000000) * 100), // Convert to percentage
      user: cpuUsage.user / 1000000,
      system: cpuUsage.system / 1000000
    };
  }

  getMemoryStats(): MemoryStats {
    const memUsage = process.memoryUsage();
    
    return {
      heapUsed: memUsage.heapUsed,
      heapTotal: memUsage.heapTotal,
      rss: memUsage.rss,
      external: memUsage.external,
      heapUsedPercent: (memUsage.heapUsed / memUsage.heapTotal) * 100
    };
  }

  async getEventLoopLag(): Promise<number> {
    return new Promise((resolve) => {
      const start = performance.now();
      setImmediate(() => {
        const lag = performance.now() - start;
        resolve(lag);
      });
    });
  }

  setPerformanceThreshold(threshold: PerformanceThreshold): void {
    this.thresholds.push(threshold);
  }

  setSamplingRate(rate: number): void {
    this.samplingRate = Math.max(0, Math.min(1, rate));
  }

  checkThresholds(): void {
    this.thresholds.forEach(threshold => {
      switch (threshold.metric) {
        case 'memory':
          const memStats = this.getMemoryStats();
          if (memStats.heapUsedPercent > threshold.threshold) {
            threshold.callback({
              metric: 'memory',
              value: memStats.heapUsedPercent,
              threshold: threshold.threshold
            });
          }
          break;
          
        case 'cpu':
          const cpuStats = this.getCPUStats();
          if (cpuStats.usage > threshold.threshold) {
            threshold.callback({
              metric: 'cpu',
              value: cpuStats.usage,
              threshold: threshold.threshold
            });
          }
          break;
      }
    });
  }

  generateSummary() {
    const transactionStats = Array.from(this.transactions.values());
    const apiStats = Array.from(this.apiCalls.keys()).map(endpoint => 
      this.getAPIStats(endpoint)
    ).filter(Boolean);

    return {
      transactions: {
        total: transactionStats.reduce((sum, t) => sum + t.count, 0),
        avgDuration: transactionStats.length > 0 
          ? transactionStats.reduce((sum, t) => sum + t.avgDuration, 0) / transactionStats.length 
          : 0,
        errorRate: transactionStats.length > 0 
          ? transactionStats.reduce((sum, t) => sum + t.errorRate, 0) / transactionStats.length 
          : 0
      },
      api: {
        totalCalls: apiStats.reduce((sum, a) => sum + a!.count, 0),
        avgDuration: apiStats.length > 0 
          ? apiStats.reduce((sum, a) => sum + a!.avgDuration, 0) / apiStats.length 
          : 0,
        successRate: apiStats.length > 0 
          ? apiStats.reduce((sum, a) => sum + a!.successRate, 0) / apiStats.length 
          : 0
      },
      database: this.getDatabaseStats(),
      resources: {
        memory: this.getMemoryStats(),
        cpu: this.getCPUStats()
      },
      timestamp: createTimestamp()
    };
  }

  exportData() {
    return {
      transactions: Array.from(this.transactions.values()),
      traces: this.traces,
      apiStats: Array.from(this.apiCalls.keys()).map(endpoint => 
        this.getAPIStats(endpoint)
      ).filter(Boolean),
      databaseStats: this.getDatabaseStats(),
      summary: this.generateSummary()
    };
  }

  cleanOldData(daysToKeep: number): void {
    const cutoff = Date.now() - (daysToKeep * 24 * 60 * 60 * 1000);
    
    const beforeTraces = this.traces.length;
    this.traces = this.traces.filter(trace => trace.timestamp >= cutoff);
    
    const beforeQueries = this.databaseQueries.length;
    // Database queries don't have timestamps in this implementation
    // In a real system, you'd add timestamps and filter them
    
    const removedTraces = beforeTraces - this.traces.length;
    if (removedTraces > 0) {
      logWarn(`Cleaned ${removedTraces} old performance traces`);
    }
  }

  reset(): void {
    this.transactions.clear();
    this.traces = [];
    this.apiCalls.clear();
    this.databaseQueries = [];
  }

  shutdown(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
    }
  }

  private checkTransactionThreshold(transaction: Transaction): void {
    if (!transaction.duration) return;

    this.thresholds.forEach(threshold => {
      if (threshold.metric === 'transaction' && transaction.duration! > threshold.threshold) {
        threshold.callback({
          metric: 'transaction',
          name: transaction.name,
          value: transaction.duration!,
          threshold: threshold.threshold
        });
      }
    });
  }

  private checkDatabaseThreshold(query: DatabaseQuery): void {
    this.thresholds.forEach(threshold => {
      if (threshold.metric === 'database' && query.duration > threshold.threshold) {
        threshold.callback({
          metric: 'database',
          name: query.operation,
          value: query.duration,
          threshold: threshold.threshold
        });
      }
    });
  }

  private checkAPIThreshold(call: APICall): void {
    this.thresholds.forEach(threshold => {
      if (threshold.metric === 'api' && call.duration > threshold.threshold) {
        threshold.callback({
          metric: 'api',
          name: call.endpoint,
          value: call.duration,
          threshold: threshold.threshold
        });
      }
    });
  }

  private startPeriodicChecks(): void {
    // Check thresholds every 30 seconds
    this.checkInterval = setInterval(() => {
      this.checkThresholds();
      
      // Clean old data occasionally
      if (Math.random() < 0.01) { // ~once every 50 minutes
        this.cleanOldData(7);
      }
    }, 30000);
  }
}

// Export singleton instance
export const performanceMonitor = new PerformanceMonitor();

// Also export for testing
export default PerformanceMonitor;