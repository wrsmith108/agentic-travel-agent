/**
 * Functional Auth Service - Public API
 *
 * This module provides a functional, type-safe authentication service
 * with branded types and Result-based error handling.
 */

import jwt from 'jsonwebtoken';
import { isOk } from '@/utils/result';
import { logError, logInfo } from '@/utils/logger';
import type {
  AuthTokenPair,
  UserId,
  SessionId,
  Email,
  Timestamp,
} from './types';
import {
  createTimestamp,
  AUTH_CONSTANTS,
} from './types';
import { storage } from './storage';
import {
  register as registerOp,
  login as loginOp,
  logout as logoutOp,
  validateSession as validateSessionOp,
  type RegisterInput,
  type LoginInput,
  type LogoutInput,
  type ValidateSessionInput,
} from './operations';
import type { StorageOps } from './storage/interfaces';

// ============================================================================
// Configuration
// ============================================================================

const JWT_SECRET = process.env.JWT_SECRET || storage.generateFallbackSecret();
const JWT_ISSUER = process.env.JWT_ISSUER || 'travel-agent-api';

// ============================================================================
// Token Management Implementation
// ============================================================================

async function generateTokens(userId: UserId, sessionId: SessionId): Promise<AuthTokenPair> {
  const now = new Date();
  const accessTokenExpiry = new Date(
    now.getTime() + AUTH_CONSTANTS.TOKEN_EXPIRY.ACCESS_TOKEN * 1000
  );
  const refreshTokenExpiry = new Date(
    now.getTime() + AUTH_CONSTANTS.TOKEN_EXPIRY.REFRESH_TOKEN * 1000
  );

  const accessToken = jwt.sign(
    {
      userId,
      sessionId,
      type: 'access',
    },
    JWT_SECRET,
    {
      expiresIn: AUTH_CONSTANTS.TOKEN_EXPIRY.ACCESS_TOKEN,
      issuer: JWT_ISSUER,
      subject: userId,
    }
  ) as any; // Cast to AuthToken

  const refreshToken = jwt.sign(
    {
      userId,
      sessionId,
      type: 'refresh',
    },
    JWT_SECRET,
    {
      expiresIn: AUTH_CONSTANTS.TOKEN_EXPIRY.REFRESH_TOKEN,
      issuer: JWT_ISSUER,
      subject: userId,
    }
  ) as any; // Cast to RefreshToken

  return {
    accessToken,
    refreshToken,
    expiresAt: createTimestamp(accessTokenExpiry),
  };
}

async function revokeTokens(sessionId: SessionId): Promise<void> {
  // In a real implementation, this would add tokens to a blacklist
  // For now, we just log the revocation
  logInfo('Tokens revoked for session', { sessionId });
}

// ============================================================================
// Email Service Implementation
// ============================================================================

async function sendVerificationEmail(email: Email, token: string): Promise<void> {
  // In a real implementation, this would send an actual email
  logInfo('Verification email sent', { email, token });
}

// ============================================================================
// Rate Limiting Implementation
// ============================================================================

async function checkRateLimit(email: Email): Promise<boolean> {
  // Simple in-memory rate limiting
  const key = `login:${email}`;
  const rateLimit = await storageOps.rateLimit.get(key);

  if (!rateLimit.ok) {
    return true; // Allow if we can't check
  }

  if (isOk(rateLimit) && rateLimit.value.lockedUntil) {
    const lockedUntil = new Date(rateLimit.value.lockedUntil);
    if (lockedUntil > new Date()) {
      return false; // Still locked
    }
  }

  const result = await storageOps.rateLimit.increment(
    key,
    AUTH_CONSTANTS.SECURITY.LOCKOUT_DURATION * 1000
  );
  if (!result.ok) {
    return true; // Allow if we can't increment
  }

  if (result.value.count > AUTH_CONSTANTS.SECURITY.MAX_FAILED_ATTEMPTS) {
    await storageOps.rateLimit.setLockout(
      key,
      new Date(Date.now() + AUTH_CONSTANTS.SECURITY.LOCKOUT_DURATION * 1000)
    );
    return false;
  }

  return true;
}

// ============================================================================
// Storage Operations Implementation
// ============================================================================

