import { Result, ok, err } from '../../utils/result';
import { AppError, ErrorCodes } from '../../middleware/errorHandler';
import logger from '../../utils/logger';

const logInfo = (message: string, context?: any) => logger.info(message, context);
const logError = (message: string, error?: any, context?: any) => logger.error(message, { error, ...context });

interface Labels {
  [key: string]: string | number;
  timestamp?: number;
}

interface MetricValue {
  value: number;
  labels: Labels;
  timestamp: number;
}

interface HistogramStats {
  count: number;
  min: number;
  max: number;
  mean: number;
  sum: number;
  percentiles: {
    p50: number;
    p75: number;
    p90: number;
    p95: number;
    p99: number;
  };
}

interface SystemMetrics {
  memory: {
    heapUsed: number;
    heapTotal: number;
    rss: number;
    external: number;
  };
  cpu: {
    user: number;
    system: number;
  };
  uptime: number;
  timestamp: number;
}

interface Timer {
  startTime: number;
  labels?: Labels;
  end: () => Result<void, AppError>;
}

export class MetricsService {
  private counters: Map<string, MetricValue[]> = new Map();
  private gauges: Map<string, MetricValue> = new Map();
  private histograms: Map<string, number[]> = new Map();
  private histogramLabels: Map<string, MetricValue[]> = new Map();
  private intervals: NodeJS.Timeout[] = [];

  constructor() {
    this.startSystemMetricsCollection();
  }

  incrementCounter(name: string, labels: Labels = {}, value: number = 1): Result<void, AppError> {
    if (!name) {
      return err(new AppError(400, 'Invalid metric name', ErrorCodes.VALIDATION_ERROR));
    }

    try {
      const metricKey = this.getMetricKey(name, labels);
      const existingMetrics = this.counters.get(name) || [];
      
      const existingMetric = existingMetrics.find(m => 
        this.labelsMatch(m.labels, labels)
      );

      if (existingMetric) {
        existingMetric.value += value;
        existingMetric.timestamp = Date.now();
      } else {
        existingMetrics.push({
          value,
          labels: { ...labels, timestamp: labels.timestamp || Date.now() },
          timestamp: labels.timestamp || Date.now()
        });
      }

      this.counters.set(name, existingMetrics);
      return ok(undefined);
    } catch (error) {
      logError('Failed to increment counter', error);
      return err(new AppError(500, 'Failed to increment counter', ErrorCodes.INTERNAL_SERVER_ERROR));
    }
  }

  getCounter(name: string): number {
    const metrics = this.counters.get(name) || [];
    return metrics.reduce((sum, metric) => sum + metric.value, 0);
  }

  getCounterWithLabels(name: string): MetricValue[] {
    return this.counters.get(name) || [];
  }

  getCounterInWindow(name: string, windowSeconds: number): number {
    const metrics = this.counters.get(name) || [];
    const cutoff = Date.now() - (windowSeconds * 1000);
    
    return metrics
      .filter(m => m.timestamp >= cutoff)
      .reduce((sum, m) => sum + m.value, 0);
  }

  setGauge(name: string, value: number, labels: Labels = {}): Result<void, AppError> {
    if (!name) {
      return err(new AppError(400, 'Invalid metric name', ErrorCodes.VALIDATION_ERROR));
    }

    if (isNaN(value) || !isFinite(value)) {
      return err(new AppError(400, 'Invalid gauge value', ErrorCodes.VALIDATION_ERROR));
    }

    try {
      this.gauges.set(name, {
        value,
        labels,
        timestamp: Date.now()
      });
      return ok(undefined);
    } catch (error) {
      logError('Failed to set gauge', error);
      return err(new AppError(500, 'Failed to set gauge', ErrorCodes.INTERNAL_SERVER_ERROR));
    }
  }

  getGauge(name: string): number {
    return this.gauges.get(name)?.value || 0;
  }

  recordHistogram(name: string, value: number, labels: Labels = {}): Result<void, AppError> {
    if (!name) {
      return err(new AppError(400, 'Invalid metric name', ErrorCodes.VALIDATION_ERROR));
    }

    if (value < 0 || !isFinite(value)) {
      return err(new AppError(400, 'Invalid histogram value', ErrorCodes.VALIDATION_ERROR));
    }

    try {
      const values = this.histograms.get(name) || [];
      values.push(value);
      this.histograms.set(name, values);

      // Store labeled version
      if (Object.keys(labels).length > 0) {
        const labeledMetrics = this.histogramLabels.get(name) || [];
        labeledMetrics.push({
          value,
          labels,
          timestamp: Date.now()
        });
        this.histogramLabels.set(name, labeledMetrics);
      }

      return ok(undefined);
    } catch (error) {
      logError('Failed to record histogram', error);
      return err(new AppError(500, 'Failed to record histogram', ErrorCodes.INTERNAL_SERVER_ERROR));
    }
  }

  getHistogramStats(name: string): HistogramStats | undefined {
    const values = this.histograms.get(name);
    if (!values || values.length === 0) {
      return undefined;
    }

    const sorted = [...values].sort((a, b) => a - b);
    const count = sorted.length;
    const sum = sorted.reduce((acc, val) => acc + val, 0);
    
    return {
      count,
      min: sorted[0],
      max: sorted[count - 1],
      mean: sum / count,
      sum,
      percentiles: {
        p50: this.getPercentile(sorted, 0.5),
        p75: this.getPercentile(sorted, 0.75),
        p90: this.getPercentile(sorted, 0.9),
        p95: this.getPercentile(sorted, 0.95),
        p99: this.getPercentile(sorted, 0.99)
      }
    };
  }

