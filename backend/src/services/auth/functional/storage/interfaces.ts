/**
 * Storage operation interfaces - all side effects are isolated here
 * These interfaces define contracts for data persistence
 */

import type { Result, AsyncResult } from '../types/result';
import type { StorageError } from '../types/errors';
import type {
  UserId,
  Email,
  SessionId,
  HashedPassword,
  PasswordResetToken,
  EmailVerificationToken,
} from '../types/core';
import type {
  SessionData,
  AccountStatus,
  PasswordResetTokenData,
  EmailVerificationTokenData,
  RateLimitData,
} from '../types/auth';

// Password storage operations
export type PasswordStorageOps = {
  readonly store: (userId: UserId, hash: HashedPassword) => AsyncResult<void, StorageError>;
  readonly retrieve: (userId: UserId) => AsyncResult<HashedPassword | null, StorageError>;
  readonly update: (userId: UserId, hash: HashedPassword) => AsyncResult<void, StorageError>;
  readonly delete: (userId: UserId) => AsyncResult<void, StorageError>;
  readonly exists: (userId: UserId) => AsyncResult<boolean, StorageError>;
};

// Session storage operations
export type SessionStorageOps = {
  readonly create: (session: SessionData) => AsyncResult<SessionId, StorageError>;
  readonly get: (sessionId: SessionId) => AsyncResult<SessionData | null, StorageError>;
  readonly update: (
    sessionId: SessionId,
    updates: Partial<SessionData>
  ) => AsyncResult<void, StorageError>;
  readonly delete: (sessionId: SessionId) => AsyncResult<void, StorageError>;
  readonly deleteAll: (userId: UserId) => AsyncResult<number, StorageError>; // returns count of deleted sessions
  readonly findByUserId: (userId: UserId) => AsyncResult<SessionData[], StorageError>;
  readonly findActive: () => AsyncResult<SessionData[], StorageError>;
  readonly cleanupExpired: () => AsyncResult<number, StorageError>; // returns count of cleaned sessions
};

// Token storage operations
export type TokenStorageOps = {
  readonly passwordReset: {
    readonly store: (
      token: PasswordResetToken,
      data: PasswordResetTokenData
    ) => AsyncResult<void, StorageError>;
    readonly get: (
      token: PasswordResetToken
    ) => AsyncResult<PasswordResetTokenData | null, StorageError>;
    readonly markUsed: (token: PasswordResetToken) => AsyncResult<void, StorageError>;
    readonly delete: (token: PasswordResetToken) => AsyncResult<void, StorageError>;
    readonly deleteByUserId: (userId: UserId) => AsyncResult<number, StorageError>;
    readonly cleanupExpired: () => AsyncResult<number, StorageError>;
  };
  readonly emailVerification: {
    readonly store: (
      token: EmailVerificationToken,
      data: EmailVerificationTokenData
    ) => AsyncResult<void, StorageError>;
    readonly get: (
      token: EmailVerificationToken
    ) => AsyncResult<EmailVerificationTokenData | null, StorageError>;
    readonly markUsed: (token: EmailVerificationToken) => AsyncResult<void, StorageError>;
    readonly delete: (token: EmailVerificationToken) => AsyncResult<void, StorageError>;
    readonly deleteByUserId: (userId: UserId) => AsyncResult<number, StorageError>;
    readonly cleanupExpired: () => AsyncResult<number, StorageError>;
  };
};

// Account status storage operations
export type AccountStatusStorageOps = {
  readonly get: (userId: UserId) => AsyncResult<AccountStatus | null, StorageError>;
  readonly update: (
    userId: UserId,
    updates: Partial<AccountStatus>
  ) => AsyncResult<void, StorageError>;
  readonly create: (userId: UserId, status: AccountStatus) => AsyncResult<void, StorageError>;
  readonly delete: (userId: UserId) => AsyncResult<void, StorageError>;
  readonly setEmailVerified: (userId: UserId, verified: boolean) => AsyncResult<void, StorageError>;
  readonly incrementFailedAttempts: (userId: UserId) => AsyncResult<number, StorageError>; // returns new count
  readonly resetFailedAttempts: (userId: UserId) => AsyncResult<void, StorageError>;
  readonly lockAccount: (
    userId: UserId,
    reason: string,
    until?: Date
  ) => AsyncResult<void, StorageError>;
  readonly unlockAccount: (userId: UserId) => AsyncResult<void, StorageError>;
  readonly suspendAccount: (
    userId: UserId,
    reason: string,
    until?: Date
  ) => AsyncResult<void, StorageError>;
  readonly unsuspendAccount: (userId: UserId) => AsyncResult<void, StorageError>;
};

// Rate limiting storage operations
export type RateLimitStorageOps = {
  readonly get: (key: string) => AsyncResult<RateLimitData | null, StorageError>;
  readonly increment: (key: string, windowMs: number) => AsyncResult<RateLimitData, StorageError>;
  readonly reset: (key: string) => AsyncResult<void, StorageError>;
  readonly setLockout: (key: string, until: Date) => AsyncResult<void, StorageError>;
  readonly cleanup: () => AsyncResult<number, StorageError>; // returns count of cleaned entries
};

// Combined storage operations interface
export type StorageOps = {
  readonly password: PasswordStorageOps;
  readonly session: SessionStorageOps;
  readonly token: TokenStorageOps;
  readonly accountStatus: AccountStatusStorageOps;
  readonly rateLimit: RateLimitStorageOps;
};

// Storage configuration
export type StorageConfig = {
  readonly dataDir?: string;
  readonly sessionTTL?: number; // seconds
  readonly tokenTTL?: {
    readonly passwordReset?: number;
    readonly emailVerification?: number;
  };
  readonly cleanupInterval?: number; // milliseconds
  readonly rateLimitWindow?: number; // milliseconds
};
