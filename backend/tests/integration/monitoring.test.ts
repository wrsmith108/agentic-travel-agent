/**
 * Monitoring Endpoints Integration Tests
 */

import request from 'supertest';
import app from '../../src/server';
import { closeDatabase } from '../../src/config/database';
import { priceMonitoringProcessor } from '../../src/services/batch/priceMonitoringProcessor';

describe('Monitoring Endpoints', () => {
  let agent: request.SuperAgentTest;
  let adminAgent: request.SuperAgentTest;
  
  const testUser = {
    email: 'monitoringtest@example.com',
    password: 'MonitoringTest123!',
    firstName: 'Monitoring',
    lastName: 'Tester'
  };

  const adminUser = {
    email: 'admintest@example.com',
    password: 'AdminTest123!',
    firstName: 'Admin',
    lastName: 'Tester'
  };

  beforeAll(async () => {
    // Wait for server to be ready
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Create regular user agent
    agent = request.agent(app);
    await agent.post('/api/v1/auth/register').send(testUser);
    await agent.post('/api/v1/auth/login').send({
      email: testUser.email,
      password: testUser.password
    });

    // Create admin user agent (in real app, would need admin role assignment)
    adminAgent = request.agent(app);
    await adminAgent.post('/api/v1/auth/register').send(adminUser);
    await adminAgent.post('/api/v1/auth/login').send({
      email: adminUser.email,
      password: adminUser.password
    });

    // Stop processor if running from previous tests
    priceMonitoringProcessor.stop();
  });

  afterAll(async () => {
    // Ensure processor is stopped
    priceMonitoringProcessor.stop();
    await closeDatabase();
  });

  describe('Price Processor Endpoints', () => {
    describe('GET /api/v1/monitoring/price-processor/status', () => {
      it('should return processor status for authenticated user', async () => {
        const response = await agent
          .get('/api/v1/monitoring/price-processor/status')
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data).toBeDefined();
        expect(response.body.data.isRunning).toBeDefined();
        expect(response.body.data.cronPattern).toBeDefined();
        expect(response.body.data.lastRun).toBeDefined();
        expect(response.body.data.nextRun).toBeDefined();
        expect(response.body.data.processedCount).toBeDefined();
      });

      it('should require authentication', async () => {
        const newAgent = request.agent(app);
        const response = await newAgent
          .get('/api/v1/monitoring/price-processor/status')
          .expect(401);

        expect(response.body.success).toBe(false);
        expect(response.body.error.code).toBe('UNAUTHORIZED');
      });
    });

    describe('POST /api/v1/monitoring/price-processor/start', () => {
      it('should start processor for admin user', async () => {
        const response = await adminAgent
          .post('/api/v1/monitoring/price-processor/start')
          .send({
            cronPattern: '0 */6 * * *' // Every 6 hours
          })
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.message).toContain('started');
        expect(response.body.data.isRunning).toBe(true);
        expect(response.body.data.cronPattern).toBe('0 */6 * * *');
      });

      it('should use default cron pattern if not provided', async () => {
        // Stop first
        await adminAgent.post('/api/v1/monitoring/price-processor/stop');
        
        const response = await adminAgent
          .post('/api/v1/monitoring/price-processor/start')
          .send({})
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.isRunning).toBe(true);
        expect(response.body.data.cronPattern).toBeDefined();
      });

      it('should require authentication', async () => {
        const newAgent = request.agent(app);
        const response = await newAgent
          .post('/api/v1/monitoring/price-processor/start')
          .send({})
          .expect(401);

        expect(response.body.success).toBe(false);
        expect(response.body.error.code).toBe('UNAUTHORIZED');
      });
    });

    describe('POST /api/v1/monitoring/price-processor/stop', () => {
      it('should stop processor for admin user', async () => {
        // Ensure it's running first
        await adminAgent.post('/api/v1/monitoring/price-processor/start');
        
        const response = await adminAgent
          .post('/api/v1/monitoring/price-processor/stop')
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.message).toContain('stopped');
      });

      it('should require authentication', async () => {
        const newAgent = request.agent(app);
        const response = await newAgent
          .post('/api/v1/monitoring/price-processor/stop')
          .expect(401);

        expect(response.body.success).toBe(false);
        expect(response.body.error.code).toBe('UNAUTHORIZED');
      });
    });

    describe('POST /api/v1/monitoring/price-processor/run-now', () => {
      it('should manually trigger price check for admin user', async () => {
        const response = await adminAgent
          .post('/api/v1/monitoring/price-processor/run-now')
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.message).toContain('completed');
        expect(response.body.data).toBeDefined();
        expect(response.body.data.processed).toBeDefined();
        expect(response.body.data.alerts).toBeDefined();
        expect(response.body.data.errors).toBeDefined();
      });

      it('should require authentication', async () => {
        const newAgent = request.agent(app);
        const response = await newAgent
          .post('/api/v1/monitoring/price-processor/run-now')
          .expect(401);

        expect(response.body.success).toBe(false);
        expect(response.body.error.code).toBe('UNAUTHORIZED');
      });
    });
  });

  describe('Email Service Endpoints', () => {
    describe('GET /api/v1/monitoring/email/stats', () => {
      it('should return email statistics for authenticated user', async () => {
        const response = await agent
          .get('/api/v1/monitoring/email/stats')
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data).toBeDefined();
        expect(response.body.data.sent).toBeDefined();
        expect(response.body.data.failed).toBeDefined();
        expect(response.body.data.queued).toBeDefined();
        expect(response.body.data.lastSentAt).toBeDefined();
      });

      it('should require authentication', async () => {
        const newAgent = request.agent(app);
        const response = await newAgent
          .get('/api/v1/monitoring/email/stats')
          .expect(401);

        expect(response.body.success).toBe(false);
        expect(response.body.error.code).toBe('UNAUTHORIZED');
      });
    });

    describe('POST /api/v1/monitoring/email/process-queue', () => {
      it('should start email queue processing for admin user', async () => {
        const response = await adminAgent
          .post('/api/v1/monitoring/email/process-queue')
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.message).toContain('processing started');
      });

      it('should require authentication', async () => {
        const newAgent = request.agent(app);
        const response = await newAgent
          .post('/api/v1/monitoring/email/process-queue')
          .expect(401);

        expect(response.body.success).toBe(false);
        expect(response.body.error.code).toBe('UNAUTHORIZED');
      });
    });
  });

  describe('System Monitoring Endpoints', () => {
    describe('GET /api/v1/monitoring/metrics', () => {
      it('should return application metrics without authentication', async () => {
        const newAgent = request.agent(app);
        const response = await newAgent
          .get('/api/v1/monitoring/metrics')
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data).toBeDefined();
        expect(response.body.data.counters).toBeDefined();
        expect(response.body.data.gauges).toBeDefined();
        expect(response.body.data.histograms).toBeDefined();
      });

      it('should work with authenticated user', async () => {
        const response = await agent
          .get('/api/v1/monitoring/metrics')
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data).toBeDefined();
      });
    });

    describe('GET /api/v1/monitoring/errors', () => {
      it('should return recent errors for admin user', async () => {
        const response = await adminAgent
          .get('/api/v1/monitoring/errors')
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data).toBeDefined();
        expect(Array.isArray(response.body.data)).toBe(true);
      });

      it('should support limit parameter', async () => {
        const response = await adminAgent
          .get('/api/v1/monitoring/errors')
          .query({ limit: 50 })
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(Array.isArray(response.body.data)).toBe(true);
        expect(response.body.data.length).toBeLessThanOrEqual(50);
      });

      it('should use default limit if not provided', async () => {
        const response = await adminAgent
          .get('/api/v1/monitoring/errors')
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(Array.isArray(response.body.data)).toBe(true);
        expect(response.body.data.length).toBeLessThanOrEqual(100);
      });

      it('should require authentication', async () => {
        const newAgent = request.agent(app);
        const response = await newAgent
          .get('/api/v1/monitoring/errors')
          .expect(401);

        expect(response.body.success).toBe(false);
        expect(response.body.error.code).toBe('UNAUTHORIZED');
      });
    });
  });

  describe('Error Response Formats', () => {
    it('should return consistent error format for service errors', async () => {
      // Mock a service error by attempting to start processor twice
      await adminAgent.post('/api/v1/monitoring/price-processor/start');
      
      const response = await adminAgent
        .post('/api/v1/monitoring/price-processor/start')
        .expect(500);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toHaveProperty('code', 'SERVICE_ERROR');
      expect(response.body.error).toHaveProperty('message');
    });
  });
});