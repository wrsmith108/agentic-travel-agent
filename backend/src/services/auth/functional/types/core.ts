/**
 * Core domain types with branded types for type safety
 * These types ensure compile-time safety and prevent primitive obsession
 */

// Branded type helper
type Brand<K, T> = K & { readonly __brand: T };

// User-related branded types
// Removed - using @/types/brandedTypes: export type UserId = Brand<string, 'UserId'>;
// Removed - using @/types/brandedTypes: export type Email = Brand<string, 'Email'>;
// Removed - using @/types/brandedTypes: export type HashedPassword = Brand<string, 'HashedPassword'>;
// Removed - using @/types/brandedTypes: export type PlainPassword = Brand<string, 'PlainPassword'>;

// Session-related branded types
// Removed - using @/types/brandedTypes: export type SessionId = Brand<string, 'SessionId'>;
// Removed - using @/types/brandedTypes: export type AccessToken = Brand<string, 'AccessToken'>;
// Removed - using @/types/brandedTypes: export type RefreshToken = Brand<string, 'RefreshToken'>;

// Token-related branded types
export type PasswordResetToken = Brand<string, 'PasswordResetToken'>;
export type EmailVerificationToken = Brand<string, 'EmailVerificationToken'>;

// Time-related branded types
// Removed - using @/types/brandedTypes: export type Timestamp = Brand<string, 'Timestamp'>; // ISO 8601 format
// Removed - using @/types/brandedTypes: export type Duration = Brand<number, 'Duration'>; // seconds

// Type guards
export const isUserId = (value: unknown): value is UserId =>
  typeof value === 'string' && value.length > 0;

export const isEmail = (value: unknown): value is Email =>
  typeof value === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

export const isSessionId = (value: unknown): value is SessionId =>
  typeof value === 'string' && value.length > 0;

// Type constructors (with validation)
export const UserId = (value: string): UserId => {
  if (!value || value.trim().length === 0) {
    throw new Error('Invalid UserId: cannot be empty');
  }
  return value as UserId;
};

export const Email = (value: string): Email => {
  if (!isEmail(value)) {
    throw new Error('Invalid email format');
  }
  return value.toLowerCase() as Email;
};

export const SessionId = (value: string): SessionId => {
  if (!value || value.trim().length === 0) {
    throw new Error('Invalid SessionId: cannot be empty');
  }
  return value as SessionId;
};

export const HashedPassword = (value: string): HashedPassword => {
  if (!value || value.length < 20) {
    // Basic check for hash length
    throw new Error('Invalid HashedPassword');
  }
  return value as HashedPassword;
};

export const PlainPassword = (value: string): PlainPassword => {
  if (!value || value.length < 8) {
    throw new Error('Password must be at least 8 characters');
  }
  return value as PlainPassword;
};

export const AccessToken = (value: string): AccessToken => {
  if (!value || value.split('.').length !== 3) {
    // Basic JWT format check
    throw new Error('Invalid AccessToken format');
  }
  return value as AccessToken;
};

export const RefreshToken = (value: string): RefreshToken => {
  if (!value || value.split('.').length !== 3) {
    throw new Error('Invalid RefreshToken format');
  }
  return value as RefreshToken;
};

export const Timestamp = (value: string): Timestamp => {
  const date = new Date(value);
  if (isNaN(date.getTime())) {
    throw new Error('Invalid timestamp format');
  }
  return value as Timestamp;
};

export const Duration = (value: number): Duration => {
  if (value < 0 || !Number.isFinite(value)) {
    throw new Error('Invalid duration: must be non-negative finite number');
  }
  return value as Duration;
};

// Helper functions for branded types
export const unwrap = <T>(branded: Brand<T, unknown>): T => branded as unknown as T;

// Re-export branded types from canonical source
export { UserId, Email, HashedPassword, PlainPassword, SessionId, AccessToken, RefreshToken, Timestamp, Duration } from '@/types/brandedTypes';
