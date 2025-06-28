/**
 * Functional Auth Service - Type Definitions
 *
 * Comprehensive type exports for the functional auth system
 */

import type { z } from 'zod';

// Import types for use in interface definitions
import type {
  UserId as CoreUserId,
  Email as CoreEmail,
  HashedPassword as CoreHashedPassword,
  SessionId as CoreSessionId,
  Timestamp as CoreTimestamp,
} from './core';

import type {
  SessionUser as AuthSessionUser,
  SessionData as AuthSessionData,
  DeviceInfo as AuthDeviceInfo,
} from './auth';

// ===== Re-export Result types and utilities =====
export type { Result, Ok, Err, AsyncResult, OkType, ErrType } from './result';
export { ok, err, isOk, isErr, map, mapErr, flatMap, flatMapErr, unwrap, unwrapOr } from './result';

// ===== Re-export core branded types and constructors =====
// Note: Constructor functions also provide the types
export {
  UserId,
  Email,
  HashedPassword,
  PlainPassword,
  SessionId,
  AccessToken,
  RefreshToken,
  Timestamp,
  Duration,
} from './core';

// Re-export specific types with aliases to avoid conflicts
export type {
  PasswordResetToken as PasswordResetTokenBranded,
  EmailVerificationToken as EmailVerificationTokenBranded,
} from './core';

// ===== Re-export error types =====
export type {
  AuthError,
  ValidationError,
  StorageError,
  SecurityError,
  SystemError,
  AppError,
  BaseError,
  ValidationFieldError,
} from './errors';

// ===== Re-export auth domain types =====
export type {
  UserRole,
  SessionUser,
  DeviceInfo,
  SessionData,
  AccountStatus,
  AuthSuccess,
  RegisterRequest,
  LoginRequest,
  PasswordResetRequest,
  PasswordResetConfirm,
  ChangePasswordRequest,
  PasswordResetTokenData,
  EmailVerificationTokenData,
  JWTPayload,
  RateLimitData,
} from './auth';

export { AUTH_CONSTANTS } from './auth';

// ===== Additional Branded Types (not in core.ts) =====
export type JWTToken = string & { readonly brand: unique symbol };
export type VerificationToken = string & { readonly brand: unique symbol };
export type ResetToken = string & { readonly brand: unique symbol };
export type RequestId = string & { readonly brand: unique symbol };

// Constructors for additional branded types
export const JWTToken = (token: string): JWTToken => token as JWTToken;
export const VerificationToken = (token: string): VerificationToken => token as VerificationToken;
export const ResetToken = (token: string): ResetToken => token as ResetToken;
export const RequestId = (id: string): RequestId => id as RequestId;

// ===== Token Record Types (for storage) =====
export interface PasswordResetToken {
  userId: CoreUserId;
  token: ResetToken;
  expiresAt: Date;
  createdAt: Date;
  used: boolean;
}

export interface EmailVerificationToken {
  userId: CoreUserId;
  token: VerificationToken;
  email: CoreEmail;
  expiresAt: Date;
  createdAt: Date;
  used: boolean;
}

// Aliases for compatibility
export type PasswordResetTokenRecord = PasswordResetToken;
export type EmailVerificationTokenRecord = EmailVerificationToken;

// ===== Failed Login Tracking =====
export interface FailedLoginAttempt {
  count: number;
  lastAttempt: Date;
  lockedUntil?: Date;
}

// ===== Storage Interfaces =====
export interface SessionStorage {
  [sessionId: string]: AuthSessionData;
}

export interface PasswordStorage {
  get(userId: CoreUserId): Promise<CoreHashedPassword | null>;
  set(userId: CoreUserId, hash: CoreHashedPassword): Promise<void>;
  delete(userId: CoreUserId): Promise<boolean>;
  clear(): Promise<void>;
}

export interface TokenStorage<T> {
  get(token: string): Promise<T | null>;
  set(token: string, data: T): Promise<void>;
  delete(token: string): Promise<boolean>;
  clear(): Promise<void>;
  getAll(): Promise<Map<string, T>>;
  store(token: string, data: T): Promise<void>; // Alias for set
  retrieve(token: string): Promise<T | null>; // Alias for get
}

export interface FailedAttemptStorage {
  get(email: CoreEmail): FailedLoginAttempt | undefined;
  set(email: CoreEmail, attempt: FailedLoginAttempt): void;
  delete(email: CoreEmail): boolean;
  clear(): void;
}

// ===== Session Management =====
export interface SessionCreationOptions {
  user: AuthSessionUser;
  duration?: number;
  deviceInfo?: AuthDeviceInfo;
}

export interface SessionCreationResult {
  sessionId: CoreSessionId;
  accessToken: JWTToken;
  refreshToken?: JWTToken;
  expiresAt: string;
}

// ===== JWT Configuration =====
export interface JWTConfig {
  secret: string;
  refreshSecret: string;
  issuer: string;
  audience: string;
}

// ===== External Dependencies =====
export interface Logger {
  info(message: string, meta?: any): void;
  error(message: string, error?: any, meta?: any): void;
  warn(message: string, meta?: any): void;
  debug(message: string, meta?: any): void;
}

export interface IdGenerator {
  generateId(): string;
  generateRequestId(): string;
}

export interface TimeProvider {
  now(): Date;
  timestamp(): CoreTimestamp;
}

// ===== Operation Results =====
export interface PasswordResetResult {
  success: boolean;
  message: string;
  token?: string; // Only in dev/test environments
}

export interface PasswordChangeResult {
  success: boolean;
  message: string;
}

export interface LogoutResult {
  success: boolean;
  message: string;
}

// ===== Rate Limiting =====
export interface RateLimitResult {
  allowed: boolean;
  lockedUntil?: Date;
}

// ===== Auth Service Configuration =====
export interface AuthServiceConfig {
  jwtSecret?: string;
  jwtRefreshSecret?: string;
  requireEmailVerification?: boolean;
  sessionDuration?: {
    default: number;
    rememberMe: number;
  };
  security?: {
    maxFailedAttempts: number;
    lockoutDuration: number;
  };
  tokenExpiry?: {
    verification: number;
    passwordReset: number;
    refresh: number;
  };
}

// ===== Validation Results =====
export interface ValidationResult<T> {
  success: boolean;
  data?: T;
  error?: z.ZodError;
}
// Re-export operation types
export type {
  RegisterInput,
  LoginInput,
  LogoutInput,
  ValidateSessionInput,
  AuthSuccess,
} from '../operations';
