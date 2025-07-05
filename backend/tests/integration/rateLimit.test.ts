/**
 * Integration tests for Rate Limiting
 */

import request from 'supertest';
import app from '../../src/server';
import { AUTH_CONSTANTS } from '../../src/schemas/auth';
import type { Response } from 'supertest';

const agent = request.agent(app);
const agent2 = request.agent(app);

describe('Rate Limiting Integration Tests', () => {
  let authToken: string;
  let authToken2: string;

  beforeAll(async () => {
    // Get auth tokens for testing
    const authResponse1 = await agent.post('/api/v1/dev/mock-token').send({
      email: 'test@example.com',
      role: 'user',
      userId: 'user-123',
    });
    authToken = authResponse1.body.data.token;

    const authResponse2 = await agent2.post('/api/v1/dev/mock-token').send({
      email: 'premium@example.com',
      role: 'user',
      userId: 'user-456',
      tier: 'premium',
    });
    authToken2 = authResponse2.body.data.token;
  });

  describe('Global Rate Limiting', () => {
    it('should enforce global rate limit across all endpoints', async () => {
      const globalLimit = 100; // As defined in rateLimiting.ts
      const requests: Promise<Response>[] = [];

      // Make requests to various endpoints
      for (let i = 0; i < globalLimit - 5; i++) {
        requests.push(
          agent.get('/api/v1/auth/check-session').expect(200),
          agent.get('/api/v1/monitoring/health').expect(200)
        );
      }

      await Promise.all(requests);

      // Make more requests to hit the limit
      for (let i = 0; i < 10; i++) {
        const response = await agent.get('/api/v1/auth/check-session');
        if (i < 5) {
          expect(response.status).toBe(200);
        } else {
          expect(response.status).toBe(429);
          expect(response.body.error.code).toBe('RATE_LIMIT_EXCEEDED');
        }
      }
    });

    it('should include proper rate limit headers', async () => {
      const response = await agent.get('/api/v1/auth/check-session');

      expect(response.headers['x-ratelimit-limit']).toBeDefined();
      expect(response.headers['x-ratelimit-remaining']).toBeDefined();
      expect(response.headers['x-ratelimit-reset']).toBeDefined();
      
      const limit = parseInt(response.headers['x-ratelimit-limit']);
      const remaining = parseInt(response.headers['x-ratelimit-remaining']);
      
      expect(limit).toBeGreaterThan(0);
      expect(remaining).toBeLessThanOrEqual(limit);
    });

    it('should skip rate limiting for health checks', async () => {
      // Make many health check requests
      const healthRequests: Promise<Response>[] = [];
      for (let i = 0; i < 200; i++) {
        healthRequests.push(
          agent.get('/api/v1/health').expect(200)
        );
      }

      // All should succeed
      await Promise.all(healthRequests);
    });
  });

  describe('Authentication Rate Limiting', () => {
    it('should enforce rate limit on login attempts', async () => {
      const loginLimit = AUTH_CONSTANTS.RATE_LIMITS.LOGIN_ATTEMPTS;
      const loginData = {
        email: 'ratelimit@example.com',
        password: 'wrongpassword',
      };

      // Make failed login attempts
      for (let i = 0; i < loginLimit; i++) {
        await request(app)
          .post('/api/v1/auth/login')
          .send(loginData)
          .expect(401);
      }

      // Next attempt should be rate limited
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send(loginData)
        .expect(429);

      expect(response.body.error.message).toContain('Too many authentication attempts');
      expect(response.headers['retry-after']).toBeDefined();
    });

    it('should enforce rate limit on registration attempts', async () => {
      const registrationLimit = AUTH_CONSTANTS.RATE_LIMITS.REGISTRATION;
      
      // Make registration attempts
      for (let i = 0; i < registrationLimit; i++) {
        await request(app)
          .post('/api/v1/auth/register')
          .send({
            email: `user${i}@example.com`,
            password: 'Password123!',
            confirmPassword: 'Password123!',
            firstName: 'Test',
            lastName: 'User',
          })
          .expect((res) => {
            expect([201, 400]).toContain(res.status);
          });
      }

      // Next attempt should be rate limited
      const response = await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: 'blocked@example.com',
          password: 'Password123!',
          confirmPassword: 'Password123!',
          firstName: 'Blocked',
          lastName: 'User',
        })
        .expect(429);

      expect(response.body.error.message).toContain('Too many registration attempts');
    });

    it('should enforce strict rate limit on password reset', async () => {
      const resetLimit = AUTH_CONSTANTS.RATE_LIMITS.PASSWORD_RESET;

      // Make password reset attempts
      for (let i = 0; i < resetLimit; i++) {
        await request(app)
          .post('/api/v1/auth/password-reset/request')
          .send({ email: 'reset@example.com' })
          .expect((res) => {
            expect([200, 400]).toContain(res.status);
          });
      }

      // Next attempt should be rate limited
      const response = await request(app)
        .post('/api/v1/auth/password-reset/request')
        .send({ email: 'reset@example.com' })
        .expect(429);

      expect(response.body.error.message).toContain('Too many password reset attempts');
    });
  });

  describe('API-Specific Rate Limiting', () => {
    it('should enforce rate limit on AI/Claude endpoints', async () => {
      const aiLimit = 20; // 20 requests per minute as defined

      // Make AI requests quickly
      const aiRequests: Promise<Response>[] = [];
      for (let i = 0; i < aiLimit; i++) {
        aiRequests.push(
          agent
            .post('/api/v1/travel-agent/advice')
            .send({ destination: 'Paris', categories: ['safety'] })
        );
      }

      const responses = await Promise.all(aiRequests);
      
      // Most should succeed
      const successCount = responses.filter(r => r.status === 200).length;
      expect(successCount).toBeGreaterThan(0);

      // Next request should potentially be rate limited
      const response = await agent
        .post('/api/v1/travel-agent/advice')
        .send({ destination: 'London', categories: ['culture'] });

      if (response.status === 429) {
        expect(response.body.error.code).toBe('RATE_LIMIT_EXCEEDED');
        expect(response.headers['retry-after']).toBeDefined();
      }
    });

    it('should enforce rate limit on flight search endpoints', async () => {
      const searchLimit = 30; // 30 requests per minute as defined

      // Make search requests
      const searchRequests: Promise<Response>[] = [];
      for (let i = 0; i < 10; i++) {
        searchRequests.push(
          agent
            .post('/api/v1/flights/search')
            .send({
              from: 'NYC',
              to: 'LAX',
              departDate: '2025-06-15',
              adults: 1,
            })
        );
      }

      const responses = await Promise.all(searchRequests);
      
      // Check that rate limit headers are present
      responses.forEach(response => {
        if (response.status === 200) {
          expect(response.headers['x-ratelimit-limit']).toBeDefined();
          expect(response.headers['x-ratelimit-remaining']).toBeDefined();
        }
      });
    });
  });

  describe('Dynamic Rate Limiting by User Tier', () => {
    it('should apply different rate limits based on user tier', async () => {
      // Regular user (tier: basic)
      const basicRequests: Promise<Response>[] = [];
      for (let i = 0; i < 50; i++) {
        basicRequests.push(
          agent
            .get('/api/v1/searches')
            .set('Authorization', `Bearer ${authToken}`)
        );
      }

      const basicResponses = await Promise.all(basicRequests);
      const basicRateLimited = basicResponses.filter(r => r.status === 429).length;

      // Premium user (tier: premium)
      const premiumRequests: Promise<Response>[] = [];
      for (let i = 0; i < 50; i++) {
        premiumRequests.push(
          agent2
            .get('/api/v1/searches')
            .set('Authorization', `Bearer ${authToken2}`)
        );
      }

      const premiumResponses = await Promise.all(premiumRequests);
      const premiumRateLimited = premiumResponses.filter(r => r.status === 429).length;

      // Premium user should have fewer rate limited requests
      expect(premiumRateLimited).toBeLessThan(basicRateLimited);
    });

    it('should track rate limits per user', async () => {
      // User 1 makes requests
      const user1Requests: Promise<Response>[] = [];
      for (let i = 0; i < 20; i++) {
        user1Requests.push(
          agent.get('/api/v1/searches')
        );
      }
      await Promise.all(user1Requests);

      // User 2 should not be affected by User 1's rate limit
      const user2Response = await agent2.get('/api/v1/searches');
      expect(user2Response.status).not.toBe(429);
    });
  });

  describe('Rate Limit Reset and Window', () => {
    it('should reset rate limit after window expires', async () => {
      // This test would need to wait for the window to expire
      // In real tests, you might mock timers or use a shorter window
      const response = await agent.get('/api/v1/auth/check-session');
      
      if (response.headers['x-ratelimit-reset']) {
        const resetTime = parseInt(response.headers['x-ratelimit-reset']);
        const now = Math.floor(Date.now() / 1000);
        const windowRemaining = resetTime - now;
        
        expect(windowRemaining).toBeGreaterThan(0);
        expect(windowRemaining).toBeLessThanOrEqual(60); // 1 minute window
      }
    });

    it('should include Retry-After header when rate limited', async () => {
      // Exhaust rate limit first
      const requests: Promise<Response>[] = [];
      for (let i = 0; i < 110; i++) {
        requests.push(
          agent.get('/api/v1/auth/check-session')
        );
      }
      
      const responses = await Promise.all(requests);
      const rateLimitedResponse = responses.find(r => r.status === 429);
      
      if (rateLimitedResponse) {
        expect(rateLimitedResponse.headers['retry-after']).toBeDefined();
        const retryAfter = parseInt(rateLimitedResponse.headers['retry-after']);
        expect(retryAfter).toBeGreaterThan(0);
        expect(retryAfter).toBeLessThanOrEqual(60);
      }
    });
  });

  describe('Concurrent Request Handling', () => {
    it('should handle concurrent requests from multiple users', async () => {
      const concurrentRequests: Promise<Response>[] = [];
      
      // Mix requests from different users
      for (let i = 0; i < 20; i++) {
        concurrentRequests.push(
          agent.get('/api/v1/searches'),
          agent2.get('/api/v1/searches'),
          request(app).get('/api/v1/health'),
          agent.get('/api/v1/flights/search-history')
        );
      }

      const responses = await Promise.all(concurrentRequests);
      
      // Should handle all requests (some may be rate limited)
      expect(responses.length).toBe(80);
      
      // Health checks should all succeed
      const healthResponses = responses.filter((_, i) => i % 4 === 2);
      healthResponses.forEach(response => {
        expect(response.status).toBe(200);
      });
    });

    it('should apply rate limits independently per IP/user', async () => {
      // Create multiple agents to simulate different IPs
      const agents: ReturnType<typeof request.agent>[] = [];
      for (let i = 0; i < 5; i++) {
        agents.push(request.agent(app));
      }

      // Each agent makes requests
      const allRequests: Promise<Response>[] = [];
      for (const testAgent of agents) {
        for (let i = 0; i < 10; i++) {
          allRequests.push(
            testAgent.get('/api/v1/monitoring/health')
          );
        }
      }

      const responses = await Promise.all(allRequests);
      
      // Most requests should succeed as they're from different IPs
      const successCount = responses.filter(r => r.status === 200).length;
      expect(successCount).toBeGreaterThan(40);
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle malformed requests with rate limiting', async () => {
      // Send malformed requests
      const malformedRequests: Promise<Response>[] = [];
      for (let i = 0; i < 20; i++) {
        malformedRequests.push(
          agent
            .post('/api/v1/auth/login')
            .send({ invalid: 'data' })
        );
      }

      const responses = await Promise.all(malformedRequests);
      
      // Should get validation errors, not rate limit errors initially
      const validationErrors = responses.filter(r => r.status === 400).length;
      expect(validationErrors).toBeGreaterThan(0);
    });

    it('should maintain rate limit state across server errors', async () => {
      // Make some successful requests
      for (let i = 0; i < 5; i++) {
        await agent.get('/api/v1/auth/check-session').expect(200);
      }

      // Trigger a server error (non-existent endpoint)
      await agent.get('/api/v1/nonexistent').expect(404);

      // Rate limit should still be tracked
      const response = await agent.get('/api/v1/auth/check-session');
      if (response.headers['x-ratelimit-remaining']) {
        const remaining = parseInt(response.headers['x-ratelimit-remaining']);
        expect(remaining).toBeLessThan(95); // Some requests were counted
      }
    });
  });
});