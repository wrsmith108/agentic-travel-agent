import { MetricsService } from '../metricsService';
import { Result, isOk, isErr } from '../../../utils/result';

// Mock timers
jest.useFakeTimers();

describe('MetricsService', () => {
  let metricsService: MetricsService;

  beforeEach(() => {
    jest.clearAllMocks();
    metricsService = new MetricsService();
  });

  afterEach(() => {
    // Clean up any intervals
    metricsService.shutdown();
  });

  describe('Counter Metrics', () => {
    it('should increment counter successfully', () => {
      const result = metricsService.incrementCounter('api.requests', { endpoint: '/test' });
      
      expect(isOk(result)).toBe(true);
      
      const value = metricsService.getCounter('api.requests');
      expect(value).toBe(1);
    });

    it('should increment counter by custom amount', () => {
      metricsService.incrementCounter('api.requests', {}, 5);
      
      const value = metricsService.getCounter('api.requests');
      expect(value).toBe(5);
    });

    it('should track multiple counters independently', () => {
      metricsService.incrementCounter('api.requests');
      metricsService.incrementCounter('api.errors');
      metricsService.incrementCounter('api.requests');
      
      expect(metricsService.getCounter('api.requests')).toBe(2);
      expect(metricsService.getCounter('api.errors')).toBe(1);
    });

    it('should handle counter labels', () => {
      metricsService.incrementCounter('api.requests', { method: 'GET', endpoint: '/users' });
      metricsService.incrementCounter('api.requests', { method: 'POST', endpoint: '/users' });
      metricsService.incrementCounter('api.requests', { method: 'GET', endpoint: '/users' });
      
      const metrics = metricsService.getCounterWithLabels('api.requests');
      expect(metrics).toHaveLength(2);
      expect(metrics.find(m => m.labels.method === 'GET')?.value).toBe(2);
      expect(metrics.find(m => m.labels.method === 'POST')?.value).toBe(1);
    });
  });

  describe('Gauge Metrics', () => {
    it('should set gauge value', () => {
      const result = metricsService.setGauge('memory.usage', 512);
      
      expect(isOk(result)).toBe(true);
      expect(metricsService.getGauge('memory.usage')).toBe(512);
    });

    it('should update gauge value', () => {
      metricsService.setGauge('memory.usage', 512);
      metricsService.setGauge('memory.usage', 1024);
      
      expect(metricsService.getGauge('memory.usage')).toBe(1024);
    });

    it('should track multiple gauges', () => {
      metricsService.setGauge('memory.usage', 512);
      metricsService.setGauge('cpu.usage', 45.5);
      
      expect(metricsService.getGauge('memory.usage')).toBe(512);
      expect(metricsService.getGauge('cpu.usage')).toBe(45.5);
    });
  });

  describe('Histogram Metrics', () => {
    it('should record histogram values', () => {
      const result = metricsService.recordHistogram('api.latency', 150);
      
      expect(isOk(result)).toBe(true);
    });

    it('should calculate histogram statistics', () => {
      // Record multiple values
      [100, 150, 200, 250, 300, 120, 180].forEach(value => {
        metricsService.recordHistogram('api.latency', value);
      });
      
      const stats = metricsService.getHistogramStats('api.latency');
      expect(stats).toBeDefined();
      expect(stats?.count).toBe(7);
      expect(stats?.min).toBe(100);
      expect(stats?.max).toBe(300);
      expect(stats?.mean).toBeCloseTo(185.7, 1);
    });

    it('should calculate percentiles', () => {
      // Record values for percentile calculation
      for (let i = 1; i <= 100; i++) {
        metricsService.recordHistogram('api.latency', i * 10);
      }
      
      const stats = metricsService.getHistogramStats('api.latency');
      expect(stats?.percentiles.p50).toBeCloseTo(500, 0);
      expect(stats?.percentiles.p95).toBeCloseTo(950, 0);
      expect(stats?.percentiles.p99).toBeCloseTo(990, 0);
    });
  });

  describe('Timer Metrics', () => {
    it('should time function execution', () => {
      const timer = metricsService.startTimer('operation.duration');
      
      // Wait a bit to ensure some duration
      const startTime = performance.now();
      while (performance.now() - startTime < 10) {
        // Busy wait for at least 10ms
      }
      
      const result = timer.end();
      expect(isOk(result)).toBe(true);
      
      const stats = metricsService.getHistogramStats('operation.duration');
      expect(stats?.count).toBe(1);
      expect(stats?.min).toBeGreaterThan(5);
      expect(stats?.min).toBeLessThan(100);
    });

    it('should handle timer with labels', () => {
      const timer = metricsService.startTimer('operation.duration', { operation: 'search' });
      timer.end();
      
      const metrics = metricsService.getHistogramWithLabels('operation.duration');
      expect(metrics).toHaveLength(1);
      expect(metrics[0].labels.operation).toBe('search');
    });
  });

  describe('System Metrics', () => {
    it('should collect system metrics', () => {
      const systemMetrics = metricsService.collectSystemMetrics();
      
      expect(systemMetrics.memory.heapUsed).toBeGreaterThan(0);
      expect(systemMetrics.memory.heapTotal).toBeGreaterThan(0);
      expect(systemMetrics.memory.rss).toBeGreaterThan(0);
      expect(systemMetrics.cpu.user).toBeGreaterThanOrEqual(0);
      expect(systemMetrics.cpu.system).toBeGreaterThanOrEqual(0);
      expect(systemMetrics.uptime).toBeGreaterThan(0);
    });
  });

  describe('Metrics Export', () => {
    it('should export all metrics', () => {
      // Add various metrics
      metricsService.incrementCounter('api.requests', { method: 'GET' });
      metricsService.setGauge('memory.usage', 512);
      metricsService.recordHistogram('api.latency', 150);
      
      const exported = metricsService.exportMetrics();
      
      expect(exported.counters['api.requests']).toBeDefined();
      expect(exported.gauges['memory.usage']).toBeDefined();
      expect(exported.histograms['api.latency']).toBeDefined();
      expect(exported.timestamp).toBeDefined();
    });

    it('should export metrics in Prometheus format', () => {
      metricsService.incrementCounter('api_requests_total', { method: 'GET', status: '200' });
      metricsService.setGauge('memory_usage_bytes', 1024);
      
      const prometheus = metricsService.exportPrometheusFormat();
      
      expect(prometheus).toContain('# TYPE api_requests_total counter');
      expect(prometheus).toContain('api_requests_total{method="GET",status="200"} 1');
      expect(prometheus).toContain('# TYPE memory_usage_bytes gauge');
      expect(prometheus).toContain('memory_usage_bytes 1024');
    });
  });

  describe('Metrics Reset', () => {
    it('should reset all metrics', () => {
      metricsService.incrementCounter('api.requests');
      metricsService.setGauge('memory.usage', 512);
      metricsService.recordHistogram('api.latency', 150);
      
      metricsService.reset();
      
      expect(metricsService.getCounter('api.requests')).toBe(0);
      expect(metricsService.getGauge('memory.usage')).toBe(0);
      expect(metricsService.getHistogramStats('api.latency')).toBeUndefined();
    });

    it('should reset specific metric type', () => {
      metricsService.incrementCounter('api.requests');
      metricsService.setGauge('memory.usage', 512);
      
      metricsService.resetCounters();
      
      expect(metricsService.getCounter('api.requests')).toBe(0);
      expect(metricsService.getGauge('memory.usage')).toBe(512);
    });
  });

  describe('Rate Calculation', () => {
    it('should calculate rate metrics', () => {
      // Record events over time
      metricsService.incrementCounter('events.processed');
      metricsService.incrementCounter('events.processed', {}, 4);
      
      const rate = metricsService.calculateRate('events.processed', 1); // per second
      expect(rate).toBeGreaterThan(0);
      expect(rate).toBeLessThan(500); // Should be 5 events/second * 60 = 300/min
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid metric names', () => {
      const result = metricsService.incrementCounter('');
      
      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error.message).toContain('Invalid metric name');
      }
    });

    it('should handle invalid gauge values', () => {
      const result = metricsService.setGauge('test.gauge', NaN);
      
      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error.message).toContain('Invalid gauge value');
      }
    });

    it('should handle invalid histogram values', () => {
      const result = metricsService.recordHistogram('test.histogram', -1);
      
      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error.message).toContain('Invalid histogram value');
      }
    });
  });

  describe('Metric Aggregation', () => {
    it('should aggregate metrics over time windows', () => {
      // Record recent metrics
      metricsService.incrementCounter('api.requests'); // Recent
      metricsService.incrementCounter('api.requests'); // Recent  
      metricsService.incrementCounter('api.requests'); // Recent
      
      // All should be within the minute window
      const lastMinute = metricsService.getCounterInWindow('api.requests', 60);
      expect(lastMinute).toBe(3);
      
      // All should also be within the second window since they were just created
      const lastSecond = metricsService.getCounterInWindow('api.requests', 1);
      expect(lastSecond).toBe(3);
    });
  });
});