/**
 * Branded types for functional AuthService
 * Using nominal typing patterns for type safety
 */

import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { UserId, SessionId, Email, HashedPassword, AuthToken, RefreshToken, ResetToken, VerificationToken, IPAddress, UserAgent, DeviceFingerprint, Timestamp } from '@/types/brandedTypes';

// ============================================================================
// Brand Symbols - Unique symbols for nominal typing
// ============================================================================

declare const UserIdBrand: unique symbol;
declare const SessionIdBrand: unique symbol;
declare const HashedPasswordBrand: unique symbol;
declare const AuthTokenBrand: unique symbol;
declare const RefreshTokenBrand: unique symbol;
declare const ResetTokenBrand: unique symbol;
declare const VerificationTokenBrand: unique symbol;
declare const EmailBrand: unique symbol;
declare const IPAddressBrand: unique symbol;
declare const UserAgentBrand: unique symbol;
declare const DeviceFingerprintBrand: unique symbol;
declare const TimestampBrand: unique symbol;

// ============================================================================
// Branded Type Definitions
// ============================================================================

// Re-export branded types from central location
export {
  UserId,
  SessionId,
  HashedPassword,
  AuthToken,
  RefreshToken,
  ResetToken,
  VerificationToken,
  Email,
  IPAddress,
  UserAgent,
  DeviceFingerprint,
  Timestamp
} from '@/types/brandedTypes';

// ============================================================================
// Validation Schemas
// ============================================================================

const uuidSchema = z.string().uuid();
const emailSchema = z.string().email().min(5).max(254).toLowerCase().trim();
const ipv4Schema = z.string().regex(/^(\d{1,3}\.){3}\d{1,3}$/);
const ipv6Schema = z.string().regex(/^([\da-fA-F]{1,4}:){7}[\da-fA-F]{1,4}$/);
const timestampSchema = z.string().datetime();
const hexTokenSchema = z.string().regex(/^[a-fA-F0-9]+$/);
const jwtSchema = z.string().regex(/^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+$/);
const bcryptHashSchema = z.string().regex(/^\$2[aby]\$\d{2}\$.{53}$/);

// ============================================================================
// Type Guards
// ============================================================================

export const isUserId = (value: unknown): value is UserId => {
  return typeof value === 'string' && uuidSchema.safeParse(value).success;
};

export const isSessionId = (value: unknown): value is SessionId => {
  return typeof value === 'string' && uuidSchema.safeParse(value).success;
};

export const isHashedPassword = (value: unknown): value is HashedPassword => {
  return typeof value === 'string' && bcryptHashSchema.safeParse(value).success;
};

export const isAuthToken = (value: unknown): value is AuthToken => {
  return typeof value === 'string' && jwtSchema.safeParse(value).success;
};

export const isRefreshToken = (value: unknown): value is RefreshToken => {
  return typeof value === 'string' && jwtSchema.safeParse(value).success;
};

export const isResetToken = (value: unknown): value is ResetToken => {
  return (
    typeof value === 'string' && hexTokenSchema.safeParse(value).success && value.length === 64
  );
};

export const isVerificationToken = (value: unknown): value is VerificationToken => {
  return (
    typeof value === 'string' && hexTokenSchema.safeParse(value).success && value.length === 64
  );
};

export const isEmail = (value: unknown): value is Email => {
  return typeof value === 'string' && emailSchema.safeParse(value).success;
};

export const isIPAddress = (value: unknown): value is IPAddress => {
  return (
    typeof value === 'string' &&
    (ipv4Schema.safeParse(value).success || ipv6Schema.safeParse(value).success)
  );
};

export const isUserAgent = (value: unknown): value is UserAgent => {
  return typeof value === 'string' && value.length > 0 && value.length <= 1000;
};

export const isDeviceFingerprint = (value: unknown): value is DeviceFingerprint => {
  return typeof value === 'string' && value.length > 0 && value.length <= 256;
};

export const isTimestamp = (value: unknown): value is Timestamp => {
  return typeof value === 'string' && timestampSchema.safeParse(value).success;
};

// ============================================================================
// Validators (throw on invalid input)
// ============================================================================

export const validateUserId = (value: unknown): UserId => {
  if (!isUserId(value)) {
    throw new Error(`Invalid UserId: ${value}`);
  }
  return value;
};

