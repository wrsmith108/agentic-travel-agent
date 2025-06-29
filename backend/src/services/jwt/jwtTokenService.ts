import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import type {
  JWTServiceConfig,
  JWTPayload,
  Result,
  TokenError,
  SignResult,
  DecodedToken,
  VerifyOptions,
  BlacklistResult,
  RotationResult,
  UserRole,
} from './types';
import { ok, err } from './types';

export class JWTTokenService {
  private readonly secret: string;
  private readonly refreshSecret: string;
  private readonly redisClient: JWTServiceConfig['redisClient'];
  private readonly issuer: string;
  private readonly audience: string;
  private readonly accessTokenExpiry: string;
  private readonly refreshTokenExpiry: string;
  private readonly blacklistKeyPrefix: string;
  private readonly rotationLockPrefix: string;
  private readonly maxPayloadSize: number;

  constructor(config: JWTServiceConfig) {
    this.validateConfig(config);
    
    this.secret = config.secret;
    this.refreshSecret = config.refreshSecret;
    this.redisClient = config.redisClient;
    this.issuer = config.issuer || 'jwt-service';
    this.audience = config.audience || 'jwt-service-users';
    this.accessTokenExpiry = config.accessTokenExpiry || '15m';
    this.refreshTokenExpiry = config.refreshTokenExpiry || '7d';
    this.blacklistKeyPrefix = config.blacklistKeyPrefix || 'blacklist:';
    this.rotationLockPrefix = config.rotationLockPrefix || 'rotation:';
    this.maxPayloadSize = config.maxPayloadSize || 8192; // 8KB default
  }

  private validateConfig(config: JWTServiceConfig): void {
    if (config.secret.length < 32) {
      throw new Error('Secret must be at least 32 characters');
    }
    if (config.refreshSecret.length < 32) {
      throw new Error('Refresh secret must be at least 32 characters');
    }
    if (config.accessTokenExpiry && !this.isValidExpiry(config.accessTokenExpiry)) {
      throw new Error('Invalid token expiry format');
    }
    if (config.refreshTokenExpiry && !this.isValidExpiry(config.refreshTokenExpiry)) {
      throw new Error('Invalid token expiry format');
    }
  }

  private isValidExpiry(expiry: string): boolean {
    return /^\d+[smhdwy]$/.test(expiry);
  }

  private validatePayload(payload: JWTPayload): Result<void, TokenError> {
    if (!payload || typeof payload !== 'object') {
      return err({
        type: 'VALIDATION_ERROR',
        message: 'Invalid payload: must be an object',
      });
    }

    if (!payload.userId || typeof payload.userId !== 'string') {
      return err({
        type: 'VALIDATION_ERROR',
        message: 'Invalid payload: userId is required',
      });
    }

    if (!payload.email || typeof payload.email !== 'string') {
      return err({
        type: 'VALIDATION_ERROR',
        message: 'Invalid payload: email is required',
      });
    }

    if (!payload.role || !this.isValidRole(payload.role)) {
      return err({
        type: 'VALIDATION_ERROR',
        message: 'Invalid role: must be user, admin, or moderator',
      });
    }

    const payloadSize = JSON.stringify(payload).length;
    if (payloadSize > this.maxPayloadSize) {
      return err({
        type: 'VALIDATION_ERROR',
        message: 'Payload too large',
        details: { size: payloadSize, maxSize: this.maxPayloadSize },
      });
    }

    return ok(undefined);
  }

  private isValidRole(role: string): role is UserRole {
    return ['user', 'admin', 'moderator'].includes(role);
  }

  private generateTokenId(): string {
    return crypto.randomBytes(16).toString('hex');
  }

  private expiryToSeconds(expiry: string): number {
    const match = expiry.match(/^(\d+)([smhdwy])$/);
    if (!match) return 0;

    const value = parseInt(match[1], 10);
    const unit = match[2];

    const unitToSeconds: Record<string, number> = {
      s: 1,
      m: 60,
      h: 3600,
      d: 86400,
      w: 604800,
      y: 31536000,
    };

    return value * unitToSeconds[unit];
  }

  async sign(payload: JWTPayload): Promise<Result<SignResult, TokenError>> {
    const validationResult = this.validatePayload(payload);
    if (isErr(validationResult)) {
      return err(validationResult.error);
    }

    try {
      const issuedAt = new Date();
      const accessTokenId = this.generateTokenId();
      const refreshTokenId = this.generateTokenId();
      
      const accessTokenPayload = {
        ...payload,
        jti: accessTokenId,
      };

      const refreshTokenPayload = {
        ...payload,
        jti: refreshTokenId,
        type: 'refresh' as const,
      };

      const accessToken = jwt.sign(accessTokenPayload, this.secret, {
        expiresIn: this.accessTokenExpiry,
        issuer: this.issuer,
        audience: this.audience,
      });

      const refreshToken = jwt.sign(refreshTokenPayload, this.refreshSecret, {
        expiresIn: this.refreshTokenExpiry,
        issuer: this.issuer,
        audience: this.audience,
      });

      const expiresInSeconds = this.expiryToSeconds(this.accessTokenExpiry);
      const expiresAt = new Date(issuedAt.getTime() + expiresInSeconds * 1000);

      return ok({
        accessToken,
        refreshToken,
        expiresIn: this.accessTokenExpiry,
        tokenType: 'Bearer',
        issuedAt,
        expiresAt,
      });
    } catch (error) {
      return err({
        type: 'SERVER_ERROR',
        message: 'Failed to sign token',
        details: { error: error instanceof Error ? error.message : 'Unknown error' },
      });
    }
  }

