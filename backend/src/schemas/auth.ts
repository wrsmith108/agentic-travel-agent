import { z } from 'zod';

/**
 * Password validation schema with comprehensive security requirements
 */
export const PasswordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters long')
  .max(128, 'Password must not exceed 128 characters')
  .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[0-9]/, 'Password must contain at least one number')
  .regex(/[^a-zA-Z0-9]/, 'Password must contain at least one special character');

/**
 * Email validation schema with normalization
 */
export const EmailSchema = z
  .string()
  .email('Must be a valid email address')
  .min(5, 'Email must be at least 5 characters')
  .max(254, 'Email must not exceed 254 characters')
  .toLowerCase()
  .trim();

/**
 * User registration request schema
 */
export const RegisterRequestSchema = z
  .object({
    firstName: z
      .string()
      .min(1, 'First name is required')
      .max(50, 'First name must not exceed 50 characters')
      .trim(),
    lastName: z
      .string()
      .min(1, 'Last name is required')
      .max(50, 'Last name must not exceed 50 characters')
      .trim(),
    email: EmailSchema,
    password: PasswordSchema,
    confirmPassword: z.string(),
    acceptTerms: z.boolean().refine((val) => val === true, {
      message: 'You must accept the terms and conditions',
    }),
    marketingOptIn: z.boolean().default(false),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

/**
 * User login request schema
 */
export const LoginRequestSchema = z.object({
  email: EmailSchema,
  password: z.string().min(1, 'Password is required'),
  rememberMe: z.boolean().default(false),
  deviceInfo: z
    .object({
      userAgent: z.string().optional(),
      ipAddress: z.string().optional(),
      fingerprint: z.string().optional(),
    })
    .optional(),
});

/**
 * Password reset request schema
 */
export const PasswordResetRequestSchema = z.object({
  email: EmailSchema,
});

/**
 * Password reset confirmation schema
 */
export const PasswordResetConfirmSchema = z
  .object({
    token: z.string().min(1, 'Reset token is required'),
    newPassword: PasswordSchema,
    confirmPassword: z.string(),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

/**
 * Change password schema (for authenticated users)
 */
export const ChangePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Current password is required'),
    newPassword: PasswordSchema,
    confirmPassword: z.string(),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

/**
 * Email verification schema
 */
export const EmailVerificationSchema = z.object({
  token: z.string().min(1, 'Verification token is required'),
});

/**
 * Session user interface (minimal user data for sessions)
 */
export const SessionUserSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  firstName: z.string(),
  lastName: z.string(),
  emailVerified: z.boolean().default(false),
  role: z.enum(['user', 'admin', 'moderator']).default('user'),
  lastLoginAt: z.string().datetime().optional(),
  createdAt: z.string().datetime(),
});

/**
 * Session data schema
 */
export const SessionDataSchema = z.object({
  sessionId: z.string().uuid(),
  userId: z.string().uuid(),
  user: SessionUserSchema,
  createdAt: z.string().datetime(),
  expiresAt: z.string().datetime(),
  lastAccessedAt: z.string().datetime(),
  ipAddress: z.string().optional(),
  userAgent: z.string().optional(),
  deviceFingerprint: z.string().optional(),
  isActive: z.boolean().default(true),
  loginMethod: z.enum(['email', 'oauth', 'sso']).default('email'),
});

/**
 * JWT payload schema
 */
export const JWTPayloadSchema = z.object({
  sub: z.string().uuid(), // userId
  email: z.string().email(),
  role: z.enum(['user', 'admin', 'moderator']).default('user'),
  sessionId: z.string().uuid(),
  iat: z.number(),
  exp: z.number(),
  iss: z.string(),
  aud: z.string(),
});

/**
 * Auth response schema for successful authentication
 */
export const AuthSuccessResponseSchema = z.object({
  success: z.literal(true),
  message: z.string(),
  data: z.object({
    user: SessionUserSchema,
    sessionId: z.string().uuid(),
    accessToken: z.string(),
    refreshToken: z.string().optional(),
    expiresAt: z.string().datetime(),
    permissions: z.array(z.string()).default([]),
  }),
});

/**
 * Auth error types enum
 */
export const AuthErrorTypeSchema = z.enum([
  'INVALID_CREDENTIALS',
  'USER_NOT_FOUND',
  'USER_ALREADY_EXISTS',
  'EMAIL_NOT_VERIFIED',
  'ACCOUNT_LOCKED',
  'ACCOUNT_SUSPENDED',
  'SESSION_EXPIRED',
  'TOKEN_INVALID',
  'TOKEN_EXPIRED',
  'INSUFFICIENT_PERMISSIONS',
  'RATE_LIMIT_EXCEEDED',
  'VALIDATION_ERROR',
  'SERVER_ERROR',
  'NETWORK_ERROR',
  'UNKNOWN_ERROR',
]);

/**
 * Auth error response schema
 */
export const AuthErrorResponseSchema = z.object({
  success: z.literal(false),
  error: z.object({
    type: AuthErrorTypeSchema,
    message: z.string(),
    details: z.record(z.unknown()).optional(),
    code: z.string().optional(),
    timestamp: z.string().datetime(),
    requestId: z.string().uuid().optional(),
  }),
});

/**
 * Generic auth response schema (success or error)
 */
export const AuthResponseSchema = z.union([AuthSuccessResponseSchema, AuthErrorResponseSchema]);

/**
 * Token refresh request schema
 */
export const TokenRefreshRequestSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
});

