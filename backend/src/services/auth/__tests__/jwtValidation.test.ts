import { authService } from '@/services/auth/authService';
import {
  createValidJWT,
  createExpiredJWT,
  createInvalidSignatureJWT,
  createMalformedJWT,
  createWrongSecretJWT,
  createInvalidIssuerJWT,
  createInvalidAudienceJWT,
  createMissingClaimsJWT,
  createCustomExpiryJWT,
  JWT_TEST_SECRET,
  createMockSessionUser,
  createMockJWTPayload,
} from '@/utils/__tests__/jwtTestUtils';
import { v4 as uuidv4 } from 'uuid';

// Mock environment variables
jest.mock('@/config/env', () => ({
  env: {
    JWT_SECRET: 'test-jwt-secret-for-testing-only',
    JWT_REFRESH_SECRET: 'test-jwt-refresh-secret-for-testing-only',
    NODE_ENV: 'test',
  },
}));

describe('JWT Validation Tests', () => {
  let userId: string;
  let sessionId: string;
  let mockSessionUser: any;

  beforeEach(() => {
    jest.clearAllMocks();
    userId = uuidv4();
    sessionId = uuidv4();
    mockSessionUser = createMockSessionUser({ id: userId });
  });

  describe('Valid JWT Token Tests', () => {
    it('should validate a valid JWT token with active session', async () => {
      const validToken = createValidJWT(userId, sessionId);

      // Mock session validation to return user
      jest.spyOn(authService, 'validateSession').mockResolvedValue(mockSessionUser);

      const result = await authService.validateJWTToken(validToken);

      expect(result).toBeTruthy();
      expect(result?.sub).toBe(userId);
      expect(result?.sessionId).toBe(sessionId);
      expect(result?.email).toBe('test@example.com');
      expect(authService.validateSession).toHaveBeenCalledWith(sessionId);
    });

    it('should reject valid JWT with invalid session', async () => {
      const validToken = createValidJWT(userId, sessionId);

      // Mock session validation to return null (invalid session)
      jest.spyOn(authService, 'validateSession').mockResolvedValue(null);

      const result = await authService.validateJWTToken(validToken);

      expect(result).toBeNull();
      expect(authService.validateSession).toHaveBeenCalledWith(sessionId);
    });

    it('should validate JWT with custom claims', async () => {
      const customClaims = { role: 'admin' as any, email: 'admin@example.com' };
      const validToken = createValidJWT(userId, sessionId, '1h', customClaims);

      jest.spyOn(authService, 'validateSession').mockResolvedValue(mockSessionUser);

      const result = await authService.validateJWTToken(validToken);

      expect(result).toBeTruthy();
      expect(result?.role).toBe('admin');
      expect(result?.email).toBe('admin@example.com');
    });
  });

  describe('Expired JWT Token Tests', () => {
    it('should reject expired JWT token (1 hour ago)', async () => {
      const expiredToken = createExpiredJWT(userId, sessionId, 3600);

      const result = await authService.validateJWTToken(expiredToken);

      expect(result).toBeNull();
      expect(authService.validateSession).not.toHaveBeenCalled();
    });

    it('should reject expired JWT token (1 day ago)', async () => {
      const expiredToken = createExpiredJWT(userId, sessionId, 86400);

      const result = await authService.validateJWTToken(expiredToken);

      expect(result).toBeNull();
    });

    it('should reject JWT expiring in 1 second', async () => {
      // Create token expiring in 1 second
      const expiresAt = new Date(Date.now() + 1000);
      const almostExpiredToken = createCustomExpiryJWT(expiresAt, userId, sessionId);

      jest.spyOn(authService, 'validateSession').mockResolvedValue(mockSessionUser);

      // Should be valid now
      const result1 = await authService.validateJWTToken(almostExpiredToken);
      expect(result1).toBeTruthy();

      // Wait 2 seconds and check again
      await new Promise((resolve) => setTimeout(resolve, 2000));
      const result2 = await authService.validateJWTToken(almostExpiredToken);
      expect(result2).toBeNull();
    });
  });

  describe('Invalid Signature Tests', () => {
    it('should reject JWT with invalid signature', async () => {
      const invalidSigToken = createInvalidSignatureJWT(userId, sessionId);

      const result = await authService.validateJWTToken(invalidSigToken);

      expect(result).toBeNull();
      expect(authService.validateSession).not.toHaveBeenCalled();
    });

    it('should reject JWT signed with wrong secret', async () => {
      const wrongSecretToken = createWrongSecretJWT(userId, sessionId);

      const result = await authService.validateJWTToken(wrongSecretToken);

      expect(result).toBeNull();
      expect(authService.validateSession).not.toHaveBeenCalled();
    });
  });

  describe('Malformed JWT Tests', () => {
    it('should reject completely invalid JWT format', async () => {
      const malformedToken = createMalformedJWT('invalid-format');

      const result = await authService.validateJWTToken(malformedToken);

      expect(result).toBeNull();
    });

    it('should reject JWT missing header', async () => {
      const malformedToken = createMalformedJWT('missing-header');

      const result = await authService.validateJWTToken(malformedToken);

      expect(result).toBeNull();
    });

    it('should reject JWT missing payload', async () => {
      const malformedToken = createMalformedJWT('missing-payload');

      const result = await authService.validateJWTToken(malformedToken);

      expect(result).toBeNull();
    });

    it('should reject JWT missing signature', async () => {
      const malformedToken = createMalformedJWT('missing-signature');

      const result = await authService.validateJWTToken(malformedToken);

      expect(result).toBeNull();
    });

    it('should reject empty string as JWT', async () => {
      const result = await authService.validateJWTToken('');

      expect(result).toBeNull();
    });

    it('should reject null/undefined as JWT', async () => {
      const result1 = await authService.validateJWTToken(null as any);
      const result2 = await authService.validateJWTToken(undefined as any);

      expect(result1).toBeNull();
      expect(result2).toBeNull();
    });
  });

  describe('JWT Claim Validation Tests', () => {
    it('should validate JWT with correct issuer and audience', async () => {
      const validToken = createValidJWT(userId, sessionId);
      jest.spyOn(authService, 'validateSession').mockResolvedValue(mockSessionUser);

      const result = await authService.validateJWTToken(validToken);

      expect(result).toBeTruthy();
      expect(result?.iss).toBe('agentic-travel-agent');
      expect(result?.aud).toBe('agentic-travel-agent-users');
    });

    it('should handle JWT with invalid issuer', async () => {
      const invalidIssuerToken = createInvalidIssuerJWT(userId, sessionId);
      jest.spyOn(authService, 'validateSession').mockResolvedValue(mockSessionUser);

      // Note: Current implementation doesn't validate issuer/audience
      // This test documents current behavior
      const result = await authService.validateJWTToken(invalidIssuerToken);

      expect(result).toBeTruthy();
      expect(result?.iss).toBe('invalid-issuer');
    });

    it('should handle JWT with invalid audience', async () => {
      const invalidAudienceToken = createInvalidAudienceJWT(userId, sessionId);
      jest.spyOn(authService, 'validateSession').mockResolvedValue(mockSessionUser);

      const result = await authService.validateJWTToken(invalidAudienceToken);

      expect(result).toBeTruthy();
      expect(result?.aud).toBe('invalid-audience');
    });

    it('should handle JWT missing sub claim', async () => {
      const missingSubToken = createMissingClaimsJWT(['sub']);
      jest.spyOn(authService, 'validateSession').mockResolvedValue(mockSessionUser);

      const result = await authService.validateJWTToken(missingSubToken);

      expect(result).toBeTruthy();
      expect(result?.sub).toBeUndefined();
    });

    it('should handle JWT missing sessionId claim', async () => {
      const missingSessionToken = createMissingClaimsJWT(['sessionId']);

      // Should fail because validateSession needs sessionId
      const result = await authService.validateJWTToken(missingSessionToken);

      expect(result).toBeNull();
    });

    it('should handle JWT missing multiple claims', async () => {
      const missingClaimsToken = createMissingClaimsJWT(['email', 'role']);
      jest.spyOn(authService, 'validateSession').mockResolvedValue(mockSessionUser);

      const result = await authService.validateJWTToken(missingClaimsToken);

      expect(result).toBeTruthy();
      expect(result?.email).toBeUndefined();
      expect(result?.role).toBeUndefined();
    });
  });

  describe('JWT Edge Cases', () => {
    it('should handle very long JWT tokens', async () => {
      // Create JWT with large payload
      const largePayload = {
        data: 'x'.repeat(10000),
      };
      const largeToken = createValidJWT(userId, sessionId, '1h', largePayload as any);
      jest.spyOn(authService, 'validateSession').mockResolvedValue(mockSessionUser);

      const result = await authService.validateJWTToken(largeToken);

      expect(result).toBeTruthy();
      expect((result as any)?.data).toBe(largePayload.data);
    });

    it('should handle JWT with special characters in claims', async () => {
      const specialChars = {
        email: 'test+special@example.com',
        role: 'user/admin' as any,
      };
      const specialToken = createValidJWT(userId, sessionId, '1h', specialChars);
      jest.spyOn(authService, 'validateSession').mockResolvedValue(mockSessionUser);

      const result = await authService.validateJWTToken(specialToken);

      expect(result).toBeTruthy();
      expect(result?.email).toBe(specialChars.email);
    });

    it('should handle JWT with numeric strings as claims', async () => {
      const numericClaims = {
        sub: '12345',
        sessionId: '67890',
      };
      const numericToken = createValidJWT(numericClaims.sub, numericClaims.sessionId);
      jest.spyOn(authService, 'validateSession').mockResolvedValue(mockSessionUser);

      const result = await authService.validateJWTToken(numericToken);

      expect(result).toBeTruthy();
      expect(result?.sub).toBe('12345');
      expect(result?.sessionId).toBe('67890');
    });

    it('should handle concurrent JWT validation requests', async () => {
      const tokens = Array(10)
        .fill(null)
        .map(() => createValidJWT(uuidv4(), uuidv4()));

      jest.spyOn(authService, 'validateSession').mockResolvedValue(mockSessionUser);

      const results = await Promise.all(tokens.map((token) => authService.validateJWTToken(token)));

      expect(results.every((r) => r !== null)).toBe(true);
      expect(authService.validateSession).toHaveBeenCalledTimes(10);
    });
  });

  describe('Session Integration Tests', () => {
    it('should validate JWT and check session status', async () => {
      const validToken = createValidJWT(userId, sessionId);

      // Mock full session validation flow
      const mockSession = {
        ...mockSessionUser,
        lastAccessedAt: new Date().toISOString(),
      };
      jest.spyOn(authService, 'validateSession').mockResolvedValue(mockSession);

      const result = await authService.validateJWTToken(validToken);

      expect(result).toBeTruthy();
      expect(authService.validateSession).toHaveBeenCalledWith(sessionId);
    });

    it('should reject JWT when session is inactive', async () => {
      const validToken = createValidJWT(userId, sessionId);

      // Mock inactive session
      jest.spyOn(authService, 'validateSession').mockImplementation(async (sid) => {
        // Simulate checking session active status
        return null; // Session inactive
      });

      const result = await authService.validateJWTToken(validToken);

      expect(result).toBeNull();
    });

    it('should handle session lookup errors gracefully', async () => {
      const validToken = createValidJWT(userId, sessionId);

      // Mock session lookup error
      jest
        .spyOn(authService, 'validateSession')
        .mockRejectedValue(new Error('Database connection error'));

      const result = await authService.validateJWTToken(validToken);

      expect(result).toBeNull();
    });
  });

  describe('Performance Tests', () => {
    it('should validate JWT tokens efficiently', async () => {
      const validToken = createValidJWT(userId, sessionId);
      jest.spyOn(authService, 'validateSession').mockResolvedValue(mockSessionUser);

      const startTime = Date.now();

      // Validate same token multiple times
      for (let i = 0; i < 100; i++) {
        await authService.validateJWTToken(validToken);
      }

      const endTime = Date.now();
      const avgTime = (endTime - startTime) / 100;

      // Average validation should be fast (less than 10ms)
      expect(avgTime).toBeLessThan(10);
    });
  });
});
