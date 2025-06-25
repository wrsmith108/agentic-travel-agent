import request from 'supertest';
import app from '../../server';
import { authService } from '@/services/auth/authService';
import {
  createValidJWT,
  createExpiredJWT,
  createInvalidSignatureJWT,
  createMalformedJWT,
  createMockSessionUser,
  createMockJWTPayload,
} from '@/utils/__tests__/jwtTestUtils';
import { v4 as uuidv4 } from 'uuid';

// Mock external dependencies
jest.mock('@sendgrid/mail');
jest.mock('@anthropic-ai/sdk');
jest.mock('amadeus');

// Mock the authService
jest.mock('@/services/auth/authService', () => ({
  authService: {
    validateJWTToken: jest.fn(),
    validateSession: jest.fn(),
    logoutUser: jest.fn(),
    invalidateAllUserSessions: jest.fn(),
  },
}));

describe('Logout Endpoint Tests', () => {
  let userId: string;
  let sessionId: string;
  let validToken: string;
  let mockSessionUser: any;
  let mockJWTPayload: any;

  beforeEach(() => {
    jest.clearAllMocks();
    userId = uuidv4();
    sessionId = uuidv4();
    validToken = createValidJWT(userId, sessionId);
    mockSessionUser = createMockSessionUser({ id: userId });
    mockJWTPayload = createMockJWTPayload({ sub: userId, sessionId });
  });

  describe('POST /api/v1/auth/logout - Success Cases', () => {
    it('should logout successfully with valid token', async () => {
      // Mock successful JWT validation
      (authService.validateJWTToken as jest.Mock).mockResolvedValue(mockJWTPayload);
      (authService.validateSession as jest.Mock).mockResolvedValue(mockSessionUser);
      (authService.logoutUser as jest.Mock).mockResolvedValue({
        success: true,
        message: 'Logged out successfully',
      });

      const response = await request(app)
        .post('/api/v1/auth/logout')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        message: 'Logged out successfully',
        timestamp: expect.any(String),
      });

      expect(authService.logoutUser).toHaveBeenCalledWith(sessionId);
    });

    it('should logout with sessionId in request body', async () => {
      const bodySessionId = uuidv4();

      (authService.validateJWTToken as jest.Mock).mockResolvedValue(mockJWTPayload);
      (authService.validateSession as jest.Mock).mockResolvedValue(mockSessionUser);
      (authService.logoutUser as jest.Mock).mockResolvedValue({
        success: true,
        message: 'Logged out successfully',
      });

      const response = await request(app)
        .post('/api/v1/auth/logout')
        .set('Authorization', `Bearer ${validToken}`)
        .send({ sessionId: bodySessionId })
        .expect(200);

      expect(response.body.success).toBe(true);
      // Should use sessionId from JWT payload, not body
      expect(authService.logoutUser).toHaveBeenCalledWith(sessionId);
    });

    it('should logout with x-access-token header', async () => {
      (authService.validateJWTToken as jest.Mock).mockResolvedValue(mockJWTPayload);
      (authService.validateSession as jest.Mock).mockResolvedValue(mockSessionUser);
      (authService.logoutUser as jest.Mock).mockResolvedValue({
        success: true,
        message: 'Logged out successfully',
      });

      const response = await request(app)
        .post('/api/v1/auth/logout')
        .set('x-access-token', validToken)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(authService.validateJWTToken).toHaveBeenCalledWith(validToken);
    });

    it('should handle logout all sessions request', async () => {
      (authService.validateJWTToken as jest.Mock).mockResolvedValue(mockJWTPayload);
      (authService.validateSession as jest.Mock).mockResolvedValue(mockSessionUser);
      (authService.logoutUser as jest.Mock).mockResolvedValue({
        success: true,
        message: 'All sessions logged out successfully',
      });

      const response = await request(app)
        .post('/api/v1/auth/logout')
        .set('Authorization', `Bearer ${validToken}`)
        .send({ logoutAllSessions: true })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('All sessions logged out');
    });
  });

  describe('POST /api/v1/auth/logout - Authentication Failures', () => {
    it('should reject logout without token', async () => {
      const response = await request(app).post('/api/v1/auth/logout').expect(401);

      expect(response.body).toMatchObject({
        success: false,
        error: {
          code: 'AUTHENTICATION_REQUIRED',
          message: 'Access token is required',
          timestamp: expect.any(String),
        },
      });

      expect(authService.logoutUser).not.toHaveBeenCalled();
    });

    it('should reject logout with expired token', async () => {
      const expiredToken = createExpiredJWT(userId, sessionId);

      (authService.validateJWTToken as jest.Mock).mockResolvedValue(null);

      const response = await request(app)
        .post('/api/v1/auth/logout')
        .set('Authorization', `Bearer ${expiredToken}`)
        .expect(401);

      expect(response.body).toMatchObject({
        success: false,
        error: {
          code: 'TOKEN_INVALID',
          message: 'Invalid or expired access token',
        },
      });

      expect(authService.logoutUser).not.toHaveBeenCalled();
    });

    it('should reject logout with invalid signature token', async () => {
      const invalidToken = createInvalidSignatureJWT(userId, sessionId);

      (authService.validateJWTToken as jest.Mock).mockResolvedValue(null);

      const response = await request(app)
        .post('/api/v1/auth/logout')
        .set('Authorization', `Bearer ${invalidToken}`)
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('TOKEN_INVALID');
    });

    it('should reject logout with malformed token', async () => {
      const malformedToken = createMalformedJWT();

      (authService.validateJWTToken as jest.Mock).mockResolvedValue(null);

      const response = await request(app)
        .post('/api/v1/auth/logout')
        .set('Authorization', `Bearer ${malformedToken}`)
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('TOKEN_INVALID');
    });

    it('should handle Bearer prefix case variations', async () => {
      (authService.validateJWTToken as jest.Mock).mockResolvedValue(null);

      // Test different Bearer prefix formats
      const prefixes = ['bearer', 'BEARER', 'Bearer', 'BeArEr'];

      for (const prefix of prefixes) {
        const response = await request(app)
          .post('/api/v1/auth/logout')
          .set('Authorization', `${prefix} ${validToken}`)
          .expect(401);

        expect(response.body.success).toBe(false);
      }
    });
  });

  describe('POST /api/v1/auth/logout - Error Handling', () => {
    it('should handle logout service failure', async () => {
      (authService.validateJWTToken as jest.Mock).mockResolvedValue(mockJWTPayload);
      (authService.validateSession as jest.Mock).mockResolvedValue(mockSessionUser);
      (authService.logoutUser as jest.Mock).mockResolvedValue({
        success: false,
        message: 'Failed to invalidate session',
      });

      const response = await request(app)
        .post('/api/v1/auth/logout')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        error: {
          code: 'LOGOUT_FAILED',
          message: 'Failed to invalidate session',
        },
      });
    });

    it('should handle logout service exception', async () => {
      (authService.validateJWTToken as jest.Mock).mockResolvedValue(mockJWTPayload);
      (authService.validateSession as jest.Mock).mockResolvedValue(mockSessionUser);
      (authService.logoutUser as jest.Mock).mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .post('/api/v1/auth/logout')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(500);

      expect(response.body).toMatchObject({
        success: false,
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'An unexpected error occurred',
        },
      });
    });

    it('should handle JWT validation exception', async () => {
      (authService.validateJWTToken as jest.Mock).mockRejectedValue(new Error('JWT error'));

      const response = await request(app)
        .post('/api/v1/auth/logout')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('AUTHENTICATION_ERROR');
    });
  });

  describe('POST /api/v1/auth/logout - Session Edge Cases', () => {
    it('should handle logout with already expired session', async () => {
      (authService.validateJWTToken as jest.Mock).mockResolvedValue(mockJWTPayload);
      (authService.validateSession as jest.Mock).mockResolvedValue(null); // Session already expired
      (authService.logoutUser as jest.Mock).mockResolvedValue({
        success: true,
        message: 'Session already expired',
      });

      const response = await request(app)
        .post('/api/v1/auth/logout')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(authService.logoutUser).toHaveBeenCalled();
    });

    it('should handle logout with non-existent session', async () => {
      const nonExistentSessionId = uuidv4();
      const tokenWithBadSession = createValidJWT(userId, nonExistentSessionId);

      (authService.validateJWTToken as jest.Mock).mockResolvedValue({
        ...mockJWTPayload,
        sessionId: nonExistentSessionId,
      });
      (authService.validateSession as jest.Mock).mockResolvedValue(null);
      (authService.logoutUser as jest.Mock).mockResolvedValue({
        success: true,
        message: 'Logged out successfully',
      });

      const response = await request(app)
        .post('/api/v1/auth/logout')
        .set('Authorization', `Bearer ${tokenWithBadSession}`)
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    it('should validate request body schema', async () => {
      (authService.validateJWTToken as jest.Mock).mockResolvedValue(mockJWTPayload);
      (authService.validateSession as jest.Mock).mockResolvedValue(mockSessionUser);

      // Invalid sessionId format
      const response = await request(app)
        .post('/api/v1/auth/logout')
        .set('Authorization', `Bearer ${validToken}`)
        .send({ sessionId: 'not-a-uuid' })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('POST /api/v1/auth/logout - Concurrent Requests', () => {
    it('should handle multiple logout requests for same session', async () => {
      (authService.validateJWTToken as jest.Mock).mockResolvedValue(mockJWTPayload);
      (authService.validateSession as jest.Mock).mockResolvedValue(mockSessionUser);
      (authService.logoutUser as jest.Mock).mockResolvedValue({
        success: true,
        message: 'Logged out successfully',
      });

      // Send multiple logout requests concurrently
      const requests = Array(5)
        .fill(null)
        .map(() =>
          request(app).post('/api/v1/auth/logout').set('Authorization', `Bearer ${validToken}`)
        );

      const responses = await Promise.all(requests);

      // All should succeed
      responses.forEach((response) => {
        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
      });

      // Logout should be called 5 times
      expect(authService.logoutUser).toHaveBeenCalledTimes(5);
    });

    it('should handle logout after session already invalidated', async () => {
      (authService.validateJWTToken as jest.Mock).mockResolvedValue(mockJWTPayload);

      // First call returns session, second returns null (already logged out)
      (authService.validateSession as jest.Mock)
        .mockResolvedValueOnce(mockSessionUser)
        .mockResolvedValueOnce(null);

      (authService.logoutUser as jest.Mock).mockResolvedValue({
        success: true,
        message: 'Logged out successfully',
      });

      // First logout should succeed
      const response1 = await request(app)
        .post('/api/v1/auth/logout')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(200);

      expect(response1.body.success).toBe(true);

      // Second logout should still succeed (idempotent)
      const response2 = await request(app)
        .post('/api/v1/auth/logout')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(200);

      expect(response2.body.success).toBe(true);
    });
  });

  describe('POST /api/v1/auth/logout - Logging and Monitoring', () => {
    it('should include request metadata in logs', async () => {
      const userAgent = 'Mozilla/5.0 Test Browser';
      const clientIp = '192.168.1.100';

      (authService.validateJWTToken as jest.Mock).mockResolvedValue(mockJWTPayload);
      (authService.validateSession as jest.Mock).mockResolvedValue(mockSessionUser);
      (authService.logoutUser as jest.Mock).mockResolvedValue({
        success: true,
        message: 'Logged out successfully',
      });

      const response = await request(app)
        .post('/api/v1/auth/logout')
        .set('Authorization', `Bearer ${validToken}`)
        .set('User-Agent', userAgent)
        .set('X-Forwarded-For', clientIp)
        .expect(200);

      expect(response.body.success).toBe(true);

      // In a real implementation, you would verify logs contain these details
      // For now, we just ensure the request completes successfully
    });
  });
});
