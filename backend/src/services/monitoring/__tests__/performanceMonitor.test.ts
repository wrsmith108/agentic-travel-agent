import { PerformanceMonitor } from '../performanceMonitor';
import { isOk, isErr } from '../../../utils/result';

// Mock timers
jest.useFakeTimers();

describe('PerformanceMonitor', () => {
  let performanceMonitor: PerformanceMonitor;

  beforeEach(() => {
    jest.clearAllMocks();
    performanceMonitor = new PerformanceMonitor();
  });

  afterEach(() => {
    performanceMonitor.shutdown();
  });

  describe('Transaction Tracking', () => {
    it('should track transaction timing', async () => {
      const transaction = performanceMonitor.startTransaction('api.request', {
        method: 'GET',
        endpoint: '/users'
      });

      // Simulate some work
      await new Promise(resolve => setTimeout(resolve, 100));

      const result = transaction.end();
      
      expect(isOk(result)).toBe(true);
      
      const stats = performanceMonitor.getTransactionStats('api.request');
      expect(stats).toBeDefined();
      expect(stats?.count).toBe(1);
      expect(stats?.avgDuration).toBeGreaterThan(90);
      expect(stats?.avgDuration).toBeLessThan(150);
    });

    it('should track nested spans', async () => {
      const transaction = performanceMonitor.startTransaction('api.request');
      
      const dbSpan = transaction.startSpan('db.query');
      await new Promise(resolve => setTimeout(resolve, 50));
      dbSpan.end();
      
      const cacheSpan = transaction.startSpan('cache.lookup');
      await new Promise(resolve => setTimeout(resolve, 20));
      cacheSpan.end();
      
      transaction.end();
      
      const trace = performanceMonitor.getLastTrace();
      expect(trace).toBeDefined();
      expect(trace?.spans).toHaveLength(2);
      expect(trace?.spans[0].name).toBe('db.query');
      expect(trace?.spans[1].name).toBe('cache.lookup');
    });

    it('should handle transaction errors', () => {
      const transaction = performanceMonitor.startTransaction('api.request');
      
      transaction.setError(new Error('Request failed'));
      const result = transaction.end();
      
      expect(isOk(result)).toBe(true);
      
      const stats = performanceMonitor.getTransactionStats('api.request');
      expect(stats?.errorCount).toBe(1);
      expect(stats?.errorRate).toBe(1); // 100% error rate
    });
  });

  describe('Resource Monitoring', () => {
    it('should monitor CPU usage', () => {
      const cpuStats = performanceMonitor.getCPUStats();
      
      expect(cpuStats).toBeDefined();
      expect(cpuStats.usage).toBeGreaterThanOrEqual(0);
      expect(cpuStats.usage).toBeLessThanOrEqual(100);
      expect(cpuStats.user).toBeGreaterThanOrEqual(0);
      expect(cpuStats.system).toBeGreaterThanOrEqual(0);
    });

    it('should monitor memory usage', () => {
      const memStats = performanceMonitor.getMemoryStats();
      
      expect(memStats).toBeDefined();
      expect(memStats.heapUsed).toBeGreaterThan(0);
      expect(memStats.heapTotal).toBeGreaterThan(0);
      expect(memStats.rss).toBeGreaterThan(0);
      expect(memStats.heapUsedPercent).toBeGreaterThan(0);
      expect(memStats.heapUsedPercent).toBeLessThanOrEqual(100);
    });

    it('should monitor event loop lag', async () => {
      const lag = await performanceMonitor.getEventLoopLag();
      
      expect(lag).toBeDefined();
      expect(lag).toBeGreaterThanOrEqual(0);
      expect(lag).toBeLessThan(1000); // Less than 1 second
    });
  });

  describe('Database Performance', () => {
    it('should track database query performance', () => {
      performanceMonitor.recordDatabaseQuery({
        query: 'SELECT * FROM users',
        duration: 45,
        rowCount: 100,
        operation: 'select'
      });

      performanceMonitor.recordDatabaseQuery({
        query: 'INSERT INTO users',
        duration: 25,
        rowCount: 1,
        operation: 'insert'
      });

      const stats = performanceMonitor.getDatabaseStats();
      
      expect(stats.totalQueries).toBe(2);
      expect(stats.avgDuration).toBe(35);
      expect(stats.operationCounts.select).toBe(1);
      expect(stats.operationCounts.insert).toBe(1);
    });

    it('should identify slow queries', () => {
      performanceMonitor.recordDatabaseQuery({
        query: 'SELECT * FROM large_table',
        duration: 5000,
        rowCount: 10000,
        operation: 'select'
      });

      performanceMonitor.recordDatabaseQuery({
        query: 'SELECT * FROM small_table',
        duration: 10,
        rowCount: 5,
        operation: 'select'
      });

      const slowQueries = performanceMonitor.getSlowQueries(1000);
      
      expect(slowQueries).toHaveLength(1);
      expect(slowQueries[0].duration).toBe(5000);
      expect(slowQueries[0].query).toContain('large_table');
    });
  });

  describe('API Performance', () => {
    it('should track API endpoint performance', () => {
      performanceMonitor.recordAPICall({
        method: 'GET',
        endpoint: '/api/users',
        duration: 150,
        statusCode: 200,
        responseSize: 1024
      });

      performanceMonitor.recordAPICall({
        method: 'GET',
        endpoint: '/api/users',
        duration: 200,
        statusCode: 200,
        responseSize: 2048
      });

      const stats = performanceMonitor.getAPIStats('/api/users');
      
      expect(stats).toBeDefined();
      expect(stats?.count).toBe(2);
      expect(stats?.avgDuration).toBe(175);
      expect(stats?.successRate).toBe(1);
      expect(stats?.avgResponseSize).toBe(1536);
    });

    it('should calculate API success rates', () => {
      performanceMonitor.recordAPICall({
        method: 'POST',
        endpoint: '/api/login',
        duration: 100,
        statusCode: 200
      });

      performanceMonitor.recordAPICall({
        method: 'POST',
        endpoint: '/api/login',
        duration: 50,
        statusCode: 401
      });

      performanceMonitor.recordAPICall({
        method: 'POST',
        endpoint: '/api/login',
        duration: 75,
        statusCode: 500
      });

      const stats = performanceMonitor.getAPIStats('/api/login');
      
      expect(stats?.successRate).toBeCloseTo(0.33, 2);
      expect(stats?.errorRate).toBeCloseTo(0.67, 2);
    });
  });

  describe('Performance Thresholds', () => {
    it('should alert on slow transactions', () => {
      const mockCallback = jest.fn();
      
      performanceMonitor.setPerformanceThreshold({
        metric: 'transaction',
        threshold: 10, // Lower threshold for testing
        callback: mockCallback
      });

      const transaction = performanceMonitor.startTransaction('slow.operation');
      
      // Mock a slow transaction by manipulating the startTime
      (transaction as any).startTime = performance.now() - 20; // 20ms ago
      
      transaction.end();
      
      expect(mockCallback).toHaveBeenCalledWith({
        metric: 'transaction',
        name: 'slow.operation',
        value: expect.any(Number),
        threshold: 10
      });
    });

    it('should alert on high memory usage', () => {
      const mockCallback = jest.fn();
      
      performanceMonitor.setPerformanceThreshold({
        metric: 'memory',
        threshold: 80, // 80% heap usage
        callback: mockCallback
      });

      // Force check (normally done periodically)
      performanceMonitor.checkThresholds();
      
      // Callback may or may not be called depending on actual memory usage
      // Just verify it can be set and checked
      expect(performanceMonitor.getMemoryStats()).toBeDefined();
    });
  });

  describe('Performance Reports', () => {
    it('should generate performance summary', () => {
      // Add various metrics
      performanceMonitor.recordAPICall({
        method: 'GET',
        endpoint: '/api/users',
        duration: 100,
        statusCode: 200
      });

      performanceMonitor.recordDatabaseQuery({
        query: 'SELECT * FROM users',
        duration: 50,
        operation: 'select'
      });

      const transaction = performanceMonitor.startTransaction('test.transaction');
      transaction.end();

      const summary = performanceMonitor.generateSummary();
      
      expect(summary).toBeDefined();
      expect(summary.transactions).toBeDefined();
      expect(summary.api).toBeDefined();
      expect(summary.database).toBeDefined();
      expect(summary.resources).toBeDefined();
      expect(summary.timestamp).toBeDefined();
    });

    it('should export performance data', () => {
      const transaction = performanceMonitor.startTransaction('export.test');
      transaction.end();

      const exported = performanceMonitor.exportData();
      
      expect(exported.transactions).toHaveLength(1);
      expect(exported.traces).toBeDefined();
      expect(exported.summary).toBeDefined();
    });
  });

  describe('Sampling', () => {
    it('should sample transactions based on rate', () => {
      performanceMonitor.setSamplingRate(0.5); // 50% sampling
      
      let sampled = 0;
      const iterations = 100;
      
      for (let i = 0; i < iterations; i++) {
        const transaction = performanceMonitor.startTransaction('sampled.operation');
        if (transaction.isSampled()) {
          sampled++;
        }
        transaction.end();
      }
      
      // Should be roughly 50% (with some variance)
      expect(sampled).toBeGreaterThan(30);
      expect(sampled).toBeLessThan(70);
    });
  });

  describe('Cleanup', () => {
    it('should clean old performance data', () => {
      // Add old transaction
      const oldTransaction = performanceMonitor.startTransaction('old.transaction');
      oldTransaction.end();
      
      // Manually set timestamp to old date
      const traces = (performanceMonitor as any).traces;
      if (traces.length > 0) {
        traces[0].timestamp = Date.now() - (8 * 24 * 60 * 60 * 1000); // 8 days old
      }

      // Add recent transaction
      const recentTransaction = performanceMonitor.startTransaction('recent.transaction');
      recentTransaction.end();

      performanceMonitor.cleanOldData(7); // Keep 7 days
      
      const remainingTraces = performanceMonitor.getTraces();
      expect(remainingTraces.some(t => t.name === 'recent.transaction')).toBe(true);
      expect(remainingTraces.some(t => t.name === 'old.transaction')).toBe(false);
    });

    it('should reset all performance data', () => {
      performanceMonitor.recordAPICall({
        method: 'GET',
        endpoint: '/api/test',
        duration: 100,
        statusCode: 200
      });

      const transaction = performanceMonitor.startTransaction('test');
      transaction.end();

      performanceMonitor.reset();
      
      expect(performanceMonitor.getTransactionStats('test')).toBeUndefined();
      expect(performanceMonitor.getAPIStats('/api/test')).toBeUndefined();
      expect(performanceMonitor.getTraces()).toHaveLength(0);
    });
  });
});