export const validateSessionId = (value: unknown): SessionId => {
  if (!isSessionId(value)) {
    throw new Error(`Invalid SessionId: ${value}`);
  }
  return value;
};

export const validateHashedPassword = (value: unknown): HashedPassword => {
  if (!isHashedPassword(value)) {
    throw new Error('Invalid HashedPassword format');
  }
  return value;
};

export const validateAuthToken = (value: unknown): AuthToken => {
  if (!isAuthToken(value)) {
    throw new Error('Invalid AuthToken format');
  }
  return value;
};

export const validateRefreshToken = (value: unknown): RefreshToken => {
  if (!isRefreshToken(value)) {
    throw new Error('Invalid RefreshToken format');
  }
  return value;
};

export const validateResetToken = (value: unknown): ResetToken => {
  if (!isResetToken(value)) {
    throw new Error('Invalid ResetToken format');
  }
  return value;
};

export const validateVerificationToken = (value: unknown): VerificationToken => {
  if (!isVerificationToken(value)) {
    throw new Error('Invalid VerificationToken format');
  }
  return value;
};

export const validateEmail = (value: unknown): Email => {
  if (typeof value !== 'string') {
    throw new Error('Email must be a string');
  }
  const parsed = emailSchema.parse(value);
  return parsed as Email;
};

export const validateIPAddress = (value: unknown): IPAddress => {
  if (!isIPAddress(value)) {
    throw new Error(`Invalid IP address: ${value}`);
  }
  return value;
};

export const validateUserAgent = (value: unknown): UserAgent => {
  if (!isUserAgent(value)) {
    throw new Error('Invalid UserAgent format');
  }
  return value;
};

export const validateDeviceFingerprint = (value: unknown): DeviceFingerprint => {
  if (!isDeviceFingerprint(value)) {
    throw new Error('Invalid DeviceFingerprint format');
  }
  return value;
};

export const validateTimestamp = (value: unknown): Timestamp => {
  if (!isTimestamp(value)) {
    throw new Error(`Invalid Timestamp format: ${value}`);
  }
  return value;
};

// ============================================================================
// Constructors / Factory Functions
// ============================================================================

export const createUserId = (): UserId => {
  return uuidv4() as UserId;
};

export const createSessionId = (): SessionId => {
  return uuidv4() as SessionId;
};

export const createHashedPassword = (hash: string): HashedPassword => {
  return validateHashedPassword(hash);
};

export const createAuthToken = (token: string): AuthToken => {
  return validateAuthToken(token);
};

export const createRefreshToken = (token: string): RefreshToken => {
  return validateRefreshToken(token);
};

export const createResetToken = (token: string): ResetToken => {
  return validateResetToken(token);
};

export const createVerificationToken = (token: string): VerificationToken => {
  return validateVerificationToken(token);
};

export const createEmail = (email: string): Email => {
  return validateEmail(email);
};

export const createIPAddress = (ip: string): IPAddress => {
  return validateIPAddress(ip);
};

export const createUserAgent = (agent: string): UserAgent => {
  return validateUserAgent(agent);
};

export const createDeviceFingerprint = (fingerprint: string): DeviceFingerprint => {
  return validateDeviceFingerprint(fingerprint);
};

export const createTimestamp = (date?: Date): Timestamp => {
  const timestamp = (date || new Date()).toISOString();
  return timestamp as Timestamp;
};

// ============================================================================
// Utility Functions
// ============================================================================

export const timestampToDate = (timestamp: Timestamp): Date => {
  return new Date(timestamp);
};

export const isTimestampExpired = (timestamp: Timestamp): boolean => {
  return timestampToDate(timestamp) < new Date();
};

export const addSecondsToTimestamp = (timestamp: Timestamp, seconds: number): Timestamp => {
  const date = timestampToDate(timestamp);
  date.setSeconds(date.getSeconds() + seconds);
  return createTimestamp(date);
};

export const normalizeEmail = (email: string): Email => {
  return createEmail(email.toLowerCase().trim());
};

// ============================================================================
// Domain Types using Branded Types
// ============================================================================