/**
 * Logout request schema
 */
export const LogoutRequestSchema = z.object({
  sessionId: z.string().uuid().optional(),
  logoutAllSessions: z.boolean().default(false),
});

/**
 * Account verification status schema
 */
export const AccountStatusSchema = z.object({
  isEmailVerified: z.boolean(),
  isAccountLocked: z.boolean(),
  isAccountSuspended: z.boolean(),
  lockReason: z.string().optional(),
  suspensionReason: z.string().optional(),
  lockedUntil: z.string().datetime().optional(),
  suspendedUntil: z.string().datetime().optional(),
  failedLoginAttempts: z.number().int().min(0).default(0),
  lastFailedLoginAt: z.string().datetime().optional(),
});

/**
 * User security settings schema
 */
export const SecuritySettingsSchema = z.object({
  twoFactorEnabled: z.boolean().default(false),
  backupCodesGenerated: z.boolean().default(false),
  loginNotifications: z.boolean().default(true),
  suspiciousActivityAlerts: z.boolean().default(true),
  sessionTimeout: z.number().int().min(300).max(86400).default(3600), // 5min to 24h
  allowMultipleSessions: z.boolean().default(true),
  trustedDevices: z
    .array(
      z.object({
        id: z.string().uuid(),
        name: z.string(),
        fingerprint: z.string(),
        addedAt: z.string().datetime(),
        lastUsedAt: z.string().datetime(),
      })
    )
    .default([]),
});

// Export all TypeScript types
export type Password = z.infer<typeof PasswordSchema>;
export type Email = z.infer<typeof EmailSchema>;
export type RegisterRequest = z.infer<typeof RegisterRequestSchema>;
export type LoginRequest = z.infer<typeof LoginRequestSchema>;
export type PasswordResetRequest = z.infer<typeof PasswordResetRequestSchema>;
export type PasswordResetConfirm = z.infer<typeof PasswordResetConfirmSchema>;
export type ChangePassword = z.infer<typeof ChangePasswordSchema>;
export type EmailVerification = z.infer<typeof EmailVerificationSchema>;
export type SessionUser = z.infer<typeof SessionUserSchema>;
export type SessionData = z.infer<typeof SessionDataSchema>;
export type JWTPayload = z.infer<typeof JWTPayloadSchema>;
export type AuthSuccessResponse = z.infer<typeof AuthSuccessResponseSchema>;
export type AuthErrorType = z.infer<typeof AuthErrorTypeSchema>;
export type AuthErrorResponse = z.infer<typeof AuthErrorResponseSchema>;
export type AuthResponse = z.infer<typeof AuthResponseSchema>;
export type TokenRefreshRequest = z.infer<typeof TokenRefreshRequestSchema>;
export type LogoutRequest = z.infer<typeof LogoutRequestSchema>;
export type AccountStatus = z.infer<typeof AccountStatusSchema>;
export type SecuritySettings = z.infer<typeof SecuritySettingsSchema>;

