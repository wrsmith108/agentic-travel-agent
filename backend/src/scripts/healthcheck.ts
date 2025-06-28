#!/usr/bin/env node

/**
 * Health check script for Docker containers and deployment monitoring
 * Tests critical application components and dependencies
 */

import http from 'http';
import { createTimestamp } from '@/services/auth/functional/types';
import { performance } from 'perf_hooks';

interface HealthCheckResult {
  status: 'healthy' | 'unhealthy' | 'degraded';
  timestamp: string;
  uptime: number;
  checks: {
    http: boolean;
    database: boolean;
    redis: boolean;
    memory: boolean;
    disk: boolean;
  };
  metrics: {
    responseTime: number;
    memoryUsage: number;
    cpuUsage: number;
  };
  version: string;
}

class HealthChecker {
  private timeout: number = 5000; // 5 seconds
  private port: number = parseInt(process.env.PORT || '3001');
  private host: string = process.env.HOST || 'localhost';

  async performHealthCheck(): Promise<HealthCheckResult> {
    const startTime = performance.now();
    
    const checks = {
      http: await this.checkHTTP(),
      database: await this.checkDatabase(),
      redis: await this.checkRedis(),
      memory: this.checkMemory(),
      disk: await this.checkDisk()
    };

    const responseTime = performance.now() - startTime;
    
    // Determine overall health status
    const failedChecks = Object.values(checks).filter(check => !check).length;
    let status: 'healthy' | 'unhealthy' | 'degraded';
    
    if (failedChecks === 0) {
      status = 'healthy';
    } else if (failedChecks <= 2) {
      status = 'degraded';
    } else {
      status = 'unhealthy';
    }

    return {
      status,
      timestamp: createTimestamp(),
      uptime: process.uptime(),
      checks,
      metrics: {
        responseTime,
        memoryUsage: this.getMemoryUsage(),
        cpuUsage: this.getCPUUsage()
      },
      version: process.env.npm_package_version || '1.0.0'
    };
  }

  private async checkHTTP(): Promise<boolean> {
    return new Promise((resolve) => {
      const req = http.request({
        hostname: this.host,
        port: this.port,
        path: '/health',
        method: 'GET',
        timeout: this.timeout
      }, (res) => {
        resolve(res.statusCode === 200);
      });

      req.on('error', () => resolve(false));
      req.on('timeout', () => {
        req.destroy();
        resolve(false);
      });

      req.end();
    });
  }

  private async checkDatabase(): Promise<boolean> {
    try {
      // In a real implementation, you would check your database connection
      // For this MVP, we'll assume the file-based storage is working if the app is running
      const fs = await import('fs/promises');
      await fs.access('./data', fs.constants.F_OK);
      return true;
    } catch {
      return false;
    }
  }

  private async checkRedis(): Promise<boolean> {
    try {
      // Check if Redis is configured and accessible
      if (!process.env.REDIS_URL) {
        return true; // Redis is optional in our setup
      }

      // In a real implementation, you would ping Redis
      // For now, we'll assume it's working if the URL is configured
      return true;
    } catch {
      return false;
    }
  }

  private checkMemory(): boolean {
    const memUsage = process.memoryUsage();
    const heapUsedPercent = (memUsage.heapUsed / memUsage.heapTotal) * 100;
    
    // Consider memory unhealthy if over 90% usage
    return heapUsedPercent < 90;
  }

  private async checkDisk(): Promise<boolean> {
    try {
      const fs = await import('fs/promises');
      
      // Check if we can write to the logs directory
      const testFile = './logs/healthcheck.tmp';
      await fs.writeFile(testFile, 'healthcheck');
      await fs.unlink(testFile);
      
      return true;
    } catch {
      return false;
    }
  }

  private getMemoryUsage(): number {
    const memUsage = process.memoryUsage();
    return Math.round((memUsage.heapUsed / 1024 / 1024) * 100) / 100; // MB
  }

  private getCPUUsage(): number {
    const cpuUsage = process.cpuUsage();
    const totalUsage = cpuUsage.user + cpuUsage.system;
    return Math.round((totalUsage / 1000000) * 100) / 100; // Convert to seconds
  }
}

// Main execution
async function main() {
  const checker = new HealthChecker();
  
  try {
    const result = await checker.performHealthCheck();
    
    // Output result for Docker healthcheck
    console.log(JSON.stringify(result, null, 2));
    
    // Exit with appropriate code
    process.exit(result.status === 'unhealthy' ? 1 : 0);
  } catch (error) {
    console.error('Health check failed:', error);
    process.exit(1);
  }
}

// Run if this file is executed directly
if (require.main === module) {
  main();
}

export { HealthChecker };