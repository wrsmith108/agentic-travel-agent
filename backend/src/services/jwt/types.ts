import type { RedisClientType } from 'redis';

export type Result<T, E> =
  | { ok: true; value: T }
  | { ok: false; error: E };

export const ok = <T>(value: T): Result<T, never> => ({
  ok: true,
  value,
});

export const err = <E>(error: E): Result<never, E> => ({
  ok: false,
  error,
});

export type TokenErrorType =
  | 'TOKEN_INVALID'
  | 'TOKEN_EXPIRED'
  | 'TOKEN_BLACKLISTED'
  | 'TOKEN_ROTATION_IN_PROGRESS'
  | 'VALIDATION_ERROR'
  | 'SERVER_ERROR';

export type TokenError = {
  type: TokenErrorType;
  message: string;
  details?: Record<string, unknown>;
};

export type UserRole = 'user' | 'admin' | 'moderator';

export type JWTPayload = {
  userId: string;
  email: string;
  role: UserRole;
  sessionId?: string;
  metadata?: Record<string, unknown>;
};

export type JWTServiceConfig = {
  secret: string;
  refreshSecret: string;
  redisClient: RedisClientType;
  issuer?: string;
  audience?: string;
  accessTokenExpiry?: string;
  refreshTokenExpiry?: string;
  blacklistKeyPrefix?: string;
  rotationLockPrefix?: string;
  maxPayloadSize?: number;
};

export type SignResult = {
  accessToken: string;
  refreshToken: string;
  expiresIn: string;
  tokenType: 'Bearer';
  issuedAt: Date;
  expiresAt: Date;
};

export type VerifyOptions = {
  clockTolerance?: number;
  ignoreExpiration?: boolean;
};

export type DecodedToken = JWTPayload & {
  iat: number;
  exp: number;
  iss: string;
  aud: string;
  jti: string;
  type?: 'access' | 'refresh';
};

export type BlacklistResult = {
  tokenId: string;
  blacklistedAt: Date;
  reason?: string;
};

export type RotationResult = {
  accessToken: string;
  refreshToken: string;
  expiresIn: string;
  tokenType: 'Bearer';
  issuedAt: Date;
  expiresAt: Date;
};