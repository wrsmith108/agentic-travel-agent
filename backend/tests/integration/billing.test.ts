/**
 * Billing Integration Tests
 */

import request from 'supertest';
import app from '../../src/server';
import { closeDatabase } from '../../src/config/database';

describe('Billing Endpoints', () => {
  let agent: request.SuperAgentTest;
  const testUser = {
    email: 'billingtest@example.com',
    password: 'BillingTest123!',
    firstName: 'Billing',
    lastName: 'Tester'
  };

  beforeAll(async () => {
    // Wait for server to be ready
    await new Promise(resolve => setTimeout(resolve, 1000));
    agent = request.agent(app);

    // Register and login test user
    await agent.post('/api/v1/auth/register').send(testUser);
    await agent.post('/api/v1/auth/login').send({
      email: testUser.email,  
      password: testUser.password
    });
  });

  afterAll(async () => {
    await closeDatabase();
  });

  describe('GET /api/v1/billing/plans', () => {
    it('should return available subscription plans', async () => {
      const response = await agent
        .get('/api/v1/billing/plans')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.plans).toBeDefined();
      expect(Array.isArray(response.body.data.plans)).toBe(true);
      expect(response.body.data.plans.length).toBe(4);

      // Verify plan structure
      const freePlan = response.body.data.plans.find((p: any) => p.id === 'free');
      expect(freePlan).toBeDefined();
      expect(freePlan.name).toBe('Free');
      expect(freePlan.price).toBe(0);
      expect(freePlan.limits).toBeDefined();
      expect(freePlan.features).toBeDefined();
      expect(Array.isArray(freePlan.features)).toBe(true);
    });

    it('should include correct plan details', async () => {
      const response = await agent
        .get('/api/v1/billing/plans')
        .expect(200);

      const plans = response.body.data.plans;
      const planIds = ['free', 'basic', 'premium', 'enterprise'];
      
      planIds.forEach(id => {
        const plan = plans.find((p: any) => p.id === id);
        expect(plan).toBeDefined();
        expect(plan.limits.dailyTokens).toBeDefined();
        expect(plan.limits.monthlyTokens).toBeDefined();
        expect(plan.limits.requestsPerMinute).toBeDefined();
      });

      // Enterprise should have null price for custom pricing
      const enterprisePlan = plans.find((p: any) => p.id === 'enterprise');
      expect(enterprisePlan.price).toBeNull();
    });
  });

  describe('GET /api/v1/billing/usage', () => {
    it('should return user cost and usage summary', async () => {
      const response = await agent
        .get('/api/v1/billing/usage')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(response.body.data.totalCost).toBeDefined();
      expect(response.body.data.totalTokens).toBeDefined();
      expect(response.body.data.breakdown).toBeDefined();
    });

    it('should filter by date range when provided', async () => {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 7);
      const endDate = new Date();

      const response = await agent
        .get('/api/v1/billing/usage')
        .query({
          startDate: startDate.toISOString().split('T')[0],
          endDate: endDate.toISOString().split('T')[0]
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.dateRange).toBeDefined();
      expect(response.body.data.dateRange.start).toBeDefined();
      expect(response.body.data.dateRange.end).toBeDefined();
    });

    it('should fail when not authenticated', async () => {
      const newAgent = request.agent(app);
      
      const response = await newAgent
        .get('/api/v1/billing/usage')
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('UNAUTHORIZED');
    });

    it('should validate date format', async () => {
      const response = await agent
        .get('/api/v1/billing/usage')
        .query({
          startDate: 'invalid-date'
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('POST /api/v1/billing/upgrade', () => {
    it('should return not implemented for payment processing', async () => {
      const response = await agent
        .post('/api/v1/billing/upgrade')
        .send({
          planId: 'basic'
        })
        .expect(501);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('NOT_IMPLEMENTED');
      expect(response.body.error.message).toContain('not yet implemented');
    });

    it('should validate plan ID', async () => {
      const response = await agent
        .post('/api/v1/billing/upgrade')
        .send({
          planId: 'invalid-plan'
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should require authentication', async () => {
      const newAgent = request.agent(app);
      
      const response = await newAgent
        .post('/api/v1/billing/upgrade')
        .send({
          planId: 'basic'
        })
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('UNAUTHORIZED');
    });
  });

  describe('Error Response Formats', () => {
    it('should return consistent error format for validation errors', async () => {
      const response = await agent
        .get('/api/v1/billing/usage')
        .query({
          startDate: '2024-13-45' // Invalid date
        })
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toHaveProperty('code');
      expect(response.body.error).toHaveProperty('message');
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should return consistent error format for auth errors', async () => {
      const newAgent = request.agent(app);
      const response = await newAgent
        .get('/api/v1/billing/usage')
        .expect(401);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toHaveProperty('code', 'UNAUTHORIZED');
      expect(response.body.error).toHaveProperty('message');
    });
  });
});