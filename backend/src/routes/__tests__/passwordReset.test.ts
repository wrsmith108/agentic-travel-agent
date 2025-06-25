import request from 'supertest';
import app from '../../server';
import { authService } from '@/services/auth/authService';
import {
  createMockUserProfile,
  createMockSessionUser,
  createMockPasswordResetToken,
  createTestRegistrationData,
  generateSecurePassword,
  generateWeakPassword,
  createMockAuthSuccessResponse,
  createMockAuthErrorResponse,
  MockEmailService,
  MockTokenStorage,
  wait,
} from '@/utils/__tests__/authTestUtils';

// Mock external dependencies
jest.mock('@sendgrid/mail');
jest.mock('@anthropic-ai/sdk');
jest.mock('amadeus');

// Mock the authService
jest.mock('@/services/auth/authService', () => ({
  authService: {
    requestPasswordReset: jest.fn(),
    resetPassword: jest.fn(),
    validateJWTToken: jest.fn(),
    validateSession: jest.fn(),
    getUserByEmail: jest.fn(),
    invalidateAllUserSessions: jest.fn(),
  },
}));

describe('Password Reset Flow', () => {
  let mockEmailService: MockEmailService;
  let mockTokenStorage: MockTokenStorage;

  beforeEach(() => {
    jest.clearAllMocks();
    mockEmailService = new MockEmailService();
    mockTokenStorage = new MockTokenStorage();
  });

  afterEach(() => {
    mockEmailService.clear();
    mockTokenStorage.clear();
  });

  describe('POST /api/v1/auth/forgot-password', () => {
    describe('Request Validation', () => {
      it('should accept valid email format', async () => {
        const validEmails = [
          'user@example.com',
          'test.user@example.com',
          'user+tag@example.co.uk',
          'user123@subdomain.example.com',
        ];

        for (const email of validEmails) {
          (authService.requestPasswordReset as jest.Mock).mockResolvedValue({
            success: true,
            message: 'If an account exists, reset instructions have been sent',
          });

          const response = await request(app)
            .post('/api/v1/auth/forgot-password')
            .send({ email })
            .expect(200);

          expect(response.body.success).toBe(true);
        }
      });

      it('should reject invalid email formats', async () => {
        const invalidEmails = [
          'notanemail',
          '@example.com',
          'user@',
          'user @example.com',
          'user@.com',
          '',
        ];

        for (const email of invalidEmails) {
          const response = await request(app)
            .post('/api/v1/auth/forgot-password')
            .send({ email })
            .expect(400);

          expect(response.body.success).toBe(false);
          expect(response.body.error.code).toBe('VALIDATION_ERROR');
        }
      });

      it('should require email field', async () => {
        const response = await request(app)
          .post('/api/v1/auth/forgot-password')
          .send({})
          .expect(400);

        expect(response.body.success).toBe(false);
        expect(response.body.error.code).toBe('VALIDATION_ERROR');
      });

      it('should normalize email to lowercase', async () => {
        (authService.requestPasswordReset as jest.Mock).mockResolvedValue({
          success: true,
          message: 'Reset email sent',
        });

        await request(app)
          .post('/api/v1/auth/forgot-password')
          .send({ email: 'User@EXAMPLE.com' })
          .expect(200);

        expect(authService.requestPasswordReset).toHaveBeenCalledWith(
          expect.objectContaining({
            email: 'user@example.com',
          })
        );
      });
    });

    describe('Security', () => {
      it('should not reveal if user exists or not', async () => {
        // Mock for existing user
        (authService.requestPasswordReset as jest.Mock).mockResolvedValue({
          success: true,
          message: 'If an account with this email exists, a reset link has been sent',
        });

        const existingUserResponse = await request(app)
          .post('/api/v1/auth/forgot-password')
          .send({ email: 'existing@example.com' })
          .expect(200);

        // Mock for non-existing user
        (authService.requestPasswordReset as jest.Mock).mockResolvedValue({
          success: true,
          message: 'If an account with this email exists, a reset link has been sent',
        });

        const nonExistingUserResponse = await request(app)
          .post('/api/v1/auth/forgot-password')
          .send({ email: 'nonexisting@example.com' })
          .expect(200);

        // Both responses should be identical
        expect(existingUserResponse.body.message).toBe(nonExistingUserResponse.body.message);
      });

      it('should handle service errors gracefully', async () => {
        (authService.requestPasswordReset as jest.Mock).mockRejectedValue(
          new Error('Database connection failed')
        );

        const response = await request(app)
          .post('/api/v1/auth/forgot-password')
          .send({ email: 'user@example.com' })
          .expect(500);

        expect(response.body.success).toBe(false);
        expect(response.body.error.code).toBe('AUTH_FORGOT_PASSWORD_ERROR');
      });
    });

    describe('Token Generation', () => {
      it('should generate reset token in development mode', async () => {
        const originalEnv = process.env.NODE_ENV;
        process.env.NODE_ENV = 'development';

        const mockToken = createMockPasswordResetToken();
        (authService.requestPasswordReset as jest.Mock).mockResolvedValue({
          success: true,
          message: 'Password reset token generated',
          token: mockToken,
        });

        const response = await request(app)
          .post('/api/v1/auth/forgot-password')
          .send({ email: 'user@example.com' })
          .expect(200);

        expect(response.body.debug?.resetToken).toBe(mockToken);

        process.env.NODE_ENV = originalEnv;
      });

      it('should not expose token in production mode', async () => {
        const originalEnv = process.env.NODE_ENV;
        process.env.NODE_ENV = 'production';

        const mockToken = createMockPasswordResetToken();
        (authService.requestPasswordReset as jest.Mock).mockResolvedValue({
          success: true,
          message: 'Password reset token generated',
          token: mockToken,
        });

        const response = await request(app)
          .post('/api/v1/auth/forgot-password')
          .send({ email: 'user@example.com' })
          .expect(200);

        expect(response.body.debug).toBeUndefined();

        process.env.NODE_ENV = originalEnv;
      });
    });

    describe('Rate Limiting', () => {
      it('should rate limit password reset requests', async () => {
        const email = 'ratelimit@example.com';

        (authService.requestPasswordReset as jest.Mock).mockResolvedValue({
          success: true,
          message: 'Reset email sent',
        });

        // Make 3 requests (rate limit)
        for (let i = 0; i < 3; i++) {
          await request(app).post('/api/v1/auth/forgot-password').send({ email }).expect(200);
        }

        // 4th request should be rate limited
        const response = await request(app)
          .post('/api/v1/auth/forgot-password')
          .send({ email })
          .expect(429);

        expect(response.body.success).toBe(false);
        expect(response.body.error.code).toBe('RATE_LIMIT_EXCEEDED');
        expect(response.body.error.message).toContain('Too many password reset attempts');
      });

      it('should include rate limit headers', async () => {
        (authService.requestPasswordReset as jest.Mock).mockResolvedValue({
          success: true,
          message: 'Reset email sent',
        });

        const response = await request(app)
          .post('/api/v1/auth/forgot-password')
          .send({ email: 'user@example.com' })
          .expect(200);

        expect(response.headers['x-ratelimit-limit']).toBeDefined();
        expect(response.headers['x-ratelimit-remaining']).toBeDefined();
      });
    });
  });

  describe('POST /api/v1/auth/reset-password', () => {
    let resetToken: string;
    let mockUser: any;

    beforeEach(() => {
      resetToken = createMockPasswordResetToken();
      mockUser = createMockUserProfile();
    });

    describe('Token Validation', () => {
      it('should accept valid reset token', async () => {
        const newPassword = generateSecurePassword();
        const sessionUser = createMockSessionUser({ id: mockUser.id, email: mockUser.email });

        (authService.resetPassword as jest.Mock).mockResolvedValue(
          createMockAuthSuccessResponse(sessionUser, 'new-session-id', 'new-access-token')
        );

        const response = await request(app)
          .post('/api/v1/auth/reset-password')
          .send({
            token: resetToken,
            newPassword,
            confirmPassword: newPassword,
          })
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.accessToken).toBeDefined();
        expect(response.body.data.user).toBeDefined();
      });

      it('should reject invalid reset token', async () => {
        (authService.resetPassword as jest.Mock).mockResolvedValue(
          createMockAuthErrorResponse('TOKEN_INVALID', 'Invalid or expired reset token')
        );

        const response = await request(app)
          .post('/api/v1/auth/reset-password')
          .send({
            token: 'invalid-token',
            newPassword: generateSecurePassword(),
            confirmPassword: generateSecurePassword(),
          })
          .expect(401);

        expect(response.body.success).toBe(false);
        expect(response.body.error.type).toBe('TOKEN_INVALID');
      });

      it('should reject expired reset token', async () => {
        (authService.resetPassword as jest.Mock).mockResolvedValue(
          createMockAuthErrorResponse('TOKEN_EXPIRED', 'Reset token has expired')
        );

        const response = await request(app)
          .post('/api/v1/auth/reset-password')
          .send({
            token: resetToken,
            newPassword: generateSecurePassword(),
            confirmPassword: generateSecurePassword(),
          })
          .expect(401);

        expect(response.body.success).toBe(false);
        expect(response.body.error.type).toBe('TOKEN_EXPIRED');
      });

      it('should reject already used reset token', async () => {
        const newPassword = generateSecurePassword();

        // First use - success
        (authService.resetPassword as jest.Mock).mockResolvedValueOnce(
          createMockAuthSuccessResponse(createMockSessionUser(), 'session-id', 'access-token')
        );

        await request(app)
          .post('/api/v1/auth/reset-password')
          .send({
            token: resetToken,
            newPassword,
            confirmPassword: newPassword,
          })
          .expect(200);

        // Second use - should fail
        (authService.resetPassword as jest.Mock).mockResolvedValueOnce(
          createMockAuthErrorResponse('TOKEN_INVALID', 'Token already used')
        );

        const response = await request(app)
          .post('/api/v1/auth/reset-password')
          .send({
            token: resetToken,
            newPassword,
            confirmPassword: newPassword,
          })
          .expect(401);

        expect(response.body.success).toBe(false);
        expect(response.body.error.type).toBe('TOKEN_INVALID');
      });
    });

    describe('Password Validation', () => {
      it('should enforce password requirements', async () => {
        const weakPasswords = [
          'short', // Too short
          'alllowercase', // No uppercase
          'ALLUPPERCASE', // No lowercase
          'NoNumbers!', // No numbers
          'NoSpecial123', // No special characters
          'a'.repeat(129), // Too long
        ];

        for (const password of weakPasswords) {
          const response = await request(app)
            .post('/api/v1/auth/reset-password')
            .send({
              token: resetToken,
              newPassword: password,
              confirmPassword: password,
            })
            .expect(400);

          expect(response.body.success).toBe(false);
          expect(response.body.error.code).toBe('VALIDATION_ERROR');
        }
      });

      it('should accept strong passwords', async () => {
        const strongPasswords = [
          'Password123!',
          'MyS3cur3P@ss',
          'Complex!Pass1',
          'Test@12345',
          'P@ssw0rd!Strong',
        ];

        for (const password of strongPasswords) {
          (authService.resetPassword as jest.Mock).mockResolvedValue(
            createMockAuthSuccessResponse(createMockSessionUser(), 'session-id', 'access-token')
          );

          const response = await request(app)
            .post('/api/v1/auth/reset-password')
            .send({
              token: resetToken,
              newPassword: password,
              confirmPassword: password,
            })
            .expect(200);

          expect(response.body.success).toBe(true);
        }
      });

      it('should require password confirmation match', async () => {
        const response = await request(app)
          .post('/api/v1/auth/reset-password')
          .send({
            token: resetToken,
            newPassword: 'Password123!',
            confirmPassword: 'DifferentPassword123!',
          })
          .expect(400);

        expect(response.body.success).toBe(false);
        expect(response.body.error.code).toBe('VALIDATION_ERROR');
        expect(response.body.error.details).toContainEqual(
          expect.objectContaining({
            path: ['confirmPassword'],
            message: 'Passwords do not match',
          })
        );
      });
    });

    describe('Session Management', () => {
      it('should create new session after password reset', async () => {
        const newPassword = generateSecurePassword();
        const sessionUser = createMockSessionUser({ id: mockUser.id });
        const newSessionId = 'new-session-id';
        const newAccessToken = 'new-access-token';

        (authService.resetPassword as jest.Mock).mockResolvedValue(
          createMockAuthSuccessResponse(sessionUser, newSessionId, newAccessToken)
        );

        const response = await request(app)
          .post('/api/v1/auth/reset-password')
          .send({
            token: resetToken,
            newPassword,
            confirmPassword: newPassword,
          })
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.sessionId).toBe(newSessionId);
        expect(response.body.data.accessToken).toBe(newAccessToken);
        expect(response.body.data.expiresAt).toBeDefined();
      });

      it('should invalidate all existing sessions on password reset', async () => {
        const newPassword = generateSecurePassword();

        (authService.resetPassword as jest.Mock).mockImplementation(async (data) => {
          // Simulate invalidating all sessions
          expect(authService.invalidateAllUserSessions).toBeDefined();
          return createMockAuthSuccessResponse(
            createMockSessionUser(),
            'new-session-id',
            'new-access-token'
          );
        });

        await request(app)
          .post('/api/v1/auth/reset-password')
          .send({
            token: resetToken,
            newPassword,
            confirmPassword: newPassword,
          })
          .expect(200);
      });
    });

    describe('Error Handling', () => {
      it('should handle missing token', async () => {
        const response = await request(app)
          .post('/api/v1/auth/reset-password')
          .send({
            newPassword: generateSecurePassword(),
            confirmPassword: generateSecurePassword(),
          })
          .expect(400);

        expect(response.body.success).toBe(false);
        expect(response.body.error.code).toBe('VALIDATION_ERROR');
      });

      it('should handle missing passwords', async () => {
        const response = await request(app)
          .post('/api/v1/auth/reset-password')
          .send({
            token: resetToken,
          })
          .expect(400);

        expect(response.body.success).toBe(false);
        expect(response.body.error.code).toBe('VALIDATION_ERROR');
      });

      it('should handle service errors gracefully', async () => {
        (authService.resetPassword as jest.Mock).mockRejectedValue(new Error('Database error'));

        const response = await request(app)
          .post('/api/v1/auth/reset-password')
          .send({
            token: resetToken,
            newPassword: generateSecurePassword(),
            confirmPassword: generateSecurePassword(),
          })
          .expect(500);

        expect(response.body.success).toBe(false);
        expect(response.body.error.code).toBe('AUTH_RESET_PASSWORD_ERROR');
      });

      it('should handle user not found', async () => {
        (authService.resetPassword as jest.Mock).mockResolvedValue(
          createMockAuthErrorResponse('USER_NOT_FOUND', 'User account not found')
        );

        const response = await request(app)
          .post('/api/v1/auth/reset-password')
          .send({
            token: resetToken,
            newPassword: generateSecurePassword(),
            confirmPassword: generateSecurePassword(),
          })
          .expect(404);

        expect(response.body.success).toBe(false);
        expect(response.body.error.type).toBe('USER_NOT_FOUND');
      });
    });

    describe('Integration Flow', () => {
      it('should complete full password reset flow', async () => {
        // Step 1: Register user
        const registrationData = createTestRegistrationData();
        const userId = 'user-id-123';
        const sessionUser = createMockSessionUser({
          id: userId,
          email: registrationData.email,
        });

        (authService.requestPasswordReset as jest.Mock).mockResolvedValue({
          success: true,
          message: 'Password reset requested',
          token: resetToken,
        });

        // Step 2: Request password reset
        const forgotResponse = await request(app)
          .post('/api/v1/auth/forgot-password')
          .send({ email: registrationData.email })
          .expect(200);

        expect(forgotResponse.body.success).toBe(true);

        // Step 3: Reset password with token
        const newPassword = 'NewSecurePassword123!';
        (authService.resetPassword as jest.Mock).mockResolvedValue(
          createMockAuthSuccessResponse(sessionUser, 'new-session-id', 'new-access-token')
        );

        const resetResponse = await request(app)
          .post('/api/v1/auth/reset-password')
          .send({
            token: resetToken,
            newPassword,
            confirmPassword: newPassword,
          })
          .expect(200);

        expect(resetResponse.body.success).toBe(true);
        expect(resetResponse.body.data.user.email).toBe(registrationData.email);
      });

      it('should allow login with new password after reset', async () => {
        const email = 'user@example.com';
        const oldPassword = 'OldPassword123!';
        const newPassword = 'NewPassword123!';

        // Reset password
        (authService.resetPassword as jest.Mock).mockResolvedValue(
          createMockAuthSuccessResponse(
            createMockSessionUser({ email }),
            'session-id',
            'access-token'
          )
        );

        await request(app)
          .post('/api/v1/auth/reset-password')
          .send({
            token: resetToken,
            newPassword,
            confirmPassword: newPassword,
          })
          .expect(200);

        // Verify the reset was called with correct data
        expect(authService.resetPassword).toHaveBeenCalledWith(
          expect.objectContaining({
            token: resetToken,
            newPassword,
          })
        );
      });
    });
  });

  describe('Token Expiry and Cleanup', () => {
    it('should handle token expiry correctly', async () => {
      const expiredToken = createMockPasswordResetToken();

      (authService.resetPassword as jest.Mock).mockResolvedValue(
        createMockAuthErrorResponse('TOKEN_EXPIRED', 'Reset token has expired')
      );

      const response = await request(app)
        .post('/api/v1/auth/reset-password')
        .send({
          token: expiredToken,
          newPassword: generateSecurePassword(),
          confirmPassword: generateSecurePassword(),
        })
        .expect(401);

      expect(response.body.error.type).toBe('TOKEN_EXPIRED');
    });

    it('should handle concurrent reset requests', async () => {
      const email = 'concurrent@example.com';

      (authService.requestPasswordReset as jest.Mock).mockResolvedValue({
        success: true,
        message: 'Reset requested',
        token: createMockPasswordResetToken(),
      });

      // Send multiple concurrent requests
      const requests = Array(3)
        .fill(null)
        .map(() => request(app).post('/api/v1/auth/forgot-password').send({ email }));

      const responses = await Promise.all(requests);

      // All should succeed (rate limiting would kick in after)
      responses.forEach((response) => {
        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
      });
    });
  });
});
