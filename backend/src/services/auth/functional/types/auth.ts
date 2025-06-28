/**
 * Authentication-specific types and domain models
 */

import type { UserId, Email, SessionId, AccessToken, RefreshToken, Timestamp } from './core';

// User roles
export type UserRole = 'user' | 'admin' | 'moderator';

// Session user data
export type SessionUser = {
  readonly id: UserId;
  readonly email: Email;
  readonly firstName: string;
  readonly lastName: string;
  readonly isEmailVerified: boolean;
  readonly role: UserRole;
  readonly lastLoginAt?: Timestamp;
  readonly createdAt: Timestamp;
};

// Device information for session tracking
export type DeviceInfo = {
  readonly userAgent?: string;
  readonly ipAddress?: string;
  readonly fingerprint?: string;
};

// Session data
export type SessionData = {
  readonly sessionId: SessionId;
  readonly userId: UserId;
  readonly user: SessionUser;
  readonly createdAt: Timestamp;
  readonly expiresAt: Timestamp;
  readonly lastAccessedAt: Timestamp;
  readonly ipAddress?: string;
  readonly userAgent?: string;
  readonly deviceFingerprint?: string;
  readonly isActive: boolean;
  readonly loginMethod: 'email' | 'oauth' | 'sso';
};

// Account status
export type AccountStatus = {
  readonly isEmailVerified: boolean;
  readonly isAccountLocked: boolean;
  readonly isAccountSuspended: boolean;
  readonly lockReason?: string;
  readonly suspensionReason?: string;
  readonly lockedUntil?: Timestamp;
  readonly suspendedUntil?: Timestamp;
  readonly failedLoginAttempts: number;
  readonly lastFailedLoginAt?: Timestamp;
};

// Authentication success response
export type AuthSuccess = {
  readonly user: SessionUser;
  readonly sessionId: SessionId;
  readonly accessToken: AccessToken;
  readonly refreshToken?: RefreshToken;
  readonly expiresAt: Timestamp;
  readonly permissions: readonly string[];
};

// Registration request
export type RegisterRequest = {
  readonly email: Email;
  readonly password: string; // Will be validated and converted to PlainPassword
  readonly firstName: string;
  readonly lastName: string;
  readonly acceptedTerms: boolean;
  readonly marketingConsent?: boolean;
};

// Login request
export type LoginRequest = {
  readonly email: Email;
  readonly password: string;
  readonly rememberMe?: boolean;
  readonly deviceInfo?: DeviceInfo;
};

// Password reset request
export type PasswordResetRequest = {
  readonly email: Email;
};

// Password reset confirmation
export type PasswordResetConfirm = {
  readonly token: string;
  readonly newPassword: string;
};

// Change password request
export type ChangePasswordRequest = {
  readonly currentPassword: string;
  readonly newPassword: string;
};

// Token data structures
export type PasswordResetTokenData = {
  readonly userId: UserId;
  readonly token: string;
  readonly expiresAt: Date;
  readonly createdAt: Date;
  readonly used: boolean;
};

export type EmailVerificationTokenData = {
  readonly userId: UserId;
  readonly token: string;
  readonly email: Email;
  readonly expiresAt: Date;
  readonly createdAt: Date;
  readonly used: boolean;
};

// JWT payload
export type JWTPayload = {
  readonly sub: string; // UserId as string
  readonly email: string; // Email as string
  readonly role: UserRole;
  readonly sessionId: string; // SessionId as string
  readonly iat: number;
  readonly exp: number;
  readonly iss: string;
  readonly aud: string;
};

// Rate limiting data
export type RateLimitData = {
  readonly count: number;
  readonly windowStart: Date;
  readonly lastAttempt: Date;
  readonly lockedUntil?: Date;
};

// Authentication constants
export const AUTH_CONSTANTS = {
  SESSION_DURATION: {
    DEFAULT: 3600, // 1 hour in seconds
    REMEMBER_ME: 2592000, // 30 days in seconds
  },
  TOKEN_EXPIRY: {
    ACCESS_TOKEN: 3600, // 1 hour
    REFRESH_TOKEN: 2592000, // 30 days
    RESET_TOKEN: 3600, // 1 hour
    VERIFICATION_TOKEN: 86400, // 24 hours
  },
  SECURITY: {
    MAX_FAILED_ATTEMPTS: 5,
    LOCKOUT_DURATION: 900, // 15 minutes
    BCRYPT_ROUNDS: 12,
  },
  VALIDATION: {
    MIN_PASSWORD_LENGTH: 8,
    MAX_PASSWORD_LENGTH: 128,
    MIN_NAME_LENGTH: 1,
    MAX_NAME_LENGTH: 50,
  },
} as const;
