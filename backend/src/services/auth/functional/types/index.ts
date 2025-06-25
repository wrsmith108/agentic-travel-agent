/**
 * Functional Auth Service - Type Definitions
 *
 * Branded types and interfaces for type-safe auth operations
 */

import type { z } from 'zod';
import type { UserProfile } from '@/schemas/user';
import type {
  SessionUser,
  SessionData,
  JWTPayload,
  AuthSuccessResponse,
  AuthErrorResponse,
  AccountStatus,
} from '@/schemas/auth';

// ===== Branded Types =====
// These provide compile-time type safety for string IDs

export type UserId = string & { readonly brand: unique symbol };
export type SessionId = string & { readonly brand: unique symbol };
export type Email = string & { readonly brand: unique symbol };
export type HashedPassword = string & { readonly brand: unique symbol };
export type ResetToken = string & { readonly brand: unique symbol };
export type VerificationToken = string & { readonly brand: unique symbol };
export type JWTToken = string & { readonly brand: unique symbol };

// Type guards and constructors
export const UserId = (id: string): UserId => id as UserId;
export const SessionId = (id: string): SessionId => id as SessionId;
export const Email = (email: string): Email => email as Email;
export const HashedPassword = (hash: string): HashedPassword => hash as HashedPassword;
export const ResetToken = (token: string): ResetToken => token as ResetToken;
export const VerificationToken = (token: string): VerificationToken => token as VerificationToken;
export const JWTToken = (token: string): JWTToken => token as JWTToken;

// ===== Token Data Types =====

export interface PasswordResetToken {
  userId: UserId;
  token: ResetToken;
  expiresAt: Date;
  createdAt: Date;
  used: boolean;
}

export interface EmailVerificationToken {
  userId: UserId;
  token: VerificationToken;
  email: Email;
  expiresAt: Date;
  createdAt: Date;
  used: boolean;
}

// ===== Failed Login Tracking =====

export interface FailedLoginAttempt {
  count: number;
  lastAttempt: Date;
  lockedUntil?: Date;
}

// ===== Device Information =====

export interface DeviceInfo {
  userAgent?: string;
  ipAddress?: string;
  fingerprint?: string;
}

// ===== Storage Interfaces =====

export interface SessionStorage {
  [sessionId: string]: SessionData;
}

export interface PasswordStorage {
  get(userId: UserId): Promise<HashedPassword | null>;
  set(userId: UserId, hash: HashedPassword): Promise<void>;
  delete(userId: UserId): Promise<boolean>;
  clear(): Promise<void>;
}

export interface TokenStorage<T> {
  get(token: string): T | undefined;
  set(token: string, data: T): void;
  delete(token: string): boolean;
  clear(): void;
  getAll(): Map<string, T>;
}

export interface FailedAttemptStorage {
  get(email: Email): FailedLoginAttempt | undefined;
  set(email: Email, attempt: FailedLoginAttempt): void;
  delete(email: Email): boolean;
  clear(): void;
}

// ===== Operation Results =====

export type AuthResult = AuthSuccessResponse | AuthErrorResponse;

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

// ===== Session Creation Options =====

export interface SessionCreationOptions {
  user: SessionUser;
  duration?: number;
  deviceInfo?: DeviceInfo;
}

export interface SessionCreationResult {
  sessionId: SessionId;
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

// ===== User Data Manager Interface =====

export interface UserDataManagerOps {
  createUser(data: any): Promise<UserProfile>;
  readUserData(userId: string): Promise<UserProfile | null>;
  updateUserData(userId: string, updates: Partial<UserProfile>): Promise<UserProfile>;
  findUserByEmail(email: string): Promise<UserProfile | null>;
}

// ===== Re-export auth schema types for convenience =====

export type {
  SessionUser,
  SessionData,
  JWTPayload,
  AuthSuccessResponse,
  AuthErrorResponse,
  AccountStatus,
} from '@/schemas/auth';
