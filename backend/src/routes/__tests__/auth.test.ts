import request from 'supertest';
import app from '../../server';
import { CreateUserProfile } from '@/schemas/user';
import { UserRole } from '@/middleware/auth';
import { authService } from '@/services/auth/authService';

// Mock external dependencies
jest.mock('@sendgrid/mail');
jest.mock('@anthropic-ai/sdk');
jest.mock('amadeus');

// Mock the authService
jest.mock('@/services/auth/authService', () => ({
  authService: {
    registerUser: jest.fn(),
    loginUser: jest.fn(),
    logoutUser: jest.fn(),
    validateSession: jest.fn(),
    validateJWTToken: jest.fn(),
    getUserById: jest.fn(),
    requestPasswordReset: jest.fn(),
    resetPassword: jest.fn(),
  },
}));

describe('Authentication API', () => {
  let testUser: CreateUserProfile;
  let createdUserId: string;

  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();
    
    testUser = {
      firstName: 'John',
      lastName: 'Doe',
      email: 'john.doe@example.com',
      preferences: {
        currency: 'CAD',
        timezone: 'America/Toronto',
        preferredDepartureAirport: 'YYZ',
        communicationFrequency: 'daily',
      },
    };
  });

  describe('POST /api/v1/auth/register', () => {
    it('should register a new user successfully', async () => {
      const registerData = {
        ...testUser,
        password: 'SecurePass123!',
        confirmPassword: 'SecurePass123!',
        acceptTerms: true,
      };

      // Mock successful registration
      const mockResponse = {
        success: true,
        message: 'Registration successful',
        data: {
          user: {
            id: 'test-user-id-123',
            email: testUser.email,
            firstName: testUser.firstName,
            lastName: testUser.lastName,
            role: UserRole.USER,
            emailVerified: true,
            createdAt: new Date().toISOString(),
          },
          sessionId: 'test-session-123',
          accessToken: 'test-access-token',
          expiresAt: new Date(Date.now() + 3600000).toISOString(),
          permissions: ['user:read', 'user:update'],
        },
      };

      (authService.registerUser as jest.Mock).mockResolvedValue(mockResponse);

      const response = await request(app)
        .post('/api/v1/auth/register')
        .send(registerData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.user).toMatchObject({
        firstName: testUser.firstName,
        lastName: testUser.lastName,
        email: testUser.email,
      });
      expect(response.body.data.accessToken).toBeDefined();
      expect(response.body.data.user.id).toBeDefined();
    });

    it('should reject registration with invalid email', async () => {
      const registerData = {
        ...testUser,
        email: 'invalid-email',
        password: 'SecurePass123!',
        confirmPassword: 'SecurePass123!',
        acceptTerms: true,
      };

      const response = await request(app)
        .post('/api/v1/auth/register')
        .send(registerData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should reject registration with weak password', async () => {
      const registerData = {
        ...testUser,
        password: 'weak',
        confirmPassword: 'weak',
        acceptTerms: true,
      };

      const response = await request(app)
        .post('/api/v1/auth/register')
        .send(registerData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should reject registration with mismatched passwords', async () => {
      const registerData = {
        ...testUser,
        password: 'SecurePass123!',
        confirmPassword: 'DifferentPass123!',
        acceptTerms: true,
      };

      const response = await request(app)
        .post('/api/v1/auth/register')
        .send(registerData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should reject registration without accepting terms', async () => {
      const registerData = {
        ...testUser,
        password: 'SecurePass123!',
        confirmPassword: 'SecurePass123!',
        acceptTerms: false,
      };

      const response = await request(app)
        .post('/api/v1/auth/register')
        .send(registerData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should reject duplicate email registration', async () => {
      const registerData = {
        ...testUser,
        password: 'SecurePass123!',
        confirmPassword: 'SecurePass123!',
        acceptTerms: true,
      };

      // First registration should succeed
      await request(app)
        .post('/api/v1/auth/register')
        .send(registerData)
        .expect(201);

      // Second registration with same email should fail
      const response = await request(app)
        .post('/api/v1/auth/register')
        .send(registerData)
        .expect(409);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('EMAIL_ALREADY_EXISTS');
    });
  });

  describe('POST /api/v1/auth/login', () => {
    beforeEach(async () => {
      // Register a user first
      const registerData = {
        ...testUser,
        password: 'SecurePass123!',
        confirmPassword: 'SecurePass123!',
        acceptTerms: true,
      };

      const registerResponse = await request(app)
        .post('/api/v1/auth/register')
        .send(registerData);

      createdUserId = registerResponse.body.data.user.id;
    });

    it('should login successfully with valid credentials', async () => {
      const loginData = {
        email: testUser.email,
        password: 'SecurePass123!',
      };

      const response = await request(app)
        .post('/api/v1/auth/login')
        .send(loginData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.user).toMatchObject({
        firstName: testUser.firstName,
        lastName: testUser.lastName,
        email: testUser.email,
      });
      expect(response.body.data.accessToken).toBeDefined();
      expect(response.body.data.sessionUser).toBeDefined();
    });

    it('should reject login with invalid email', async () => {
      const loginData = {
        email: 'nonexistent@example.com',
        password: 'SecurePass123!',
      };

      const response = await request(app)
        .post('/api/v1/auth/login')
        .send(loginData)
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('INVALID_CREDENTIALS');
    });

    it('should reject login with invalid password', async () => {
      const loginData = {
        email: testUser.email,
        password: 'WrongPassword123!',
      };

      const response = await request(app)
        .post('/api/v1/auth/login')
        .send(loginData)
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('INVALID_CREDENTIALS');
    });

    it('should handle remember me option', async () => {
      const loginData = {
        email: testUser.email,
        password: 'SecurePass123!',
        rememberMe: true,
      };

      const response = await request(app)
        .post('/api/v1/auth/login')
        .send(loginData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.accessToken).toBeDefined();
      // Should include refresh token for remember me
      expect(response.body.data.refreshToken).toBeDefined();
    });

    it('should track device information', async () => {
      const loginData = {
        email: testUser.email,
        password: 'SecurePass123!',
        deviceInfo: {
          userAgent: 'Test Browser 1.0',
          deviceFingerprint: 'test-device-fingerprint',
        },
      };

      const response = await request(app)
        .post('/api/v1/auth/login')
        .send(loginData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.sessionUser.lastActivity).toBeDefined();
    });
  });

  describe('GET /api/v1/auth/me', () => {
    let accessToken: string;

    beforeEach(async () => {
      // Register and login to get access token
      const registerData = {
        ...testUser,
        password: 'SecurePass123!',
        confirmPassword: 'SecurePass123!',
        acceptTerms: true,
      };

      const registerResponse = await request(app)
        .post('/api/v1/auth/register')
        .send(registerData);

      accessToken = registerResponse.body.data.accessToken;
      createdUserId = registerResponse.body.data.user.id;
    });

    it('should return current user with valid token', async () => {
      const response = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.user).toMatchObject({
        firstName: testUser.firstName,
        lastName: testUser.lastName,
        email: testUser.email,
      });
      expect(response.body.data.sessionUser).toBeDefined();
    });

    it('should reject request without token', async () => {
      const response = await request(app)
        .get('/api/v1/auth/me')
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('AUTHENTICATION_REQUIRED');
    });

    it('should reject request with invalid token', async () => {
      const response = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('INVALID_TOKEN');
    });

    it('should accept token from x-access-token header', async () => {
      const response = await request(app)
        .get('/api/v1/auth/me')
        .set('x-access-token', accessToken)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.user.email).toBe(testUser.email);
    });
  });

  describe('POST /api/v1/auth/logout', () => {
    let accessToken: string;

    beforeEach(async () => {
      // Register and login to get access token
      const registerData = {
        ...testUser,
        password: 'SecurePass123!',
        confirmPassword: 'SecurePass123!',
        acceptTerms: true,
      };

      const registerResponse = await request(app)
        .post('/api/v1/auth/register')
        .send(registerData);

      accessToken = registerResponse.body.data.accessToken;
    });

    it('should logout successfully with valid token', async () => {
      const response = await request(app)
        .post('/api/v1/auth/logout')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.message).toBe('Logged out successfully');
    });

    it('should invalidate session after logout', async () => {
      // Logout
      await request(app)
        .post('/api/v1/auth/logout')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      // Try to access protected endpoint
      const response = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('INVALID_TOKEN');
    });

    it('should reject logout without token', async () => {
      const response = await request(app)
        .post('/api/v1/auth/logout')
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('AUTHENTICATION_REQUIRED');
    });
  });

  describe('POST /api/v1/auth/forgot-password', () => {
    beforeEach(async () => {
      // Register a user first
      const registerData = {
        ...testUser,
        password: 'SecurePass123!',
        confirmPassword: 'SecurePass123!',
        acceptTerms: true,
      };

      await request(app)
        .post('/api/v1/auth/register')
        .send(registerData);
    });

    it('should generate password reset token for existing user', async () => {
      const response = await request(app)
        .post('/api/v1/auth/forgot-password')
        .send({ email: testUser.email })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.message).toContain('password reset instructions');
      expect(response.body.data.resetToken).toBeDefined(); // For development
    });

    it('should not reveal if email does not exist', async () => {
      const response = await request(app)
        .post('/api/v1/auth/forgot-password')
        .send({ email: 'nonexistent@example.com' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.message).toContain('password reset instructions');
    });

    it('should validate email format', async () => {
      const response = await request(app)
        .post('/api/v1/auth/forgot-password')
        .send({ email: 'invalid-email' })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('POST /api/v1/auth/reset-password', () => {
    let resetToken: string;

    beforeEach(async () => {
      // Register a user first
      const registerData = {
        ...testUser,
        password: 'SecurePass123!',
        confirmPassword: 'SecurePass123!',
        acceptTerms: true,
      };

      await request(app)
        .post('/api/v1/auth/register')
        .send(registerData);

      // Generate reset token
      const forgotResponse = await request(app)
        .post('/api/v1/auth/forgot-password')
        .send({ email: testUser.email });

      resetToken = forgotResponse.body.data.resetToken;
    });

    it('should reset password with valid token', async () => {
      const resetData = {
        token: resetToken,
        newPassword: 'NewSecurePass123!',
        confirmPassword: 'NewSecurePass123!',
      };

      const response = await request(app)
        .post('/api/v1/auth/reset-password')
        .send(resetData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.user).toBeDefined();
      expect(response.body.data.accessToken).toBeDefined();
    });

    it('should reject invalid reset token', async () => {
      const resetData = {
        token: 'invalid-token',
        newPassword: 'NewSecurePass123!',
        confirmPassword: 'NewSecurePass123!',
      };

      const response = await request(app)
        .post('/api/v1/auth/reset-password')
        .send(resetData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('INVALID_TOKEN');
    });

    it('should reject mismatched passwords', async () => {
      const resetData = {
        token: resetToken,
        newPassword: 'NewSecurePass123!',
        confirmPassword: 'DifferentPass123!',
      };

      const response = await request(app)
        .post('/api/v1/auth/reset-password')
        .send(resetData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should allow login with new password after reset', async () => {
      // Reset password
      const resetData = {
        token: resetToken,
        newPassword: 'NewSecurePass123!',
        confirmPassword: 'NewSecurePass123!',
      };

      await request(app)
        .post('/api/v1/auth/reset-password')
        .send(resetData)
        .expect(200);

      // Login with new password
      const loginResponse = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: testUser.email,
          password: 'NewSecurePass123!',
        })
        .expect(200);

      expect(loginResponse.body.success).toBe(true);
    });
  });

  describe('POST /api/v1/auth/refresh', () => {
    it('should return not implemented error', async () => {
      const response = await request(app)
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: 'some-token' })
        .expect(501);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('NOT_IMPLEMENTED');
    });
  });

  describe('Rate Limiting', () => {
    beforeEach(() => {
      // Clear rate limiting state
      jest.clearAllMocks();
    });

    it('should rate limit registration attempts', async () => {
      const registerData = {
        ...testUser,
        password: 'SecurePass123!',
        confirmPassword: 'SecurePass123!',
        acceptTerms: true,
      };

      // Make multiple registration attempts (rate limit is 3 per hour)
      for (let i = 0; i < 3; i++) {
        await request(app)
          .post('/api/v1/auth/register')
          .send({ ...registerData, email: `test${i}@example.com` })
          .expect(i === 0 ? 201 : 409); // First succeeds, others fail due to duplicate
      }

      // 4th attempt should be rate limited
      const response = await request(app)
        .post('/api/v1/auth/register')
        .send({ ...registerData, email: 'test4@example.com' })
        .expect(429);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('RATE_LIMIT_EXCEEDED');
    });

    it('should rate limit login attempts', async () => {
      // Register a user first
      const registerData = {
        ...testUser,
        password: 'SecurePass123!',
        confirmPassword: 'SecurePass123!',
        acceptTerms: true,
      };

      await request(app)
        .post('/api/v1/auth/register')
        .send(registerData);

      const loginData = {
        email: testUser.email,
        password: 'WrongPassword123!',
      };

      // Make multiple failed login attempts (rate limit is 5 per 15 minutes)
      for (let i = 0; i < 5; i++) {
        await request(app)
          .post('/api/v1/auth/login')
          .send(loginData)
          .expect(401);
      }

      // 6th attempt should be rate limited
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send(loginData)
        .expect(429);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('RATE_LIMIT_EXCEEDED');
    });

    it('should rate limit password reset attempts', async () => {
      const emailData = { email: testUser.email };

      // Make multiple password reset attempts (rate limit is 3 per hour)
      for (let i = 0; i < 3; i++) {
        await request(app)
          .post('/api/v1/auth/forgot-password')
          .send(emailData)
          .expect(200);
      }

      // 4th attempt should be rate limited
      const response = await request(app)
        .post('/api/v1/auth/forgot-password')
        .send(emailData)
        .expect(429);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('RATE_LIMIT_EXCEEDED');
    });
  });

  describe('Error Handling', () => {
    it('should handle malformed JSON', async () => {
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send('invalid json')
        .set('Content-Type', 'application/json')
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should handle missing required fields', async () => {
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({})
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should include request ID in error responses', async () => {
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'invalid', password: 'test' })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.meta?.requestId).toBeDefined();
    });
  });
});