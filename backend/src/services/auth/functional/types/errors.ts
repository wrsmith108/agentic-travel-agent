/**
 * Error types using discriminated unions for type-safe error handling
 */

import type { Email, UserId, Timestamp } from './core';

// Base error type
export type BaseError = {
  readonly requestId: string;
  readonly timestamp: Timestamp;
};

// Authentication error types
export type AuthError = BaseError &
  (
    | { readonly type: 'INVALID_CREDENTIALS'; readonly message: string }
    | { readonly type: 'USER_NOT_FOUND'; readonly message: string; readonly email: Email }
    | { readonly type: 'USER_ALREADY_EXISTS'; readonly message: string; readonly email: Email }
    | { readonly type: 'EMAIL_NOT_VERIFIED'; readonly message: string; readonly userId: UserId }
    | {
        readonly type: 'ACCOUNT_LOCKED';
        readonly message: string;
        readonly lockedUntil?: Timestamp;
      }
    | {
        readonly type: 'ACCOUNT_SUSPENDED';
        readonly message: string;
        readonly suspendedUntil?: Timestamp;
      }
    | {
        readonly type: 'RATE_LIMIT_EXCEEDED';
        readonly message: string;
        readonly retryAfter: number;
      }
    | { readonly type: 'TOKEN_INVALID'; readonly message: string }
    | { readonly type: 'TOKEN_EXPIRED'; readonly message: string }
    | { readonly type: 'SESSION_INVALID'; readonly message: string }
    | { readonly type: 'SESSION_EXPIRED'; readonly message: string }
    | {
        readonly type: 'INSUFFICIENT_PERMISSIONS';
        readonly message: string;
        readonly required: string[];
      }
  );

// Validation error types
export type ValidationError = BaseError & {
  readonly type: 'VALIDATION_ERROR';
  readonly message: string;
  readonly errors: readonly ValidationFieldError[];
};

export type ValidationFieldError = {
  readonly field: string;
  readonly message: string;
  readonly code: string;
};

// Storage error types
export type StorageError = BaseError &
  (
    | { readonly type: 'STORAGE_READ_ERROR'; readonly message: string; readonly resource: string }
    | { readonly type: 'STORAGE_WRITE_ERROR'; readonly message: string; readonly resource: string }
    | { readonly type: 'STORAGE_DELETE_ERROR'; readonly message: string; readonly resource: string }
    | { readonly type: 'STORAGE_CONNECTION_ERROR'; readonly message: string }
  );

// Security error types
export type SecurityError = BaseError &
  (
    | { readonly type: 'HASHING_ERROR'; readonly message: string }
    | { readonly type: 'TOKEN_GENERATION_ERROR'; readonly message: string }
    | { readonly type: 'ENCRYPTION_ERROR'; readonly message: string }
    | { readonly type: 'DECRYPTION_ERROR'; readonly message: string }
  );

// System error types
export type SystemError = BaseError & {
  readonly type: 'SYSTEM_ERROR';
  readonly message: string;
  readonly code: string;
  readonly stack?: string;
};

// Combined error type
export type AppError = AuthError | ValidationError | StorageError | SecurityError | SystemError;

// Error constructors
export const createAuthError = (
  type: AuthError['type'],
  message: string,
  requestId: string,
  additionalProps?: Partial<AuthError>
): AuthError =>
  ({
    type,
    message,
    requestId,
    timestamp: new Date().toISOString() as Timestamp,
    ...additionalProps,
  }) as AuthError;

export const createValidationError = (
  message: string,
  errors: readonly ValidationFieldError[],
  requestId: string
): ValidationError => ({
  type: 'VALIDATION_ERROR',
  message,
  errors,
  requestId,
  timestamp: new Date().toISOString() as Timestamp,
});

export const createStorageError = (
  type: StorageError['type'],
  message: string,
  resource: string,
  requestId: string
): StorageError =>
  ({
    type,
    message,
    resource,
    requestId,
    timestamp: new Date().toISOString() as Timestamp,
  }) as StorageError;

export const createSecurityError = (
  type: SecurityError['type'],
  message: string,
  requestId: string
): SecurityError =>
  ({
    type,
    message,
    requestId,
    timestamp: new Date().toISOString() as Timestamp,
  }) as SecurityError;

export const createSystemError = (
  message: string,
  code: string,
  requestId: string,
  stack?: string
): SystemError => ({
  type: 'SYSTEM_ERROR',
  message,
  code,
  requestId,
  timestamp: new Date().toISOString() as Timestamp,
  ...(stack !== undefined && { stack }),
});

// Type guards
export const isAuthError = (error: AppError): error is AuthError =>
  'type' in error &&
  [
    'INVALID_CREDENTIALS',
    'USER_NOT_FOUND',
    'USER_ALREADY_EXISTS',
    'EMAIL_NOT_VERIFIED',
    'ACCOUNT_LOCKED',
    'ACCOUNT_SUSPENDED',
    'RATE_LIMIT_EXCEEDED',
    'TOKEN_INVALID',
    'TOKEN_EXPIRED',
    'SESSION_INVALID',
    'SESSION_EXPIRED',
    'INSUFFICIENT_PERMISSIONS',
  ].includes(error.type as string);

export const isValidationError = (error: AppError): error is ValidationError =>
  error.type === 'VALIDATION_ERROR';

export const isStorageError = (error: AppError): error is StorageError =>
  'type' in error &&
  [
    'STORAGE_READ_ERROR',
    'STORAGE_WRITE_ERROR',
    'STORAGE_DELETE_ERROR',
    'STORAGE_CONNECTION_ERROR',
  ].includes(error.type as string);

export const isSecurityError = (error: AppError): error is SecurityError =>
  'type' in error &&
  ['HASHING_ERROR', 'TOKEN_GENERATION_ERROR', 'ENCRYPTION_ERROR', 'DECRYPTION_ERROR'].includes(
    error.type as string
  );

export const isSystemError = (error: AppError): error is SystemError =>
  error.type === 'SYSTEM_ERROR';

// Error code mapping for HTTP status codes
export const getHttpStatusFromError = (error: AppError): number => {
  if (isAuthError(error)) {
    switch (error.type) {
      case 'INVALID_CREDENTIALS':
      case 'USER_NOT_FOUND':
        return 401;
      case 'USER_ALREADY_EXISTS':
        return 409;
      case 'EMAIL_NOT_VERIFIED':
      case 'ACCOUNT_LOCKED':
      case 'ACCOUNT_SUSPENDED':
      case 'INSUFFICIENT_PERMISSIONS':
        return 403;
      case 'RATE_LIMIT_EXCEEDED':
        return 429;
      case 'TOKEN_INVALID':
      case 'TOKEN_EXPIRED':
      case 'SESSION_INVALID':
      case 'SESSION_EXPIRED':
        return 401;
      default:
        return 500;
    }
  }

  if (isValidationError(error)) return 400;
  if (isStorageError(error)) return 503;
  if (isSecurityError(error)) return 500;
  if (isSystemError(error)) return 500;

  return 500;
};
