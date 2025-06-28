import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { redis } from '../../../config/redis';
import { Result, ok, err } from '../../../utils/result';
import type { JWTConfig, TokenPayload, TokenPair, JWTError } from './types';

export class JWTService {
  private config: JWTConfig;
  private refreshTokenPrefix = 'refresh_token:';
  private blacklistKey = 'token_blacklist';

  constructor(config: JWTConfig) {
    this.config = config;
  }

  async generateTokens(userId: string, email: string): Promise<Result<TokenPair, JWTError>> {
    try {
      const jti = uuidv4();
      
      // Generate access token with unique jti
      const accessJti = uuidv4();
      const accessPayload: TokenPayload = {
        userId,
        email,
        type: 'access',
        jti: accessJti,
      };
      
      const accessToken = jwt.sign(
        accessPayload,
        this.config.accessSecret,
        { expiresIn: this.config.accessTokenExpiry }
      );

      // Generate refresh token with jti
      const refreshPayload: TokenPayload = {
        userId,
        email,
        type: 'refresh',
        jti,
      };
      
      const refreshToken = jwt.sign(
        refreshPayload,
        this.config.refreshSecret,
        { expiresIn: this.config.refreshTokenExpiry }
      );

      // Store refresh token in Redis
      const refreshKey = `${this.refreshTokenPrefix}${userId}:${jti}`;
      const refreshExpiry = this.parseExpiry(this.config.refreshTokenExpiry);
      
      await redis.set(refreshKey, email, 'EX', refreshExpiry);

      return ok({ accessToken, refreshToken });
    } catch (error) {
      return err({
        code: 'TOKEN_GENERATION_FAILED',
        message: error instanceof Error ? error.message : 'Failed to generate tokens',
      });
    }
  }

  async verifyAccessToken(token: string): Promise<Result<TokenPayload, JWTError>> {
    try {
      // Check if token is blacklisted
      const isBlacklisted = await redis.sismember(this.blacklistKey, token);
      if (isBlacklisted) {
        return err({
          code: 'TOKEN_BLACKLISTED',
          message: 'Token has been revoked',
        });
      }

      // Verify token
      const payload = jwt.verify(token, this.config.accessSecret) as TokenPayload;
      
      return ok(payload);
    } catch (error) {
      return err({
        code: 'INVALID_TOKEN',
        message: error instanceof jwt.JsonWebTokenError ? error.message : 'Invalid token',
      });
    }
  }

  async refreshTokens(refreshToken: string): Promise<Result<TokenPair, JWTError>> {
    try {
      // Verify refresh token
      const payload = jwt.verify(refreshToken, this.config.refreshSecret) as TokenPayload;
      
      if (payload.type !== 'refresh' || !payload.jti) {
        return err({
          code: 'INVALID_REFRESH_TOKEN',
          message: 'Invalid refresh token format',
        });
      }

      // Check if refresh token exists in Redis
      const refreshKey = `${this.refreshTokenPrefix}${payload.userId}:${payload.jti}`;
      const storedEmail = await redis.get(refreshKey);
      
      if (!storedEmail) {
        return err({
          code: 'REFRESH_TOKEN_NOT_FOUND',
          message: 'Refresh token not found or expired',
        });
      }

      // Delete old refresh token
      await redis.del(refreshKey);

      // Generate new token pair
      return this.generateTokens(payload.userId, payload.email);
    } catch (error) {
      return err({
        code: 'INVALID_REFRESH_TOKEN',
        message: error instanceof jwt.JsonWebTokenError ? error.message : 'Invalid refresh token',
      });
    }
  }

  async blacklistToken(token: string): Promise<Result<void, JWTError>> {
    try {
      // Verify token to get expiry
      const payload = jwt.verify(token, this.config.accessSecret) as jwt.JwtPayload;
      
      if (!payload.exp) {
        return err({
          code: 'INVALID_TOKEN',
          message: 'Token has no expiry',
        });
      }

      // Add to blacklist set
      await redis.sadd(this.blacklistKey, token);
      
      // Set expiry on blacklist to match token expiry
      const ttl = payload.exp - Math.floor(Date.now() / 1000);
      if (ttl > 0) {
        await redis.expire(this.blacklistKey, ttl);
      }

      return ok(undefined);
    } catch (error) {
      return err({
        code: 'INVALID_TOKEN',
        message: error instanceof Error ? error.message : 'Failed to blacklist token',
      });
    }
  }

  async revokeAllUserTokens(userId: string): Promise<Result<void, JWTError>> {
    try {
      // Find all refresh tokens for user
      const pattern = `${this.refreshTokenPrefix}${userId}:*`;
      
      // Note: In production, use SCAN instead of KEYS
      const keys = await this.scanKeys(pattern);
      
      if (keys.length > 0) {
        await redis.del(...keys);
      }

      return ok(undefined);
    } catch (error) {
      return err({
        code: 'REDIS_ERROR',
        message: error instanceof Error ? error.message : 'Failed to revoke tokens',
      });
    }
  }

  private parseExpiry(expiry: string): number {
    const match = expiry.match(/^(\d+)([smhd])$/);
    if (!match) {
      throw new Error(`Invalid expiry format: ${expiry}`);
    }

    const value = parseInt(match[1], 10);
    const unit = match[2];

    switch (unit) {
      case 's':
        return value;
      case 'm':
        return value * 60;
      case 'h':
        return value * 60 * 60;
      case 'd':
        return value * 60 * 60 * 24;
      default:
        throw new Error(`Invalid time unit: ${unit}`);
    }
  }

  private async scanKeys(pattern: string): Promise<string[]> {
    const keys: string[] = [];
    let cursor = '0';

    do {
      const [newCursor, foundKeys] = await redis.scan(
        cursor,
        'MATCH',
        pattern,
        'COUNT',
        100
      );
      
      cursor = newCursor;
      keys.push(...foundKeys);
    } while (cursor !== '0');

    return keys;
  }
}