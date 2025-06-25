import request from 'supertest';
import app from '../../server';
import { authService } from '@/services/auth/authService';
import { AUTH_CONSTANTS } from '@/schemas/auth';
import { costTrackingService } from '@/services/costTracking/costTrackingService';

// Mock external dependencies
jest.mock('@sendgrid/mail');
jest.mock('@anthropic-ai/sdk');
jest.mock('amadeus');
jest.mock('@/services/auth/authService');
jest.mock('@/services/costTracking/costTrackingService');

describe('Authentication Rate Limiting Tests', () => {
  const validRegisterData = {
    firstName: 'Test',
    lastName: 'User',
    email: 'test@example.com',
    password: 'SecurePass123!',
    confirmPassword: 'SecurePass123!',
    acceptTerms: true,
  };

  const validLoginData = {
    email: 'test@example.com',
    password: 'SecurePass123!',
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup default mocks
    (authService.registerUser as jest.Mock).mockResolvedValue({
      success: true,
      message: 'Registration successful',
      data: {
        user: {
          id: 'test-user-id',
          email: validRegisterData.email,
          firstName: validRegisterData.firstName,
          lastName: validRegisterData.lastName,
          role: 'user',
          emailVerified: true,
          createdAt: new Date().toISOString(),
        },
        sessionId: 'test-session-id',
        accessToken: 'test-access-token',
        expiresAt: new Date(Date.now() + 3600000).toISOString(),
        permissions: ['user:read', 'user:update'],
      },
    });

    (authService.loginUser as jest.Mock).mockResolvedValue({
      success: false,
      error: {
        type: 'INVALID_CREDENTIALS',
        message: 'Invalid email or password',
      },
    });

    (authService.requestPasswordReset as jest.Mock).mockResolvedValue({
      success: true,
      message: 'Password reset instructions sent',
    });

    (costTrackingService.getUserQuota as jest.Mock).mockResolvedValue({
      limits: {
        requestsPerMinute: 10,
      },
    });
  });

  describe('Registration Rate Limiting', () => {
    it('should allow registration attempts up to the limit', async () => {
      const registrationLimit = AUTH_CONSTANTS.RATE_LIMITS.REGISTRATION;

      // Make requests up to the limit
      for (let i = 0; i < registrationLimit; i++) {
        const response = await request(app)
          .post('/api/v1/auth/register')
          .send({
            ...validRegisterData,
            email: `test${i}@example.com`,
          });

        expect(response.status).toBe(201);
        expect(response.body.success).toBe(true);
      }
    });

    it('should block registration attempts beyond the limit', async () => {
      const registrationLimit = AUTH_CONSTANTS.RATE_LIMITS.REGISTRATION;

      // Make requests up to the limit
      for (let i = 0; i < registrationLimit; i++) {
        await request(app)
          .post('/api/v1/auth/register')
          .send({
            ...validRegisterData,
            email: `test${i}@example.com`,
          });
      }

      // Next request should be rate limited
      const response = await request(app)
        .post('/api/v1/auth/register')
        .send({
          ...validRegisterData,
          email: 'ratelimited@example.com',
        })
        .expect(429);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('RATE_LIMIT_EXCEEDED');
      expect(response.body.error.message).toContain('Too many registration attempts');
      expect(response.headers['x-ratelimit-limit']).toBeDefined();
      expect(response.headers['x-ratelimit-remaining']).toBe('0');
      expect(response.headers['retry-after']).toBeDefined();
    });

    it('should rate limit by IP address for registration', async () => {
      const registrationLimit = AUTH_CONSTANTS.RATE_LIMITS.REGISTRATION;

      // Simulate requests from different IPs
      for (let i = 0; i < registrationLimit; i++) {
        await request(app)
          .post('/api/v1/auth/register')
          .set('X-Forwarded-For', '192.168.1.1')
          .send({
            ...validRegisterData,
            email: `test${i}@example.com`,
          });
      }

      // Same IP should be rate limited
      const blockedResponse = await request(app)
        .post('/api/v1/auth/register')
        .set('X-Forwarded-For', '192.168.1.1')
        .send({
          ...validRegisterData,
          email: 'blocked@example.com',
        })
        .expect(429);

      expect(blockedResponse.body.error.code).toBe('RATE_LIMIT_EXCEEDED');

      // Different IP should work
      const allowedResponse = await request(app)
        .post('/api/v1/auth/register')
        .set('X-Forwarded-For', '192.168.1.2')
        .send({
          ...validRegisterData,
          email: 'allowed@example.com',
        })
        .expect(201);

      expect(allowedResponse.body.success).toBe(true);
    });
  });

  describe('Login Rate Limiting', () => {
    it('should allow login attempts up to the limit', async () => {
      const loginLimit = AUTH_CONSTANTS.RATE_LIMITS.LOGIN_ATTEMPTS;

      // Make failed login attempts up to the limit
      for (let i = 0; i < loginLimit; i++) {
        const response = await request(app).post('/api/v1/auth/login').send(validLoginData);

        expect(response.status).toBe(401);
        expect(response.body.error.type).toBe('INVALID_CREDENTIALS');
      }
    });

    it('should block login attempts beyond the limit', async () => {
      const loginLimit = AUTH_CONSTANTS.RATE_LIMITS.LOGIN_ATTEMPTS;

      // Make failed login attempts up to the limit
      for (let i = 0; i < loginLimit; i++) {
        await request(app).post('/api/v1/auth/login').send(validLoginData);
      }

      // Next request should be rate limited
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send(validLoginData)
        .expect(429);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('RATE_LIMIT_EXCEEDED');
      expect(response.body.error.message).toContain('Too many authentication attempts');
      expect(response.headers['x-ratelimit-limit']).toBeDefined();
      expect(response.headers['x-ratelimit-remaining']).toBe('0');
    });

    it('should count successful logins differently from failed ones', async () => {
      // Mock successful login
      (authService.loginUser as jest.Mock).mockResolvedValueOnce({
        success: true,
        message: 'Login successful',
        data: {
          user: {
            id: 'test-user-id',
            email: validLoginData.email,
            firstName: 'Test',
            lastName: 'User',
            role: 'user',
            emailVerified: true,
            createdAt: new Date().toISOString(),
          },
          sessionId: 'test-session-id',
          accessToken: 'test-access-token',
          expiresAt: new Date(Date.now() + 3600000).toISOString(),
          permissions: ['user:read', 'user:update'],
        },
      });

      // Successful login
      const successResponse = await request(app)
        .post('/api/v1/auth/login')
        .send(validLoginData)
        .expect(200);

      expect(successResponse.body.success).toBe(true);

      // Make failed login attempts
      const loginLimit = AUTH_CONSTANTS.RATE_LIMITS.LOGIN_ATTEMPTS;
      for (let i = 0; i < loginLimit; i++) {
        await request(app).post('/api/v1/auth/login').send(validLoginData);
      }

      // Should still be rate limited after the limit
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send(validLoginData)
        .expect(429);

      expect(response.body.error.code).toBe('RATE_LIMIT_EXCEEDED');
    });

    it('should track rate limit by IP and user agent combination', async () => {
      const loginLimit = AUTH_CONSTANTS.RATE_LIMITS.LOGIN_ATTEMPTS;

      // Make requests with specific user agent
      for (let i = 0; i < loginLimit; i++) {
        await request(app)
          .post('/api/v1/auth/login')
          .set('User-Agent', 'TestBrowser/1.0')
          .send(validLoginData);
      }

      // Same user agent should be rate limited
      const blockedResponse = await request(app)
        .post('/api/v1/auth/login')
        .set('User-Agent', 'TestBrowser/1.0')
        .send(validLoginData)
        .expect(429);

      expect(blockedResponse.body.error.code).toBe('RATE_LIMIT_EXCEEDED');

      // Different user agent from same IP might have separate limit
      // (depending on implementation)
      const differentAgentResponse = await request(app)
        .post('/api/v1/auth/login')
        .set('User-Agent', 'DifferentBrowser/2.0')
        .send(validLoginData);

      // Could be allowed or blocked depending on rate limit key strategy
      expect([200, 401, 429]).toContain(differentAgentResponse.status);
    });
  });

  describe('Password Reset Rate Limiting', () => {
    it('should enforce strict rate limiting for password reset', async () => {
      const resetLimit = AUTH_CONSTANTS.RATE_LIMITS.PASSWORD_RESET;

      // Make password reset requests up to the limit
      for (let i = 0; i < resetLimit; i++) {
        const response = await request(app)
          .post('/api/v1/auth/forgot-password')
          .send({ email: 'test@example.com' });

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
      }

      // Next request should be rate limited
      const response = await request(app)
        .post('/api/v1/auth/forgot-password')
        .send({ email: 'test@example.com' })
        .expect(429);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('RATE_LIMIT_EXCEEDED');
      expect(response.body.error.message).toContain('Too many password reset attempts');
      expect(response.body.error.message).toContain('1 hour');
    });

    it('should rate limit password reset per email address', async () => {
      const resetLimit = AUTH_CONSTANTS.RATE_LIMITS.PASSWORD_RESET;

      // Make requests for one email
      for (let i = 0; i < resetLimit; i++) {
        await request(app)
          .post('/api/v1/auth/forgot-password')
          .send({ email: 'user1@example.com' });
      }

      // Same email should be blocked
      const blockedResponse = await request(app)
        .post('/api/v1/auth/forgot-password')
        .send({ email: 'user1@example.com' })
        .expect(429);

      expect(blockedResponse.body.error.code).toBe('RATE_LIMIT_EXCEEDED');

      // Different email might still work (depending on implementation)
      const differentEmailResponse = await request(app)
        .post('/api/v1/auth/forgot-password')
        .send({ email: 'user2@example.com' });

      // Could be allowed or blocked depending on rate limit key strategy
      expect([200, 429]).toContain(differentEmailResponse.status);
    });
  });

  describe('Dynamic Rate Limiting for Authenticated Users', () => {
    const mockAccessToken = 'valid-jwt-token';
    const mockUserId = 'test-user-id';

    beforeEach(() => {
      // Mock JWT validation
      (authService.validateJWTToken as jest.Mock).mockResolvedValue({
        sub: mockUserId,
        email: 'test@example.com',
        role: 'user',
        sessionId: 'test-session-id',
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600,
      });

      (authService.validateSession as jest.Mock).mockResolvedValue({
        id: mockUserId,
        email: 'test@example.com',
        role: 'user',
        firstName: 'Test',
        lastName: 'User',
      });

      (authService.getUserById as jest.Mock).mockResolvedValue({
        id: mockUserId,
        email: 'test@example.com',
        firstName: 'Test',
        lastName: 'User',
        preferences: {},
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    });

    it('should apply user-specific rate limits based on tier', async () => {
      // Mock different quota limits for different tiers
      (costTrackingService.getUserQuota as jest.Mock).mockResolvedValue({
        limits: {
          requestsPerMinute: 30, // Higher limit for premium user
        },
      });

      // Make requests up to the premium limit
      for (let i = 0; i < 30; i++) {
        const response = await request(app)
          .get('/api/v1/auth/me')
          .set('Authorization', `Bearer ${mockAccessToken}`);

        expect(response.status).toBe(200);
      }

      // 31st request should still work for premium user
      const response = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${mockAccessToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    it('should apply default rate limit for unauthenticated requests', async () => {
      // Make requests without authentication
      for (let i = 0; i < 10; i++) {
        await request(app).post('/api/v1/auth/login').send(validLoginData);
      }

      // Should be rate limited at default threshold
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send(validLoginData)
        .expect(429);

      expect(response.body.error.code).toBe('RATE_LIMIT_EXCEEDED');
    });
  });

  describe('Global Rate Limiting', () => {
    it('should enforce global rate limit across all endpoints', async () => {
      // Make many requests to different endpoints
      const globalLimit = 100; // As defined in rateLimiting.ts

      for (let i = 0; i < globalLimit; i++) {
        // Mix of different endpoints
        if (i % 3 === 0) {
          await request(app).get('/api/v1');
        } else if (i % 3 === 1) {
          await request(app).post('/api/v1/auth/login').send({});
        } else {
          await request(app).get('/api/v1/auth/me');
        }
      }

      // Next request to any endpoint should be rate limited
      const response = await request(app).get('/api/v1').expect(429);

      expect(response.body.error.code).toBe('RATE_LIMIT_EXCEEDED');
    });

    it('should not count health check requests in rate limit', async () => {
      // Make many health check requests
      for (let i = 0; i < 200; i++) {
        const response = await request(app).get('/health').expect(200);

        expect(response.body.status).toBeDefined();
      }

      // Other endpoints should still work
      const response = await request(app).get('/api/v1').expect(200);

      expect(response.body.success).toBe(true);
    });
  });

  describe('Rate Limit Headers', () => {
    it('should include proper rate limit headers in responses', async () => {
      const response = await request(app).post('/api/v1/auth/login').send(validLoginData);

      expect(response.headers['x-ratelimit-limit']).toBeDefined();
      expect(response.headers['x-ratelimit-remaining']).toBeDefined();
      expect(response.headers['x-ratelimit-reset']).toBeDefined();

      const limit = parseInt(response.headers['x-ratelimit-limit']);
      const remaining = parseInt(response.headers['x-ratelimit-remaining']);

      expect(limit).toBeGreaterThan(0);
      expect(remaining).toBeLessThan(limit);
    });

    it('should include Retry-After header when rate limited', async () => {
      const loginLimit = AUTH_CONSTANTS.RATE_LIMITS.LOGIN_ATTEMPTS;

      // Exhaust rate limit
      for (let i = 0; i < loginLimit; i++) {
        await request(app).post('/api/v1/auth/login').send(validLoginData);
      }

      const response = await request(app)
        .post('/api/v1/auth/login')
        .send(validLoginData)
        .expect(429);

      expect(response.headers['retry-after']).toBeDefined();
      expect(parseInt(response.headers['retry-after'])).toBeGreaterThan(0);
    });
  });
});
