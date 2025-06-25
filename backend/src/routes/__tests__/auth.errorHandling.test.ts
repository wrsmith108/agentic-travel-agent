import request from 'supertest';
import app from '../../server';
import { authService } from '@/services/auth/authService';
import { AppError } from '@/middleware/errorHandler';
import { databaseManager } from '@/services/storage/userDataManager';

// Mock external dependencies
jest.mock('@sendgrid/mail');
jest.mock('@anthropic-ai/sdk');
jest.mock('amadeus');
jest.mock('@/services/auth/authService');
jest.mock('@/services/storage/userDataManager');

describe('Authentication Error Handling Tests', () => {
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
  });

  describe('Database Error Handling', () => {
    it('should handle database connection errors during registration', async () => {
      // Mock database connection error
      (authService.registerUser as jest.Mock).mockRejectedValue(
        new Error('ECONNREFUSED: Database connection failed')
      );

      const response = await request(app)
        .post('/api/v1/auth/register')
        .send(validRegisterData)
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('AUTH_REGISTER_ERROR');
      expect(response.body.error.message).toContain('Registration failed due to server error');
      expect(response.body.meta?.requestId).toBeDefined();
      expect(response.body.meta?.timestamp).toBeDefined();
    });

    it('should handle database timeout errors during login', async () => {
      // Mock database timeout
      (authService.loginUser as jest.Mock).mockRejectedValue(
        new Error('Query timeout: Connection timed out after 30000ms')
      );

      const response = await request(app)
        .post('/api/v1/auth/login')
        .send(validLoginData)
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('AUTH_LOGIN_ERROR');
      expect(response.body.error.message).toContain('Login failed due to server error');
    });

    it('should handle database constraint violations', async () => {
      // Mock unique constraint violation
      (authService.registerUser as jest.Mock).mockResolvedValue({
        success: false,
        error: {
          type: 'USER_ALREADY_EXISTS',
          message: 'User with this email already exists',
        },
      });

      const response = await request(app)
        .post('/api/v1/auth/register')
        .send(validRegisterData)
        .expect(409);

      expect(response.body.success).toBe(false);
      expect(response.body.error.type).toBe('USER_ALREADY_EXISTS');
      expect(response.body.error.message).toContain('User with this email already exists');
    });

    it('should handle transaction rollback errors', async () => {
      // Mock transaction rollback error
      (authService.registerUser as jest.Mock).mockRejectedValue(
        new Error('Transaction rolled back due to integrity constraint violation')
      );

      const response = await request(app)
        .post('/api/v1/auth/register')
        .send(validRegisterData)
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('AUTH_REGISTER_ERROR');
    });
  });

  describe('Network Error Handling', () => {
    it('should handle external service timeouts', async () => {
      // Mock external service timeout (e.g., email service)
      (authService.registerUser as jest.Mock).mockRejectedValue(
        new Error('ETIMEDOUT: Email service connection timeout')
      );

      const response = await request(app)
        .post('/api/v1/auth/register')
        .send(validRegisterData)
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('AUTH_REGISTER_ERROR');
    });

    it('should handle DNS resolution errors', async () => {
      // Mock DNS resolution error
      (authService.requestPasswordReset as jest.Mock).mockRejectedValue(
        new Error('ENOTFOUND: getaddrinfo ENOTFOUND smtp.sendgrid.net')
      );

      const response = await request(app)
        .post('/api/v1/auth/forgot-password')
        .send({ email: 'test@example.com' })
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('AUTH_FORGOT_PASSWORD_ERROR');
    });

    it('should handle network unreachable errors', async () => {
      // Mock network unreachable error
      (authService.loginUser as jest.Mock).mockRejectedValue(
        new Error('ENETUNREACH: Network is unreachable')
      );

      const response = await request(app)
        .post('/api/v1/auth/login')
        .send(validLoginData)
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('AUTH_LOGIN_ERROR');
    });
  });

  describe('Validation Error Handling', () => {
    it('should provide detailed validation errors for missing fields', async () => {
      const response = await request(app)
        .post('/api/v1/auth/register')
        .send({
          // Missing all required fields
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      expect(response.body.error.details).toBeDefined();
      expect(Array.isArray(response.body.error.details)).toBe(true);
      expect(response.body.error.details.length).toBeGreaterThan(0);
    });

    it('should validate email format with specific error message', async () => {
      const response = await request(app)
        .post('/api/v1/auth/register')
        .send({
          ...validRegisterData,
          email: 'not-an-email',
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      expect(response.body.error.details).toBeDefined();

      const emailError = response.body.error.details.find((err: any) => err.path.includes('email'));
      expect(emailError).toBeDefined();
      expect(emailError.message).toContain('Invalid email');
    });

    it('should validate password strength requirements', async () => {
      const response = await request(app)
        .post('/api/v1/auth/register')
        .send({
          ...validRegisterData,
          password: 'weak',
          confirmPassword: 'weak',
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');

      const passwordError = response.body.error.details.find((err: any) =>
        err.path.includes('password')
      );
      expect(passwordError).toBeDefined();
      expect(passwordError.message).toContain('8 characters');
    });

    it('should handle multiple validation errors at once', async () => {
      const response = await request(app)
        .post('/api/v1/auth/register')
        .send({
          firstName: '', // Too short
          lastName: 'A', // Too short
          email: 'invalid', // Invalid format
          password: '123', // Too weak
          confirmPassword: '456', // Doesn't match
          acceptTerms: false, // Must be true
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      expect(response.body.error.details.length).toBeGreaterThanOrEqual(5);
    });

    it('should sanitize error messages to prevent information leakage', async () => {
      // Mock internal error with sensitive information
      (authService.loginUser as jest.Mock).mockRejectedValue(
        new Error('Database query failed: SELECT * FROM users WHERE password_hash=$1')
      );

      const response = await request(app)
        .post('/api/v1/auth/login')
        .send(validLoginData)
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error.message).not.toContain('SELECT');
      expect(response.body.error.message).not.toContain('password_hash');
      expect(response.body.error.message).toBe('Login failed due to server error');
    });
  });

  describe('JWT Token Error Handling', () => {
    it('should handle malformed JWT tokens', async () => {
      const response = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', 'Bearer malformed.jwt.token')
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('TOKEN_INVALID');
      expect(response.body.error.message).toContain('Invalid or expired access token');
    });

    it('should handle expired JWT tokens', async () => {
      // Mock expired token validation
      (authService.validateJWTToken as jest.Mock).mockResolvedValue(null);

      const response = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', 'Bearer expired.jwt.token')
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('TOKEN_INVALID');
    });

    it('should handle invalid JWT signatures', async () => {
      // Mock invalid signature
      (authService.validateJWTToken as jest.Mock).mockRejectedValue(
        new Error('JsonWebTokenError: invalid signature')
      );

      const response = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', 'Bearer tampered.jwt.token')
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('AUTHENTICATION_ERROR');
    });

    it('should handle missing authorization header gracefully', async () => {
      const response = await request(app).get('/api/v1/auth/me').expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('AUTHENTICATION_REQUIRED');
      expect(response.body.error.message).toBe('Access token is required');
    });
  });

  describe('Session Error Handling', () => {
    it('should handle expired sessions', async () => {
      // Mock valid JWT but expired session
      (authService.validateJWTToken as jest.Mock).mockResolvedValue({
        sub: 'user-id',
        email: 'test@example.com',
        role: 'user',
        sessionId: 'expired-session-id',
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600,
      });

      (authService.validateSession as jest.Mock).mockResolvedValue(null);

      const response = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', 'Bearer valid.jwt.token')
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('SESSION_EXPIRED');
      expect(response.body.error.message).toContain('Session has expired');
    });

    it('should handle session not found errors', async () => {
      // Mock valid JWT but session not in database
      (authService.validateJWTToken as jest.Mock).mockResolvedValue({
        sub: 'user-id',
        email: 'test@example.com',
        role: 'user',
        sessionId: 'non-existent-session',
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600,
      });

      (authService.validateSession as jest.Mock).mockResolvedValue(null);
      (authService.getUserById as jest.Mock).mockResolvedValue(null);

      const response = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', 'Bearer valid.jwt.token')
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('SESSION_EXPIRED');
    });
  });

  describe('Concurrent Request Error Handling', () => {
    it('should handle race conditions in registration', async () => {
      // First request succeeds
      (authService.registerUser as jest.Mock).mockResolvedValueOnce({
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

      // Subsequent requests fail due to duplicate
      (authService.registerUser as jest.Mock).mockResolvedValue({
        success: false,
        error: {
          type: 'USER_ALREADY_EXISTS',
          message: 'User with this email already exists',
        },
      });

      // Simulate concurrent requests
      const promises = Array(5)
        .fill(null)
        .map(() => request(app).post('/api/v1/auth/register').send(validRegisterData));

      const responses = await Promise.all(promises);

      // Count successes and failures
      const successes = responses.filter((r) => r.status === 201);
      const conflicts = responses.filter((r) => r.status === 409);

      expect(successes.length).toBe(1);
      expect(conflicts.length).toBe(4);

      conflicts.forEach((response) => {
        expect(response.body.error.type).toBe('USER_ALREADY_EXISTS');
      });
    });
  });

  describe('Input Sanitization Error Handling', () => {
    it('should handle and sanitize malicious input', async () => {
      const maliciousData = {
        ...validRegisterData,
        firstName: '<script>alert("XSS")</script>',
        lastName: '{{constructor.constructor("alert(1)")()}}',
        email: 'test@example.com"; DROP TABLE users; --',
      };

      const response = await request(app)
        .post('/api/v1/auth/register')
        .send(maliciousData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should handle oversized payloads', async () => {
      const oversizedData = {
        ...validRegisterData,
        firstName: 'A'.repeat(10000), // Very long string
      };

      const response = await request(app)
        .post('/api/v1/auth/register')
        .send(oversizedData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should handle invalid JSON payloads', async () => {
      const response = await request(app)
        .post('/api/v1/auth/register')
        .set('Content-Type', 'application/json')
        .send('{"invalid": json"}')
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('BAD_REQUEST');
      expect(response.body.error.message).toContain('Invalid JSON');
    });
  });

  describe('Error Response Consistency', () => {
    it('should always include request ID in error responses', async () => {
      const testCases = [
        {
          endpoint: '/api/v1/auth/register',
          method: 'post',
          data: {},
          expectedStatus: 400,
        },
        {
          endpoint: '/api/v1/auth/login',
          method: 'post',
          data: { email: 'invalid' },
          expectedStatus: 400,
        },
        {
          endpoint: '/api/v1/auth/me',
          method: 'get',
          data: null,
          expectedStatus: 401,
        },
      ];

      for (const testCase of testCases) {
        const req = request(app)[testCase.method](testCase.endpoint);

        if (testCase.data) {
          req.send(testCase.data);
        }

        const response = await req.expect(testCase.expectedStatus);

        expect(response.body.success).toBe(false);
        expect(response.body.meta?.requestId).toBeDefined();
        expect(response.body.meta?.timestamp).toBeDefined();
      }
    });

    it('should maintain consistent error structure', async () => {
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'test@example.com' }) // Missing password
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toHaveProperty('code');
      expect(response.body.error).toHaveProperty('message');
      expect(response.body).toHaveProperty('meta');
      expect(response.body.meta).toHaveProperty('timestamp');
      expect(response.body.meta).toHaveProperty('requestId');
    });
  });

  describe('Graceful Degradation', () => {
    it('should continue working when email service is down', async () => {
      // Mock successful registration but email service failure
      (authService.registerUser as jest.Mock).mockResolvedValue({
        success: true,
        message: 'Registration successful (email notification may be delayed)',
        data: {
          user: {
            id: 'test-user-id',
            email: validRegisterData.email,
            firstName: validRegisterData.firstName,
            lastName: validRegisterData.lastName,
            role: 'user',
            emailVerified: false, // Not verified due to email failure
            createdAt: new Date().toISOString(),
          },
          sessionId: 'test-session-id',
          accessToken: 'test-access-token',
          expiresAt: new Date(Date.now() + 3600000).toISOString(),
          permissions: ['user:read', 'user:update'],
        },
      });

      const response = await request(app)
        .post('/api/v1/auth/register')
        .send(validRegisterData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('email notification may be delayed');
      expect(response.body.data.user.emailVerified).toBe(false);
    });
  });
});
