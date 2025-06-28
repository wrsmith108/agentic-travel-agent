import { JWTService } from '../jwtService';
import { redis } from '../../../../config/redis';
import { isOk, isErr } from '../../../../utils/result';
import type { Result } from '../../../../utils/result';

// Mock Redis
jest.mock('../../../../config/redis', () => ({
  redis: {
    set: jest.fn(),
    get: jest.fn(),
    del: jest.fn(),
    expire: jest.fn(),
    sadd: jest.fn(),
    sismember: jest.fn(),
    scan: jest.fn(),
  }
}));

const mockedRedis = redis as jest.Mocked<typeof redis>;

describe('JWTService', () => {
  let jwtService: JWTService;
  const mockUserId = 'user-123';
  const mockEmail = 'test@example.com';
  
  beforeEach(() => {
    jest.clearAllMocks();
    jwtService = new JWTService({
      accessSecret: 'test-access-secret-32-characters-long',
      refreshSecret: 'test-refresh-secret-32-characters-long',
      accessTokenExpiry: '15m',
      refreshTokenExpiry: '7d',
    });
  });

  describe('generateTokens', () => {
    it('should generate both access and refresh tokens', async () => {
      const result = await jwtService.generateTokens(mockUserId, mockEmail);
      
      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value).toHaveProperty('accessToken');
        expect(result.value).toHaveProperty('refreshToken');
        expect(result.value.accessToken).toBeTruthy();
        expect(result.value.refreshToken).toBeTruthy();
        expect(result.value.accessToken).not.toBe(result.value.refreshToken);
      }
    });

    it('should store refresh token in Redis', async () => {
      const result = await jwtService.generateTokens(mockUserId, mockEmail);
      
      expect(isOk(result)).toBe(true);
      expect(redis.set).toHaveBeenCalledWith(
        expect.stringContaining(`refresh_token:${mockUserId}:`),
        expect.any(String),
        'EX',
        expect.any(Number)
      );
    });
  });

  describe('verifyAccessToken', () => {
    it('should verify a valid access token', async () => {
      const tokensResult = await jwtService.generateTokens(mockUserId, mockEmail);
      expect(isOk(tokensResult)).toBe(true);
      
      if (isOk(tokensResult)) {
        const verifyResult = await jwtService.verifyAccessToken(tokensResult.value.accessToken);
        
        expect(isOk(verifyResult)).toBe(true);
        if (isOk(verifyResult)) {
          expect(verifyResult.value.userId).toBe(mockUserId);
          expect(verifyResult.value.email).toBe(mockEmail);
        }
      }
    });

    it('should reject an invalid token', async () => {
      const result = await jwtService.verifyAccessToken('invalid-token');
      
      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error.code).toBe('INVALID_TOKEN');
      }
    });

    it('should reject a blacklisted token', async () => {
      mockedRedis.sismember.mockResolvedValueOnce(1);
      
      const tokensResult = await jwtService.generateTokens(mockUserId, mockEmail);
      expect(isOk(tokensResult)).toBe(true);
      
      if (isOk(tokensResult)) {
        const verifyResult = await jwtService.verifyAccessToken(tokensResult.value.accessToken);
        
        expect(isErr(verifyResult)).toBe(true);
        if (isErr(verifyResult)) {
          expect(verifyResult.error.code).toBe('TOKEN_BLACKLISTED');
        }
      }
    });
  });

  describe('refreshTokens', () => {
    it('should generate new tokens with valid refresh token', async () => {
      mockedRedis.get.mockResolvedValueOnce(mockEmail);
      
      const initialTokens = await jwtService.generateTokens(mockUserId, mockEmail);
      expect(isOk(initialTokens)).toBe(true);
      
      if (isOk(initialTokens)) {
        const refreshResult = await jwtService.refreshTokens(initialTokens.value.refreshToken);
        
        expect(isOk(refreshResult)).toBe(true);
        if (isOk(refreshResult)) {
          expect(refreshResult.value.accessToken).toBeTruthy();
          expect(refreshResult.value.refreshToken).toBeTruthy();
          // New tokens should be different
          expect(refreshResult.value.accessToken).not.toBe(initialTokens.value.accessToken);
          expect(refreshResult.value.refreshToken).not.toBe(initialTokens.value.refreshToken);
        }
      }
    });

    it('should delete old refresh token when rotating', async () => {
      mockedRedis.get.mockResolvedValueOnce(mockEmail);
      
      const initialTokens = await jwtService.generateTokens(mockUserId, mockEmail);
      
      if (isOk(initialTokens)) {
        await jwtService.refreshTokens(initialTokens.value.refreshToken);
        
        expect(redis.del).toHaveBeenCalledWith(
          expect.stringContaining(`refresh_token:${mockUserId}:`)
        );
      }
    });

    it('should reject invalid refresh token', async () => {
      const result = await jwtService.refreshTokens('invalid-refresh-token');
      
      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error.code).toBe('INVALID_REFRESH_TOKEN');
      }
    });

    it('should reject refresh token not in Redis', async () => {
      mockedRedis.get.mockResolvedValueOnce(null);
      
      const initialTokens = await jwtService.generateTokens(mockUserId, mockEmail);
      
      if (isOk(initialTokens)) {
        const result = await jwtService.refreshTokens(initialTokens.value.refreshToken);
        
        expect(isErr(result)).toBe(true);
        if (isErr(result)) {
          expect(result.error.code).toBe('REFRESH_TOKEN_NOT_FOUND');
        }
      }
    });
  });

  describe('blacklistToken', () => {
    it('should add token to blacklist', async () => {
      const tokensResult = await jwtService.generateTokens(mockUserId, mockEmail);
      
      if (isOk(tokensResult)) {
        const blacklistResult = await jwtService.blacklistToken(tokensResult.value.accessToken);
        
        expect(isOk(blacklistResult)).toBe(true);
        expect(redis.sadd).toHaveBeenCalledWith(
          'token_blacklist',
          tokensResult.value.accessToken
        );
        expect(redis.expire).toHaveBeenCalledWith(
          'token_blacklist',
          expect.any(Number)
        );
      }
    });

    it('should handle invalid tokens in blacklist', async () => {
      const result = await jwtService.blacklistToken('invalid-token');
      
      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error.code).toBe('INVALID_TOKEN');
      }
    });
  });

  describe('revokeAllUserTokens', () => {
    it('should revoke all tokens for a user', async () => {
      // Mock scan to return some keys
      mockedRedis.scan.mockResolvedValue(['0', [`refresh_token:${mockUserId}:123`, `refresh_token:${mockUserId}:456`]]);
      
      const result = await jwtService.revokeAllUserTokens(mockUserId);
      
      expect(isOk(result)).toBe(true);
      expect(redis.scan).toHaveBeenCalledWith(
        '0',
        'MATCH',
        `refresh_token:${mockUserId}:*`,
        'COUNT',
        100
      );
      expect(redis.del).toHaveBeenCalledWith(
        `refresh_token:${mockUserId}:123`,
        `refresh_token:${mockUserId}:456`
      );
    });

    it('should handle when no tokens exist', async () => {
      // Mock scan to return no keys
      mockedRedis.scan.mockResolvedValue(['0', []]);
      
      const result = await jwtService.revokeAllUserTokens(mockUserId);
      
      expect(isOk(result)).toBe(true);
      expect(redis.del).not.toHaveBeenCalled();
    });
  });
});