// Mock implementation of StorageOps
// In a real app, this would be a proper database implementation
const storageOps: StorageOps = {
  password: {
    store: async (userId, hash) => ({ ok: true, value: undefined }),
    retrieve: async (userId) => ({ ok: true, value: null }),
    update: async (userId, hash) => ({ ok: true, value: undefined }),
    delete: async (userId) => ({ ok: true, value: undefined }),
    exists: async (userId) => ({ ok: true, value: false }),
  },
  session: {
    create: async (session) => ({ ok: true, value: session.sessionId }),
    get: async (sessionId) => ({ ok: true, value: null }),
    update: async (sessionId, updates) => ({ ok: true, value: undefined }),
    delete: async (sessionId) => ({ ok: true, value: undefined }),
    deleteAll: async (userId) => ({ ok: true, value: 0 }),
    findByUserId: async (userId) => ({ ok: true, value: [] }),
    findActive: async () => ({ ok: true, value: [] }),
    cleanupExpired: async () => ({ ok: true, value: 0 }),
  },
  token: {
    passwordReset: {
      store: async (token, data) => ({ ok: true, value: undefined }),
      get: async (token) => ({ ok: true, value: null }),
      markUsed: async (token) => ({ ok: true, value: undefined }),
      delete: async (token) => ({ ok: true, value: undefined }),
      deleteByUserId: async (userId) => ({ ok: true, value: 0 }),
      cleanupExpired: async () => ({ ok: true, value: 0 }),
    },
    emailVerification: {
      store: async (token, data) => ({ ok: true, value: undefined }),
      get: async (token) => ({ ok: true, value: null }),
      markUsed: async (token) => ({ ok: true, value: undefined }),
      delete: async (token) => ({ ok: true, value: undefined }),
      deleteByUserId: async (userId) => ({ ok: true, value: 0 }),
      cleanupExpired: async () => ({ ok: true, value: 0 }),
    },
  },
  accountStatus: {
    get: async (userId) => ({ ok: true, value: null }),
    update: async (userId, updates) => ({ ok: true, value: undefined }),
    create: async (userId, status) => ({ ok: true, value: undefined }),
    delete: async (userId) => ({ ok: true, value: undefined }),
    setEmailVerified: async (userId, verified) => ({ ok: true, value: undefined }),
    incrementFailedAttempts: async (userId) => ({ ok: true, value: 1 }),
    resetFailedAttempts: async (userId) => ({ ok: true, value: undefined }),
    lockAccount: async (userId, reason, until) => ({ ok: true, value: undefined }),
    unlockAccount: async (userId) => ({ ok: true, value: undefined }),
    suspendAccount: async (userId, reason, until) => ({ ok: true, value: undefined }),
    unsuspendAccount: async (userId) => ({ ok: true, value: undefined }),
  },
  rateLimit: {
    get: async (key) => ({ ok: true, value: null }),
    increment: async (key, windowMs) => ({
      ok: true,
      value: { count: 1, firstAttempt: new Date(), lockedUntil: null },
    }),
    reset: async (key) => ({ ok: true, value: undefined }),
    setLockout: async (key, until) => ({ ok: true, value: undefined }),
    cleanup: async () => ({ ok: true, value: 0 }),
  },
};

// ============================================================================
// Public API
// ============================================================================

export const authService = {
  /**
   * Register a new user
   */
  register: (input: RegisterInput) =>
    registerOp(input, {
      storage: storageOps,
      generateTokens,
      sendVerificationEmail,
    }),

  /**
   * Login an existing user
   */
  login: (input: LoginInput) =>
    loginOp(input, {
      storage: storageOps,
      generateTokens,
      checkRateLimit,
    }),

  /**
   * Logout a user session
   */
  logout: (input: LogoutInput) =>
    logoutOp(input, {
      storage: storageOps,
      revokeTokens,
    }),

  /**
   * Validate a session
   */
  validateSession: (input: ValidateSessionInput) =>
    validateSessionOp(input, {
      storage: storageOps,
    }),

  /**
   * Cleanup expired sessions and tokens
   */
  cleanup: async () => {
    storage.cleanupExpiredTokens();
    storage.cleanupFailedLoginAttempts();
    await storageOps.session.cleanupExpired();
    await storageOps.token.passwordReset.cleanupExpired();
    await storageOps.token.emailVerification.cleanupExpired();
    await storageOps.rateLimit.cleanup();
  },
};

// Export types for external use
export type {
  Result,
  AuthError,
  UserId,
  SessionId,
  Email,
  HashedPassword,
  AuthToken,
  RefreshToken,
  Timestamp,
  AuthUser,
  AuthSession,
  AuthTokenPair,
} from './types';

export type {
  RegisterInput,
  LoginInput,
  LogoutInput,
  ValidateSessionInput,
} from './operations';

export {
  createUserId,
  createSessionId,
  createEmail,
  createTimestamp,
  validateEmail,
  validateUserId,
  validateSessionId,
} from './types';

// Start periodic cleanup
setInterval(
  () => {
    authService.cleanup().catch((error) => {
      logError('Auth service cleanup failed', error);
    });
  },
  60 * 60 * 1000
); // Every hour
