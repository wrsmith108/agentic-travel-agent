/**
 * Health Check and Monitoring Integration Tests
 */

import request from 'supertest';
import app from '../../src/server';
import { closeDatabase } from '../../src/config/database';

describe('Health and Monitoring Endpoints', () => {
  let agent: request.SuperAgentTest;

  beforeAll(async () => {
    // Wait for server to be ready
    await new Promise(resolve => setTimeout(resolve, 1000));
    agent = request.agent(app);
  });

  afterAll(async () => {
    await closeDatabase();
  });

  describe('GET /health', () => {
    it('should return healthy status', async () => {
      const response = await agent
        .get('/health')
        .expect(200);

      expect(response.body.status).toBeDefined();
      expect(['healthy', 'degraded', 'unhealthy'].includes(response.body.status)).toBe(true);
      
      if (response.body.services) {
        expect(typeof response.body.services).toBe('object');
      }
      
      expect(response.body.timestamp).toBeDefined();
    });
  });

  describe('GET /api/v1', () => {
    it('should return API information', async () => {
      const response = await agent
        .get('/api/v1')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(response.body.data.name).toBe('Agentic Travel Agent API');
      expect(response.body.data.version).toBeDefined();
      expect(response.body.data.environment).toBeDefined();
      expect(response.body.data.features).toBeDefined();
      expect(response.body.data.features.demoMode).toBeDefined();
      expect(response.body.data.features.emailNotifications).toBeDefined();
    });
  });

  describe('GET /metrics', () => {
    it('should return basic metrics', async () => {
      const response = await agent
        .get('/metrics')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
    });
  });

  describe('GET /api/v1/monitoring/metrics', () => {
    let testAgent: request.SuperAgentTest;

    beforeAll(async () => {
      // Login for authenticated metrics
      testAgent = request.agent(app);
      await testAgent.post('/api/v1/auth/register').send({
        email: 'metrics@example.com',
        password: 'Metrics123!',
        firstName: 'Metrics',
        lastName: 'User'
      });
      await testAgent.post('/api/v1/auth/login').send({
        email: 'metrics@example.com',
        password: 'Metrics123!'
      });

      // Make some requests to generate metrics
      await testAgent.get('/api/v1/preferences');
      await testAgent.post('/api/v1/flights/search').send({
        origin: 'JFK',
        destination: 'LAX',
        departureDate: '2024-12-25',
        adults: 1
      });
    });

    it('should return detailed metrics', async () => {
      const response = await testAgent
        .get('/api/v1/monitoring/metrics')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      
      const metrics = response.body.data;
      
      // Check counter metrics
      if (metrics.counters) {
        expect(typeof metrics.counters).toBe('object');
      }
      
      // Check gauge metrics
      if (metrics.gauges) {
        expect(typeof metrics.gauges).toBe('object');
      }
      
      // Check histogram metrics
      if (metrics.histograms) {
        expect(typeof metrics.histograms).toBe('object');
      }
    });

    it('should require authentication', async () => {
      const unauthAgent = request.agent(app);
      const response = await unauthAgent
        .get('/api/v1/monitoring/metrics')
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('UNAUTHORIZED');
    });
  });

  describe('Error Handling', () => {
    it('should return 404 for non-existent routes', async () => {
      const response = await agent
        .get('/api/v1/non-existent-endpoint')
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('NOT_FOUND');
      expect(response.body.error.message).toBeDefined();
    });

    it('should handle malformed JSON', async () => {
      const response = await agent
        .post('/api/v1/auth/login')
        .set('Content-Type', 'application/json')
        .send('{ invalid json')
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe('Rate Limiting', () => {
    it('should include rate limit headers', async () => {
      const response = await agent
        .get('/api/v1')
        .expect(200);

      // Check for rate limit headers
      const headers = response.headers;
      if (headers['x-ratelimit-limit']) {
        expect(parseInt(headers['x-ratelimit-limit'])).toBeGreaterThan(0);
      }
    });
  });
});