  getHistogramWithLabels(name: string): MetricValue[] {
    return this.histogramLabels.get(name) || [];
  }

  startTimer(name: string, labels: Labels = {}): Timer {
    const startTime = Date.now();
    
    return {
      startTime,
      labels,
      end: () => {
        const duration = Date.now() - startTime;
        return this.recordHistogram(name, duration, labels);
      }
    };
  }

  collectSystemMetrics(): SystemMetrics {
    const memUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();
    
    return {
      memory: {
        heapUsed: memUsage.heapUsed,
        heapTotal: memUsage.heapTotal,
        rss: memUsage.rss,
        external: memUsage.external
      },
      cpu: {
        user: cpuUsage.user,
        system: cpuUsage.system
      },
      uptime: process.uptime(),
      timestamp: Date.now()
    };
  }

  exportMetrics() {
    const counters: { [key: string]: any } = {};
    const gauges: { [key: string]: any } = {};
    const histograms: { [key: string]: any } = {};

    this.counters.forEach((metrics, name) => {
      counters[name] = metrics;
    });

    this.gauges.forEach((metric, name) => {
      gauges[name] = metric;
    });

    this.histograms.forEach((values, name) => {
      histograms[name] = this.getHistogramStats(name);
    });

    return {
      counters,
      gauges,
      histograms,
      system: this.collectSystemMetrics(),
      timestamp: new Date().toISOString()
    };
  }

  exportPrometheusFormat(): string {
    const lines: string[] = [];
    
    // Export counters
    this.counters.forEach((metrics, name) => {
      const prometheusName = name.replace(/\./g, '_');
      lines.push(`# TYPE ${prometheusName} counter`);
      
      metrics.forEach(metric => {
        const labels = this.formatPrometheusLabels(metric.labels);
        lines.push(`${prometheusName}${labels} ${metric.value}`);
      });
    });

    // Export gauges
    this.gauges.forEach((metric, name) => {
      const prometheusName = name.replace(/\./g, '_');
      lines.push(`# TYPE ${prometheusName} gauge`);
      const labels = this.formatPrometheusLabels(metric.labels);
      lines.push(`${prometheusName}${labels} ${metric.value}`);
    });

    // Export histograms
    this.histograms.forEach((values, name) => {
      const prometheusName = name.replace(/\./g, '_');
      const stats = this.getHistogramStats(name);
      if (stats) {
        lines.push(`# TYPE ${prometheusName} histogram`);
        lines.push(`${prometheusName}_count ${stats.count}`);
        lines.push(`${prometheusName}_sum ${stats.sum}`);
      }
    });

    return lines.join('\n');
  }

  calculateRate(name: string, periodSeconds: number): number {
    const count = this.getCounterInWindow(name, periodSeconds);
    return count / periodSeconds;
  }

  reset(): void {
    this.counters.clear();
    this.gauges.clear();
    this.histograms.clear();
    this.histogramLabels.clear();
  }

  resetCounters(): void {
    this.counters.clear();
  }

  shutdown(): void {
    this.intervals.forEach(interval => clearInterval(interval));
    this.intervals = [];
  }

  private startSystemMetricsCollection(): void {
    // Collect system metrics every 30 seconds
    const interval = setInterval(() => {
      const metrics = this.collectSystemMetrics();
      this.setGauge('system.memory.heap.used', metrics.memory.heapUsed);
      this.setGauge('system.memory.heap.total', metrics.memory.heapTotal);
      this.setGauge('system.memory.rss', metrics.memory.rss);
      this.setGauge('system.cpu.user', metrics.cpu.user);
      this.setGauge('system.cpu.system', metrics.cpu.system);
      this.setGauge('system.uptime', metrics.uptime);
    }, 30000);

    this.intervals.push(interval);
  }

  private getPercentile(sorted: number[], percentile: number): number {
    const index = Math.ceil(sorted.length * percentile) - 1;
    return sorted[Math.max(0, Math.min(index, sorted.length - 1))];
  }

  private getMetricKey(name: string, labels: Labels): string {
    const sortedLabels = Object.keys(labels)
      .filter(key => key !== 'timestamp')
      .sort()
      .map(key => `${key}="${labels[key]}"`)
      .join(',');
    
    return sortedLabels ? `${name}{${sortedLabels}}` : name;
  }

  private labelsMatch(labels1: Labels, labels2: Labels): boolean {
    const keys1 = Object.keys(labels1).filter(k => k !== 'timestamp').sort();
    const keys2 = Object.keys(labels2).filter(k => k !== 'timestamp').sort();
    
    if (keys1.length !== keys2.length) {
      return false;
    }
    
    return keys1.every((key, index) => 
      key === keys2[index] && labels1[key] === labels2[key]
    );
  }

  private formatPrometheusLabels(labels: Labels): string {
    const filtered = Object.entries(labels)
      .filter(([key]) => key !== 'timestamp')
      .map(([key, value]) => `${key}="${value}"`)
      .join(',');
    
    return filtered ? `{${filtered}}` : '';
  }
}

// Export singleton instance
export const metricsService = new MetricsService();

// Also export for testing
export default MetricsService;