/**
 * Helper types for creating and updating auth-related data
 */
export type CreateSessionUser = Omit<SessionUser, 'id' | 'createdAt'>;
export type UpdateSessionUser = Partial<Omit<SessionUser, 'id' | 'createdAt'>>;
export type CreateSessionData = Omit<SessionData, 'sessionId' | 'createdAt' | 'lastAccessedAt'>;

/**
 * Validation helper functions
 */
export const validateRegisterRequest = (data: unknown): RegisterRequest => {
  return RegisterRequestSchema.parse(data);
};

export const validateLoginRequest = (data: unknown): LoginRequest => {
  return LoginRequestSchema.parse(data);
};

export const validatePasswordResetRequest = (data: unknown): PasswordResetRequest => {
  return PasswordResetRequestSchema.parse(data);
};

export const validatePasswordResetConfirm = (data: unknown): PasswordResetConfirm => {
  return PasswordResetConfirmSchema.parse(data);
};

export const validateChangePassword = (data: unknown): ChangePassword => {
  return ChangePasswordSchema.parse(data);
};

export const validateEmailVerification = (data: unknown): EmailVerification => {
  return EmailVerificationSchema.parse(data);
};

export const validateSessionUser = (data: unknown): SessionUser => {
  return SessionUserSchema.parse(data);
};

export const validateSessionData = (data: unknown): SessionData => {
  return SessionDataSchema.parse(data);
};

export const validateJWTPayload = (data: unknown): JWTPayload => {
  return JWTPayloadSchema.parse(data);
};

export const validateTokenRefreshRequest = (data: unknown): TokenRefreshRequest => {
  return TokenRefreshRequestSchema.parse(data);
};

export const validateLogoutRequest = (data: unknown): LogoutRequest => {
  return LogoutRequestSchema.parse(data);
};

export const validateAccountStatus = (data: unknown): AccountStatus => {
  return AccountStatusSchema.parse(data);
};

export const validateSecuritySettings = (data: unknown): SecuritySettings => {
  return SecuritySettingsSchema.parse(data);
};

/**
 * Auth error factory function
 */
export const createAuthError = (
  type: AuthErrorType,
  message: string,
  details?: Record<string, unknown>,
  code?: string,
  requestId?: string
): AuthErrorResponse => {
  return {
    success: false,
    error: {
      type,
      message,
      details,
      code,
      timestamp: new Date().toISOString(),
      requestId,
    },
  };
};

/**
 * Auth success factory function
 */
export const createAuthSuccess = (
  message: string,
  user: SessionUser,
  sessionId: string,
  accessToken: string,
  expiresAt: string,
  refreshToken?: string,
  permissions?: string[]
): AuthSuccessResponse => {
  return {
    success: true,
    message,
    data: {
      user,
      sessionId,
      accessToken,
      refreshToken,
      expiresAt,
      permissions: permissions || [],
    },
  };
};

/**
 * Constants for auth configuration
 */
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
  RATE_LIMITS: {
    LOGIN_ATTEMPTS: 5, // per 15 minutes
    PASSWORD_RESET: 3, // per hour
    EMAIL_VERIFICATION: 5, // per hour
    REGISTRATION: 3, // per hour per IP
  },
  SECURITY: {
    MAX_FAILED_ATTEMPTS: 5,
    LOCKOUT_DURATION: 15 * 60, // 15 minutes
    PASSWORD_HISTORY_COUNT: 5,
    MIN_PASSWORD_AGE: 24 * 60 * 60, // 24 hours
  },
} as const;