  async verify(
    token: string,
    options: VerifyOptions = {}
  ): Promise<Result<DecodedToken, TokenError>> {
    try {
      const verifyOptions: jwt.VerifyOptions = {
        issuer: this.issuer,
        audience: this.audience,
        clockTolerance: options.clockTolerance,
        ignoreExpiration: options.ignoreExpiration,
      };

      const decoded = jwt.verify(token, this.secret, verifyOptions) as DecodedToken;

      if (!decoded.jti) {
        return err({
          type: 'TOKEN_INVALID',
          message: 'Token missing jti claim',
        });
      }

      // Check if token is blacklisted
      const blacklistKey = `${this.blacklistKeyPrefix}${decoded.jti}`;
      const isBlacklisted = await this.redisClient.exists(blacklistKey);
      
      if (isBlacklisted) {
        return err({
          type: 'TOKEN_BLACKLISTED',
          message: 'Token has been blacklisted',
        });
      }

      return ok(decoded);
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        return err({
          type: 'TOKEN_EXPIRED',
          message: 'Token has expired',
        });
      }
      if (error instanceof jwt.JsonWebTokenError) {
        return err({
          type: 'TOKEN_INVALID',
          message: error.message,
        });
      }
      return err({
        type: 'SERVER_ERROR',
        message: 'Failed to verify token',
        details: { error: error instanceof Error ? error.message : 'Unknown error' },
      });
    }
  }

  async refreshTokenRotation(
    refreshToken: string
  ): Promise<Result<RotationResult, TokenError>> {
    try {
      // Verify refresh token with refresh secret
      const verifyOptions: jwt.VerifyOptions = {
        issuer: this.issuer,
        audience: this.audience,
      };

      let decoded: DecodedToken;
      try {
        decoded = jwt.verify(refreshToken, this.refreshSecret, verifyOptions) as DecodedToken;
      } catch (error) {
        if (error instanceof jwt.TokenExpiredError) {
          return err({
            type: 'TOKEN_EXPIRED',
            message: 'Refresh token has expired',
          });
        }
        return err({
          type: 'TOKEN_INVALID',
          message: 'Invalid refresh token',
        });
      }

      if (decoded.type !== 'refresh') {
        return err({
          type: 'TOKEN_INVALID',
          message: 'Token is not a refresh token',
        });
      }

      // Check if refresh token is blacklisted
      const blacklistKey = `${this.blacklistKeyPrefix}${decoded.jti}`;
      const isBlacklisted = await this.redisClient.exists(blacklistKey);
      
      if (isBlacklisted) {
        return err({
          type: 'TOKEN_BLACKLISTED',
          message: 'Refresh token has been blacklisted',
        });
      }

      // Check for concurrent rotation
      const rotationKey = `${this.rotationLockPrefix}${decoded.jti}`;
      const rotationLock = await this.redisClient.get(rotationKey);
      
      if (rotationLock) {
        return err({
          type: 'TOKEN_ROTATION_IN_PROGRESS',
          message: 'Token rotation already in progress',
        });
      }

      // Set rotation lock (5 second TTL)
      await this.redisClient.setEx(rotationKey, 5, 'rotation-in-progress');

      try {
        // Blacklist old refresh token
        const ttl = Math.max(decoded.exp - Math.floor(Date.now() / 1000), 0);
        if (ttl > 0) {
          await this.redisClient.setEx(
            blacklistKey,
            ttl,
            JSON.stringify({
              blacklistedAt: new Date().toISOString(),
              reason: 'Token rotation',
            })
          );
        }

        // Create new tokens
        const newPayload: JWTPayload = {
          userId: decoded.userId,
          email: decoded.email,
          role: decoded.role,
          sessionId: decoded.sessionId,
          metadata: decoded.metadata,
        };

        const signResult = await this.sign(newPayload);
        if (isErr(signResult)) {
          return err(signResult.error);
        }

        return ok(signResult.value);
      } finally {
        // Remove rotation lock
        await this.redisClient.del(rotationKey);
      }
    } catch (error) {
      return err({
        type: 'SERVER_ERROR',
        message: 'Failed to rotate refresh token',
        details: { error: error instanceof Error ? error.message : 'Unknown error' },
      });
    }
  }

  async blacklist(
    token: string,
    reason?: string
  ): Promise<Result<BlacklistResult, TokenError>> {
    try {
      // Decode token without verification to get jti and exp
      const decoded = jwt.decode(token) as DecodedToken | null;
      
      if (!decoded || typeof decoded !== 'object') {
        return err({
          type: 'TOKEN_INVALID',
          message: 'Invalid token format',
        });
      }

      if (!decoded.jti) {
        return err({
          type: 'TOKEN_INVALID',
          message: 'Token missing jti claim',
        });
      }

      // Check if token is already expired
      const now = Math.floor(Date.now() / 1000);
      if (decoded.exp && decoded.exp <= now) {
        return err({
          type: 'TOKEN_EXPIRED',
          message: 'Token is already expired',
        });
      }

      // Calculate TTL for blacklist entry
      const ttl = decoded.exp ? decoded.exp - now : 3600; // Default 1 hour if no exp
      const blacklistKey = `${this.blacklistKeyPrefix}${decoded.jti}`;
      const blacklistedAt = new Date();

      const blacklistData = JSON.stringify({
        blacklistedAt: blacklistedAt as string,
        reason: reason || 'Manual blacklist',
        tokenType: decoded.type || 'access',
      });

      await this.redisClient.setEx(blacklistKey, ttl, blacklistData);

      return ok({
        tokenId: decoded.jti,
        blacklistedAt,
        reason,
      });
    } catch (error) {
      return err({
        type: 'SERVER_ERROR',
        message: 'Failed to blacklist token',
        details: { error: error instanceof Error ? error.message : 'Unknown error' },
      });
    }
  }
}