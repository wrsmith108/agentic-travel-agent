import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import type { RedisClientType } from 'redis';
import { JWTTokenService } from '../jwtTokenService';
import type { Result } from '../types';
import jwt from 'jsonwebtoken';

// Mock Redis client
const mockRedisClient = {
  connect: jest.fn(),
  disconnect: jest.fn(),
  set: jest.fn(),
  get: jest.fn(),
  del: jest.fn(),
  expire: jest.fn(),
  setEx: jest.fn(),
  exists: jest.fn(),
} as unknown as RedisClientType;

describe('JWTTokenService', () => {
  let service: JWTTokenService;
  const testSecret = 'test-secret-key-that-is-at-least-32-characters-long';
  const testRefreshSecret = 'test-refresh-secret-key-that-is-at-least-32-characters-long';
  
  beforeEach(() => {
    jest.clearAllMocks();
    service = new JWTTokenService({
      secret: testSecret,
      refreshSecret: testRefreshSecret,
      redisClient: mockRedisClient,
      issuer: 'test-issuer',
      audience: 'test-audience',
      accessTokenExpiry: '15m',
      refreshTokenExpiry: '7d',
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('sign', () => {
    it('should successfully sign a JWT token with valid payload', async () => {
      const payload = {
        userId: 'user123',
        email: 'test@example.com',
        role: 'user' as const,
      };

      const result = await service.sign(payload);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.accessToken).toBeDefined();
        expect(typeof result.value.accessToken).toBe('string');
        expect(result.value.accessToken.split('.')).toHaveLength(3); // JWT format
        
        // Verify the token can be decoded
        const decoded = jwt.decode(result.value.accessToken) as any;
        expect(decoded.userId).toBe(payload.userId);
        expect(decoded.email).toBe(payload.email);
        expect(decoded.role).toBe(payload.role);
        expect(decoded.iss).toBe('test-issuer');
        expect(decoded.aud).toBe('test-audience');
        expect(decoded.iat).toBeDefined();
        expect(decoded.exp).toBeDefined();
        expect(decoded.jti).toBeDefined(); // JWT ID for blacklisting
      }
    });

    it('should generate both access and refresh tokens', async () => {
      const payload = {
        userId: 'user123',
        email: 'test@example.com',
        role: 'user' as const,
      };

      const result = await service.sign(payload);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.accessToken).toBeDefined();
        expect(result.value.refreshToken).toBeDefined();
        expect(result.value.accessToken).not.toBe(result.value.refreshToken);
      }
    });

    it('should include metadata in the result', async () => {
      const payload = {
        userId: 'user123',
        email: 'test@example.com',
        role: 'user' as const,
      };

      const result = await service.sign(payload);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.expiresIn).toBe('15m');
        expect(result.value.tokenType).toBe('Bearer');
        expect(result.value.issuedAt).toBeInstanceOf(Date);
        expect(result.value.expiresAt).toBeInstanceOf(Date);
        expect(result.value.expiresAt.getTime()).toBeGreaterThan(result.value.issuedAt.getTime());
      }
    });

    it('should handle empty payload gracefully', async () => {
      const result = await service.sign({} as any);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.type).toBe('VALIDATION_ERROR');
        expect(result.error.message).toContain('Invalid payload');
      }
    });

    it('should handle missing required fields', async () => {
      const payload = {
        userId: 'user123',
        // missing email and role
      } as any;

      const result = await service.sign(payload);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.type).toBe('VALIDATION_ERROR');
        expect(result.error.message).toContain('required');
      }
    });

    it('should handle invalid role values', async () => {
      const payload = {
        userId: 'user123',
        email: 'test@example.com',
        role: 'invalid-role' as any,
      };

      const result = await service.sign(payload);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.type).toBe('VALIDATION_ERROR');
        expect(result.error.message).toContain('Invalid role');
      }
    });
  });

  describe('verify', () => {
    it('should successfully verify a valid token', async () => {
      // First sign a token
      const payload = {
        userId: 'user123',
        email: 'test@example.com',
        role: 'user' as const,
      };
      const signResult = await service.sign(payload);
      expect(signResult.ok).toBe(true);
      
      if (signResult.ok) {
        // Mock Redis exists to return false (not blacklisted)
        (mockRedisClient.exists as jest.Mock).mockResolvedValue(0);

        // Then verify it
        const verifyResult = await service.verify(signResult.value.accessToken);
        
        expect(verifyResult.ok).toBe(true);
        if (verifyResult.ok) {
          expect(verifyResult.value.userId).toBe(payload.userId);
          expect(verifyResult.value.email).toBe(payload.email);
          expect(verifyResult.value.role).toBe(payload.role);
          expect(verifyResult.value.iss).toBe('test-issuer');
          expect(verifyResult.value.aud).toBe('test-audience');
        }
      }
    });

    it('should reject blacklisted tokens', async () => {
      const payload = {
        userId: 'user123',
        email: 'test@example.com',
        role: 'user' as const,
      };
      const signResult = await service.sign(payload);
      expect(signResult.ok).toBe(true);
      
      if (signResult.ok) {
        // Mock Redis exists to return true (blacklisted)
        (mockRedisClient.exists as jest.Mock).mockResolvedValue(1);

        const verifyResult = await service.verify(signResult.value.accessToken);
        
        expect(verifyResult.ok).toBe(false);
        if (!verifyResult.ok) {
          expect(verifyResult.error.type).toBe('TOKEN_BLACKLISTED');
          expect(verifyResult.error.message).toContain('blacklisted');
        }
      }
    });

    it('should reject expired tokens', async () => {
      // Create an expired token
      const expiredToken = jwt.sign(
        {
          userId: 'user123',
          email: 'test@example.com',
          role: 'user',
          jti: 'token-id',
        },
        testSecret,
        {
          expiresIn: '-1h', // Already expired
          issuer: 'test-issuer',
          audience: 'test-audience',
        }
      );

      (mockRedisClient.exists as jest.Mock).mockResolvedValue(0);
      
      const result = await service.verify(expiredToken);
      
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.type).toBe('TOKEN_EXPIRED');
        expect(result.error.message).toContain('expired');
      }
    });

    it('should reject tokens with invalid signature', async () => {
      const invalidToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJ1c2VyMTIzIiwiZW1haWwiOiJ0ZXN0QGV4YW1wbGUuY29tIiwicm9sZSI6InVzZXIiLCJpYXQiOjE2MTYyMzkwMjJ9.invalid_signature';
      
      (mockRedisClient.exists as jest.Mock).mockResolvedValue(0);
      
      const result = await service.verify(invalidToken);
      
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.type).toBe('TOKEN_INVALID');
        expect(result.error.message).toContain('invalid');
      }
    });

    it('should reject malformed tokens', async () => {
      const malformedToken = 'not.a.jwt';
      
      const result = await service.verify(malformedToken);
      
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.type).toBe('TOKEN_INVALID');
      }
    });

    it('should reject tokens with wrong issuer', async () => {
      const wrongIssuerToken = jwt.sign(
        {
          userId: 'user123',
          email: 'test@example.com',
          role: 'user',
          jti: 'token-id',
        },
        testSecret,
        {
          expiresIn: '1h',
          issuer: 'wrong-issuer',
          audience: 'test-audience',
        }
      );

      (mockRedisClient.exists as jest.Mock).mockResolvedValue(0);
      
      const result = await service.verify(wrongIssuerToken);
      
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.type).toBe('TOKEN_INVALID');
        expect(result.error.message).toContain('issuer');
      }
    });

    it('should reject tokens with wrong audience', async () => {
      const wrongAudienceToken = jwt.sign(
        {
          userId: 'user123',
          email: 'test@example.com',
          role: 'user',
          jti: 'token-id',
        },
        testSecret,
        {
          expiresIn: '1h',
          issuer: 'test-issuer',
          audience: 'wrong-audience',
        }
      );

      (mockRedisClient.exists as jest.Mock).mockResolvedValue(0);
      
      const result = await service.verify(wrongAudienceToken);
      
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.type).toBe('TOKEN_INVALID');
        expect(result.error.message).toContain('audience');
      }
    });

    it('should handle Redis errors gracefully', async () => {
      const payload = {
        userId: 'user123',
        email: 'test@example.com',
        role: 'user' as const,
      };
      const signResult = await service.sign(payload);
      expect(signResult.ok).toBe(true);
      
      if (signResult.ok) {
        // Mock Redis error
        (mockRedisClient.exists as jest.Mock).mockRejectedValue(new Error('Redis connection failed'));

        const verifyResult = await service.verify(signResult.value.accessToken);
        
        expect(verifyResult.ok).toBe(false);
        if (!verifyResult.ok) {
          expect(verifyResult.error.type).toBe('SERVER_ERROR');
          expect(verifyResult.error.message).toContain('verify token');
        }
      }
    });
  });

  describe('refreshTokenRotation', () => {
    it('should successfully rotate refresh tokens', async () => {
      // Sign initial tokens
      const payload = {
        userId: 'user123',
        email: 'test@example.com',
        role: 'user' as const,
      };
      const signResult = await service.sign(payload);
      expect(signResult.ok).toBe(true);
      
      if (signResult.ok) {
        // Mock Redis operations
        (mockRedisClient.exists as jest.Mock).mockResolvedValue(0);
        (mockRedisClient.get as jest.Mock).mockResolvedValue(null);
        (mockRedisClient.setEx as jest.Mock).mockResolvedValue('OK');

        // Perform rotation
        const rotateResult = await service.refreshTokenRotation(signResult.value.refreshToken);
        
        expect(rotateResult.ok).toBe(true);
        if (rotateResult.ok) {
          expect(rotateResult.value.accessToken).toBeDefined();
          expect(rotateResult.value.refreshToken).toBeDefined();
          expect(rotateResult.value.accessToken).not.toBe(signResult.value.accessToken);
          expect(rotateResult.value.refreshToken).not.toBe(signResult.value.refreshToken);
          
          // Verify old refresh token was blacklisted
          expect(mockRedisClient.setEx).toHaveBeenCalled();
        }
      }
    });

    it('should prevent reuse of old refresh tokens', async () => {
      const payload = {
        userId: 'user123',
        email: 'test@example.com',
        role: 'user' as const,
      };
      const signResult = await service.sign(payload);
      expect(signResult.ok).toBe(true);
      
      if (signResult.ok) {
        // First rotation succeeds
        (mockRedisClient.exists as jest.Mock).mockResolvedValue(0);
        (mockRedisClient.get as jest.Mock).mockResolvedValue(null);
        (mockRedisClient.setEx as jest.Mock).mockResolvedValue('OK');
        
        const firstRotation = await service.refreshTokenRotation(signResult.value.refreshToken);
        expect(firstRotation.ok).toBe(true);
        
        // Second attempt with same token fails (now blacklisted)
        (mockRedisClient.exists as jest.Mock).mockResolvedValue(1);
        
        const secondRotation = await service.refreshTokenRotation(signResult.value.refreshToken);
        expect(secondRotation.ok).toBe(false);
        if (!secondRotation.ok) {
          expect(secondRotation.error.type).toBe('TOKEN_BLACKLISTED');
        }
      }
    });

    it('should reject expired refresh tokens', async () => {
      const expiredRefreshToken = jwt.sign(
        {
          userId: 'user123',
          email: 'test@example.com',
          role: 'user',
          jti: 'refresh-token-id',
          type: 'refresh',
        },
        testRefreshSecret,
        {
          expiresIn: '-1h',
          issuer: 'test-issuer',
          audience: 'test-audience',
        }
      );

      (mockRedisClient.exists as jest.Mock).mockResolvedValue(0);
      
      const result = await service.refreshTokenRotation(expiredRefreshToken);
      
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.type).toBe('TOKEN_EXPIRED');
      }
    });

    it('should reject access tokens used as refresh tokens', async () => {
      const payload = {
        userId: 'user123',
        email: 'test@example.com',
        role: 'user' as const,
      };
      const signResult = await service.sign(payload);
      expect(signResult.ok).toBe(true);
      
      if (signResult.ok) {
        (mockRedisClient.exists as jest.Mock).mockResolvedValue(0);
        
        // Try to use access token as refresh token
        const result = await service.refreshTokenRotation(signResult.value.accessToken);
        
        expect(result.ok).toBe(false);
        if (!result.ok) {
          expect(result.error.type).toBe('TOKEN_INVALID');
          expect(result.error.message).toContain('refresh token');
        }
      }
    });

    it('should maintain user context after rotation', async () => {
      const payload = {
        userId: 'user123',
        email: 'test@example.com',
        role: 'admin' as const,
      };
      const signResult = await service.sign(payload);
      expect(signResult.ok).toBe(true);
      
      if (signResult.ok) {
        (mockRedisClient.exists as jest.Mock).mockResolvedValue(0);
        (mockRedisClient.get as jest.Mock).mockResolvedValue(null);
        (mockRedisClient.setEx as jest.Mock).mockResolvedValue('OK');

        const rotateResult = await service.refreshTokenRotation(signResult.value.refreshToken);
        
        expect(rotateResult.ok).toBe(true);
        if (rotateResult.ok) {
          // Verify new access token
          (mockRedisClient.exists as jest.Mock).mockResolvedValue(0);
          const verifyResult = await service.verify(rotateResult.value.accessToken);
          
          expect(verifyResult.ok).toBe(true);
          if (verifyResult.ok) {
            expect(verifyResult.value.userId).toBe(payload.userId);
            expect(verifyResult.value.email).toBe(payload.email);
            expect(verifyResult.value.role).toBe(payload.role);
          }
        }
      }
    });

    it('should handle concurrent rotation attempts', async () => {
      const payload = {
        userId: 'user123',
        email: 'test@example.com',
        role: 'user' as const,
      };
      const signResult = await service.sign(payload);
      expect(signResult.ok).toBe(true);
      
      if (signResult.ok) {
        // Simulate first rotation in progress
        (mockRedisClient.exists as jest.Mock).mockResolvedValue(0);
        (mockRedisClient.get as jest.Mock).mockResolvedValue('rotation-in-progress');
        
        const result = await service.refreshTokenRotation(signResult.value.refreshToken);
        
        expect(result.ok).toBe(false);
        if (!result.ok) {
          expect(result.error.type).toBe('TOKEN_ROTATION_IN_PROGRESS');
          expect(result.error.message).toContain('rotation already in progress');
        }
      }
    });
  });

  describe('blacklist', () => {
    it('should successfully blacklist a token', async () => {
      const payload = {
        userId: 'user123',
        email: 'test@example.com',
        role: 'user' as const,
      };
      const signResult = await service.sign(payload);
      expect(signResult.ok).toBe(true);
      
      if (signResult.ok) {
        (mockRedisClient.setEx as jest.Mock).mockResolvedValue('OK');
        
        const blacklistResult = await service.blacklist(signResult.value.accessToken);
        
        expect(blacklistResult.ok).toBe(true);
        if (blacklistResult.ok) {
          expect(blacklistResult.value.blacklistedAt).toBeInstanceOf(Date);
          expect(blacklistResult.value.tokenId).toBeDefined();
          expect(mockRedisClient.setEx).toHaveBeenCalled();
        }
      }
    });

    it('should calculate correct TTL for blacklisted tokens', async () => {
      const payload = {
        userId: 'user123',
        email: 'test@example.com',
        role: 'user' as const,
      };
      const signResult = await service.sign(payload);
      expect(signResult.ok).toBe(true);
      
      if (signResult.ok) {
        (mockRedisClient.setEx as jest.Mock).mockResolvedValue('OK');
        
        await service.blacklist(signResult.value.accessToken);
        
        // Verify setEx was called with appropriate TTL
        const calls = (mockRedisClient.setEx as jest.Mock).mock.calls;
        const ttl = calls[calls.length - 1][1];
        expect(ttl).toBeGreaterThan(0);
        expect(ttl).toBeLessThanOrEqual(15 * 60); // 15 minutes max
      }
    });

    it('should handle blacklisting expired tokens', async () => {
      const expiredToken = jwt.sign(
        {
          userId: 'user123',
          email: 'test@example.com',
          role: 'user',
          jti: 'token-id',
        },
        testSecret,
        {
          expiresIn: '-1h',
          issuer: 'test-issuer',
          audience: 'test-audience',
        }
      );

      const result = await service.blacklist(expiredToken);
      
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.type).toBe('TOKEN_EXPIRED');
        expect(result.error.message).toContain('already expired');
      }
    });

    it('should reject blacklisting invalid tokens', async () => {
      const invalidToken = 'not.a.jwt';
      
      const result = await service.blacklist(invalidToken);
      
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.type).toBe('TOKEN_INVALID');
      }
    });

    it('should handle Redis errors during blacklisting', async () => {
      const payload = {
        userId: 'user123',
        email: 'test@example.com',
        role: 'user' as const,
      };
      const signResult = await service.sign(payload);
      expect(signResult.ok).toBe(true);
      
      if (signResult.ok) {
        (mockRedisClient.setEx as jest.Mock).mockRejectedValue(new Error('Redis error'));
        
        const blacklistResult = await service.blacklist(signResult.value.accessToken);
        
        expect(blacklistResult.ok).toBe(false);
        if (!blacklistResult.ok) {
          expect(blacklistResult.error.type).toBe('SERVER_ERROR');
          expect(blacklistResult.error.message).toContain('blacklist token');
        }
      }
    });

    it('should support blacklisting with reason', async () => {
      const payload = {
        userId: 'user123',
        email: 'test@example.com',
        role: 'user' as const,
      };
      const signResult = await service.sign(payload);
      expect(signResult.ok).toBe(true);
      
      if (signResult.ok) {
        (mockRedisClient.setEx as jest.Mock).mockResolvedValue('OK');
        
        const reason = 'User logout';
        const blacklistResult = await service.blacklist(signResult.value.accessToken, reason);
        
        expect(blacklistResult.ok).toBe(true);
        if (blacklistResult.ok) {
          expect(blacklistResult.value.reason).toBe(reason);
        }
        
        // Verify reason was stored in Redis
        const redisCall = (mockRedisClient.setEx as jest.Mock).mock.calls[0];
        const storedValue = JSON.parse(redisCall[2]);
        expect(storedValue.reason).toBe(reason);
      }
    });
  });

  describe('edge cases', () => {
    it('should handle very large payloads', async () => {
      const largePayload = {
        userId: 'user123',
        email: 'test@example.com',
        role: 'user' as const,
        metadata: 'x'.repeat(10000), // Large metadata
      };

      const result = await service.sign(largePayload as any);
      
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.type).toBe('VALIDATION_ERROR');
        expect(result.error.message).toContain('Payload too large');
      }
    });

    it('should handle special characters in payload', async () => {
      const payload = {
        userId: 'user-123-αβγ',
        email: 'test+tag@example.com',
        role: 'user' as const,
      };

      const result = await service.sign(payload);
      
      expect(result.ok).toBe(true);
      if (result.ok) {
        (mockRedisClient.exists as jest.Mock).mockResolvedValue(0);
        
        const verifyResult = await service.verify(result.value.accessToken);
        expect(verifyResult.ok).toBe(true);
        if (verifyResult.ok) {
          expect(verifyResult.value.userId).toBe(payload.userId);
          expect(verifyResult.value.email).toBe(payload.email);
        }
      }
    });

    it('should handle clock skew for token verification', async () => {
      // Create token with slight future iat
      const futureToken = jwt.sign(
        {
          userId: 'user123',
          email: 'test@example.com',
          role: 'user',
          jti: 'token-id',
          iat: Math.floor(Date.now() / 1000) + 30, // 30 seconds in future
        },
        testSecret,
        {
          expiresIn: '1h',
          issuer: 'test-issuer',
          audience: 'test-audience',
        }
      );

      (mockRedisClient.exists as jest.Mock).mockResolvedValue(0);
      
      const result = await service.verify(futureToken, { clockTolerance: 60 });
      
      expect(result.ok).toBe(true);
    });
  });

  describe('configuration validation', () => {
    it('should reject invalid secret length', () => {
      expect(() => {
        new JWTTokenService({
          secret: 'short',
          refreshSecret: testRefreshSecret,
          redisClient: mockRedisClient,
          issuer: 'test-issuer',
          audience: 'test-audience',
        });
      }).toThrow('Secret must be at least 32 characters');
    });

    it('should reject invalid expiry formats', () => {
      expect(() => {
        new JWTTokenService({
          secret: testSecret,
          refreshSecret: testRefreshSecret,
          redisClient: mockRedisClient,
          issuer: 'test-issuer',
          audience: 'test-audience',
          accessTokenExpiry: 'invalid',
        });
      }).toThrow('Invalid token expiry format');
    });

    it('should use default values when not provided', () => {
      const service = new JWTTokenService({
        secret: testSecret,
        refreshSecret: testRefreshSecret,
        redisClient: mockRedisClient,
      });

      expect(service).toBeDefined();
      // Service should use default issuer, audience, and expiry values
    });
  });
});