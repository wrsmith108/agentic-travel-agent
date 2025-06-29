/**
 * Pure functions for JWT and token management
 */

import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import type {
  UserId,
  Email,
  SessionId,
  JWTToken,
  RefreshToken,
  VerificationToken,
  ResetToken,
  Duration,
  Timestamp,
} from './types';
import {
  JWTToken as createJWTToken,
  RefreshToken as createRefreshToken,
  VerificationToken as createVerificationToken,
} from './types';
import type {
  Result,
  AuthError,
  JWTPayload,
  TokenStorage,
  EmailVerificationTokenRecord,
  TimeProvider,
  Logger,
} from './types';
import { ok, err, isOk } from '@/utils/result';;
import { AUTH_CONSTANTS } from '@/schemas/auth';

/**
 * Generate a JWT token
 */
export const generateJWT = (
  payload: JWTPayload,
  secret: string,
  expiresIn?: Duration
): Result<JWTToken, AuthError> => {
  try {
    const options: jwt.SignOptions = {};
    if (expiresIn !== undefined) {
      options.expiresIn = expiresIn;
    }

    const token = jwt.sign(payload, secret, options);
    return ok(createJWTToken(token));
  } catch (error) {
    return err({
      type: 'SERVER_ERROR',
      message: 'Failed to generate JWT token',
      details: { error: error instanceof Error ? error.message : 'Unknown error' },
    });
  }
};

/**
 * Verify and decode a JWT token
 */
export const verifyJWT = (token: JWTToken, secret: string): Result<JWTPayload, AuthError> => {
  try {
    const payload = jwt.verify(token, secret) as JWTPayload;
    return ok(payload);
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      if (error.name === 'TokenExpiredError') {
        return err({
          type: 'TOKEN_EXPIRED',
          message: 'JWT token has expired',
        });
      }
      return err({
        type: 'TOKEN_INVALID',
        message: 'Invalid JWT token',
        details: { error: error.message },
      });
    }
    return err({
      type: 'SERVER_ERROR',
      message: 'Failed to verify JWT token',
      details: { error: error instanceof Error ? error.message : 'Unknown error' },
    });
  }
};

/**
 * Create access and refresh tokens for a session
 */
export const createSessionTokens = (
  deps: {
    timeProvider: TimeProvider;
    crypto: { jwtSecret: string; jwtRefreshSecret: string };
  },
  userId: UserId,
  email: Email,
  role: 'user' | 'admin' | 'moderator',
  sessionId: SessionId,
  rememberMe: boolean = false
): Result<
  {
    accessToken: JWTToken;
    refreshToken?: RefreshToken;
    expiresAt: Timestamp;
  },
  AuthError
> => {
  const { timeProvider, crypto } = deps;
  const now = timeProvider.now();
  const nowSeconds = Math.floor(now.getTime() / 1000);

  // Determine session duration
  const sessionDuration = rememberMe
    ? AUTH_CONSTANTS.SESSION_DURATION.REMEMBER_ME
    : AUTH_CONSTANTS.SESSION_DURATION.DEFAULT;

  const expiresAt = new Date(now.getTime() + sessionDuration * 1000);
  const expiresAtSeconds = Math.floor(expiresAt.getTime() / 1000);

  // Create JWT payload
  const jwtPayload: JWTPayload = {
    sub: userId,
    email,
    role,
    sessionId,
    iat: nowSeconds,
    exp: expiresAtSeconds,
    iss: 'agentic-travel-agent',
    aud: 'agentic-travel-agent-users',
  };

  // Generate access token
  const accessTokenResult = generateJWT(jwtPayload, crypto.jwtSecret);
  if (isErr(accessTokenResult)) {
    return err(accessTokenResult.error);
  }

  const result: {
    accessToken: JWTToken;
    refreshToken?: RefreshToken;
    expiresAt: Timestamp;
  } = {
    accessToken: accessTokenResult.value,
    expiresAt: timeProvider.timestamp(),
  };

  // Generate refresh token for longer sessions
  if (sessionDuration > AUTH_CONSTANTS.SESSION_DURATION.DEFAULT) {
    const refreshPayload = { ...jwtPayload, type: 'refresh' };
    const refreshTokenResult = generateJWT(
      refreshPayload,
      crypto.jwtRefreshSecret,
      AUTH_CONSTANTS.TOKEN_EXPIRY.REFRESH_TOKEN
    );

    if (isErr(refreshTokenResult)) {
      return err(refreshTokenResult.error);
    }

    result.refreshToken = createRefreshToken(refreshTokenResult.value);
  }

  return ok(result);
};

/**
 * Generate an email verification token
 */
export const generateVerificationToken = (): Result<VerificationToken, AuthError> => {
  try {
    const token = crypto.randomBytes(32).toString('hex');
    return ok(createVerificationToken(token));
  } catch (error) {
    return err({
      type: 'SERVER_ERROR',
      message: 'Failed to generate verification token',
      details: { error: error instanceof Error ? error.message : 'Unknown error' },
    });
  }
};

/**
 * Create and store an email verification token
 */