export interface AuthUser {
  id: UserId;
  email: Email;
  hashedPassword: HashedPassword;
  isEmailVerified: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface AuthSession {
  sessionId: SessionId;
  userId: UserId;
  createdAt: Timestamp;
  expiresAt: Timestamp;
  lastAccessedAt: Timestamp;
  ipAddress?: IPAddress;
  userAgent?: UserAgent;
  deviceFingerprint?: DeviceFingerprint;
}

export interface AuthTokenPair {
  accessToken: AuthToken;
  refreshToken?: RefreshToken;
  expiresAt: Timestamp;
}

export interface PasswordResetTokenData {
  userId: UserId;
  token: ResetToken;
  expiresAt: Timestamp;
  createdAt: Timestamp;
  used: boolean;
}

export interface EmailVerificationTokenData {
  userId: UserId;
  token: VerificationToken;
  email: Email;
  expiresAt: Timestamp;
  createdAt: Timestamp;
  used: boolean;
}

// ============================================================================
// Re-export Result types from utils for convenience
// ============================================================================

export type { Result } from '@/utils/result';

// ============================================================================
// Re-export types from types/index.ts for backward compatibility
// ============================================================================

export type {
  JWTToken,
  SessionStorage,
  SessionCreationOptions,
  SessionCreationResult,
  JWTConfig,
  SessionUser,
  JWTPayload,
  FailedLoginAttempt,
  PasswordStorage,
  TokenStorage,
  FailedAttemptStorage,
  Duration,
  TimeProvider,
  Logger,
  IdGenerator,
  SessionData,
  PasswordResetToken,
  EmailVerificationToken,
  PasswordResetTokenRecord,
  EmailVerificationTokenRecord,
} from './types/index';

// ============================================================================
// Auth Error Types
// ============================================================================

export type AuthError =
  | { type: 'INVALID_CREDENTIALS'; message: string }
  | { type: 'USER_NOT_FOUND'; message: string }
  | { type: 'USER_ALREADY_EXISTS'; message: string }
  | { type: 'EMAIL_NOT_VERIFIED'; message: string }
  | { type: 'ACCOUNT_LOCKED'; message: string; lockedUntil?: Timestamp }
  | { type: 'ACCOUNT_SUSPENDED'; message: string; suspendedUntil?: Timestamp }
  | { type: 'SESSION_EXPIRED'; message: string }
  | { type: 'TOKEN_INVALID'; message: string }
  | { type: 'TOKEN_EXPIRED'; message: string }
  | { type: 'INSUFFICIENT_PERMISSIONS'; message: string }
  | { type: 'RATE_LIMIT_EXCEEDED'; message: string; retryAfter?: number }
  | { type: 'VALIDATION_ERROR'; message: string; details?: unknown }
  | { type: 'SERVER_ERROR'; message: string }
  | { type: 'NETWORK_ERROR'; message: string }
  | { type: 'UNKNOWN_ERROR'; message: string };

// ============================================================================
// Success Response Types
// ============================================================================

export interface AuthSuccess {
  user: {
    id: UserId;
    email: Email;
    firstName: string;
    lastName: string;
    isEmailVerified: boolean;
    role: 'user' | 'admin' | 'moderator';
    createdAt: Timestamp;
  };
  session: {
    sessionId: SessionId;
    expiresAt: Timestamp;
  };
  tokens: AuthTokenPair;
  permissions: string[];
}

// ============================================================================
// Constants
// ============================================================================

export const AUTH_CONSTANTS = {
  SESSION_DURATION: {
    SHORT: 15 * 60, // 15 minutes
    DEFAULT: 60 * 60, // 1 hour
    EXTENDED: 24 * 60 * 60, // 24 hours
    REMEMBER_ME: 30 * 24 * 60 * 60, // 30 days
  },
  TOKEN_EXPIRY: {
    ACCESS_TOKEN: 15 * 60, // 15 minutes
    REFRESH_TOKEN: 7 * 24 * 60 * 60, // 7 days
    RESET_TOKEN: 60 * 60, // 1 hour
    VERIFICATION_TOKEN: 24 * 60 * 60, // 24 hours
  },
  SECURITY: {
    MAX_FAILED_ATTEMPTS: 5,
    LOCKOUT_DURATION: 15 * 60, // 15 minutes
    MIN_PASSWORD_LENGTH: 8,
    MAX_PASSWORD_LENGTH: 128,
  },
} as const;

