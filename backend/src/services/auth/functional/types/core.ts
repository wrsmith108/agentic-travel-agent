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
export const isUserId = (value: unknown): value is UserIdType =>
  typeof value === 'string' && value.length > 0;

export const isEmail = (value: unknown): value is EmailType =>
  typeof value === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

export const isSessionId = (value: unknown): value is SessionIdType =>
  typeof value === 'string' && value.length > 0;

// Type constructors (with validation)
export const UserId = (value: string): UserIdType => {
  if (!value || value.trim().length === 0) {
    throw new Error('Invalid UserId: cannot be empty');
  }
  return value as UserIdType;
};

export const Email = (value: string): EmailType => {
  if (!isEmail(value)) {
    throw new Error('Invalid email format');
  }
  return value.toLowerCase() as EmailType;
};

export const SessionId = (value: string): SessionIdType => {
  if (!value || value.trim().length === 0) {
    throw new Error('Invalid SessionId: cannot be empty');
  }
  return value as SessionIdType;
};

export const HashedPassword = (value: string): HashedPasswordType => {
  if (!value || value.length < 20) {
    // Basic check for hash length
    throw new Error('Invalid HashedPassword');
  }
  return value as HashedPasswordType;
};

export const PlainPassword = (value: string): PlainPasswordType => {
  if (!value || value.length < 8) {
    throw new Error('Password must be at least 8 characters');
  }
  return value as PlainPasswordType;
};

export const AccessToken = (value: string): AccessTokenType => {
  if (!value || value.split('.').length !== 3) {
    // Basic JWT format check
    throw new Error('Invalid AccessToken format');
  }
  return value as AccessTokenType;
};

export const RefreshToken = (value: string): RefreshTokenType => {
  if (!value || value.split('.').length !== 3) {
    throw new Error('Invalid RefreshToken format');
  }
  return value as RefreshTokenType;
};

export const Timestamp = (value: string): TimestampType => {
  const date = new Date(value);
  if (isNaN(date.getTime())) {
    throw new Error('Invalid timestamp format');
  }
  return value as TimestampType;
};

export const Duration = (value: number): DurationType => {
  if (value < 0 || !Number.isFinite(value)) {
    throw new Error('Invalid duration: must be non-negative finite number');
  }
  return value as DurationType;
};

// Helper functions for branded types
export const unwrap = <T>(branded: Brand<T, unknown>): T => branded as unknown as T;

// Import branded types from canonical source (not re-exported to avoid conflicts with constructor functions)
import { 
  UserId as UserIdType, 
  Email as EmailType, 
  HashedPassword as HashedPasswordType, 
  PlainPassword as PlainPasswordType, 
  SessionId as SessionIdType, 
  AccessToken as AccessTokenType, 
  RefreshToken as RefreshTokenType, 
  Timestamp as TimestampType, 
  Duration as DurationType 
} from '@/types/brandedTypes';

// Re-export types with their original names for type usage
export type UserId = UserIdType;
export type Email = EmailType;
export type HashedPassword = HashedPasswordType;
export type PlainPassword = PlainPasswordType;
export type SessionId = SessionIdType;
export type AccessToken = AccessTokenType;
export type RefreshToken = RefreshTokenType;
export type Timestamp = TimestampType;
export type Duration = DurationType;