export const createEmailVerificationToken = async (
  deps: {
    tokenStorage: TokenStorage<EmailVerificationTokenRecord>;
    timeProvider: TimeProvider;
    logger: Logger;
  },
  userId: UserId,
  email: Email
): Promise<Result<VerificationToken, AuthError>> => {
  const { tokenStorage, timeProvider, logger } = deps;

  try {
    // Generate token
    const tokenResult = generateVerificationToken();
    if (isErr(tokenResult)) {
      return err(tokenResult.error);
    }

    const token = isOk(tokenResult) ? tokenResult.value : null;
    const now = timeProvider.now();
    const expiresAt = new Date(
      now.getTime() + AUTH_CONSTANTS.TOKEN_EXPIRY.VERIFICATION_TOKEN * 1000
    );

    // Store token
    const tokenRecord: EmailVerificationTokenRecord = {
      type: 'email_verification',
      userId,
      token,
      email,
      expiresAt,
      createdAt: now,
      used: false,
    };

    await tokenStorage.store(token, tokenRecord);

    logger.info('Email verification token generated', {
      userId,
      email,
      tokenExpiry: expiresAt,
    });

    return ok(token);
  } catch (error) {
    logger.error('Failed to create email verification token', error, { userId, email });
    return err({
      type: 'SERVER_ERROR',
      message: 'Failed to create email verification token',
      details: { error: error instanceof Error ? error.message : 'Unknown error' },
    });
  }
};

/**
 * Validate an email verification token
 */
export const validateVerificationToken = async (
  deps: {
    tokenStorage: TokenStorage<EmailVerificationTokenRecord>;
    timeProvider: TimeProvider;
  },
  token: VerificationToken
): Promise<Result<{ userId: UserId; email: Email }, AuthError>> => {
  const { tokenStorage, timeProvider } = deps;

  try {
    const tokenRecord = await tokenStorage.retrieve(token);

    if (!tokenRecord) {
      return err({
        type: 'TOKEN_INVALID',
        message: 'Invalid verification token',
      });
    }

    if (tokenRecord.used) {
      return err({
        type: 'TOKEN_INVALID',
        message: 'Verification token has already been used',
      });
    }

    if (tokenRecord.expiresAt < timeProvider.now()) {
      return err({
        type: 'TOKEN_EXPIRED',
        message: 'Verification token has expired',
      });
    }

    return ok({ userId: tokenRecord.userId, email: tokenRecord.email });
  } catch (error) {
    return err({
      type: 'SERVER_ERROR',
      message: 'Failed to validate verification token',
      details: { error: error instanceof Error ? error.message : 'Unknown error' },
    });
  }
};

/**
 * Refresh an access token using a refresh token
 */
export const refreshAccessToken = async (
  deps: {
    crypto: { jwtSecret: string; jwtRefreshSecret: string };
    timeProvider: TimeProvider;
    sessionValidator: (sessionId: SessionId) => Promise<boolean>;
  },
  refreshToken: RefreshToken
): Promise<Result<{ accessToken: JWTToken; expiresAt: Timestamp }, AuthError>> => {
  const { crypto, timeProvider, sessionValidator } = deps;

  // Verify refresh token
  const verifyResult = verifyJWT(createJWTToken(refreshToken), crypto.jwtRefreshSecret);
  if (isErr(verifyResult)) {
    return err(verifyResult.error);
  }

  const payload = isOk(verifyResult) ? verifyResult.value : null;

  // Validate session still exists
  const isValidSession = await sessionValidator(payload.sessionId);
  if (!isValidSession) {
    return err({
      type: 'SESSION_EXPIRED',
      message: 'Session no longer exists',
    });
  }

  // Generate new access token
  const now = timeProvider.now();
  const nowSeconds = Math.floor(now.getTime() / 1000);
  const expiresAt = new Date(now.getTime() + AUTH_CONSTANTS.TOKEN_EXPIRY.ACCESS_TOKEN * 1000);
  const expiresAtSeconds = Math.floor(expiresAt.getTime() / 1000);

  const newPayload: JWTPayload = {
    ...payload,
    iat: nowSeconds,
    exp: expiresAtSeconds,
  };

  const accessTokenResult = generateJWT(newPayload, crypto.jwtSecret);
  if (isErr(accessTokenResult)) {
    return err(accessTokenResult.error);
  }

  return ok({
    accessToken: accessTokenResult.value,
    expiresAt: timeProvider.timestamp(),
  });
};

/**
 * Decode a JWT token without verification (for inspection)
 */
export const decodeJWT = (token: JWTToken): Result<JWTPayload, AuthError> => {
  try {
    const decoded = jwt.decode(token) as JWTPayload | null;
    if (!decoded) {
      return err({
        type: 'TOKEN_INVALID',
        message: 'Failed to decode JWT token',
      });
    }
    return ok(decoded);
  } catch (error) {
    return err({
      type: 'TOKEN_INVALID',
      message: 'Invalid JWT token format',
      details: { error: error instanceof Error ? error.message : 'Unknown error' },
    });
  }
};
