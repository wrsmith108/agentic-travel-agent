import { v4 as uuidv4 } from 'uuid';
import { createTimestamp } from '@/services/auth/functional/types';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { JWTPayload, SessionUser, SessionData } from '@/schemas/auth';
import { UserProfile } from '@/schemas/user';

/**
 * Test utilities for authentication testing
 * Provides helper functions for creating mock auth data
 */

/**
 * Create a mock user profile for testing
 */
export const createMockUserProfile = (overrides?: Partial<UserProfile>): UserProfile => {
  const userId = overrides?.id || uuidv4();
  const now = createTimestamp();

  return {
    id: userId,
    firstName: 'Test',
    lastName: 'User',
    email: 'test@example.com',
    preferences: {
      currency: 'CAD',
      timezone: 'America/Toronto',
      preferredDepartureAirport: 'YYZ',
      communicationFrequency: 'daily',
      subscriptionTier: 'free',
    },
    activeSearches: [],
    searchHistory: [],
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
};

/**
 * Create a mock session user for testing
 */
export const createMockSessionUser = (overrides?: Partial<SessionUser>): SessionUser => {
  return {
    id: uuidv4(),
    email: 'test@example.com',
    firstName: 'Test',
    lastName: 'User',
    isEmailVerified: true,
    role: 'user',
    createdAt: createTimestamp(),
    ...overrides,
  };
};

/**
 * Create a mock JWT payload for testing
 */
export const createMockJWTPayload = (
  userId: string,
  sessionId: string,
  overrides?: Partial<JWTPayload>
): JWTPayload => {
  const now = Math.floor(Date.now() / 1000);

  return {
    sub: userId,
    email: 'test@example.com',
    role: 'user',
    sessionId,
    iat: now,
    exp: now + 3600, // 1 hour from now
    iss: 'agentic-travel-agent',
    aud: 'agentic-travel-agent-users',
    ...overrides,
  };
};

/**
 * Create a valid JWT token for testing
 */
export const createMockJWTToken = (payload: JWTPayload, secret: string = 'test-secret'): string => {
  return jwt.sign(payload, secret);
};

/**
 * Create a mock session data for testing
 */
export const createMockSessionData = (
  user: SessionUser,
  overrides?: Partial<SessionData>
): SessionData => {
  const sessionId = overrides?.sessionId || uuidv4();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 3600000); // 1 hour from now

  return {
    sessionId,
    userId: user.id,
    user,
    createdAt: now as string,
    expiresAt: expiresAt as string,
    lastAccessedAt: now as string,
    isActive: true,
    loginMethod: 'email',
    ...overrides,
  };
};

/**
 * Create a mock password reset token
 */
export const createMockPasswordResetToken = (): string => {
  return crypto.randomBytes(32).toString('hex');
};

/**
 * Create a mock email verification token
 */
export const createMockEmailVerificationToken = (): string => {
  return crypto.randomBytes(32).toString('hex');
};

/**
 * Create mock device info for testing
 */
export const createMockDeviceInfo = () => ({
  userAgent: 'Mozilla/5.0 (Test) AppleWebKit/537.36',
  ipAddress: '127.0.0.1',
  fingerprint: 'test-device-fingerprint-' + uuidv4(),
});

/**
 * Create mock authentication headers
 */
export const createAuthHeaders = (token: string) => ({
  Authorization: `Bearer ${token}`,
  'Content-Type': 'application/json',
});

/**
 * Create mock rate limit headers
 */
export const createRateLimitHeaders = () => ({
  'X-RateLimit-Limit': '5',
  'X-RateLimit-Remaining': '0',
  'X-RateLimit-Reset': new Date(Date.now() + 900000) as string, // 15 minutes from now
});

/**
 * Generate a secure password that meets requirements
 */
export const generateSecurePassword = (): string => {
  return 'Test@Password123!';
};

/**
 * Generate a weak password that fails validation
 */
export const generateWeakPassword = (): string => {
  return 'weak';
};

/**
 * Create expired JWT payload
 */
export const createExpiredJWTPayload = (userId: string, sessionId: string): JWTPayload => {
  const past = Math.floor(Date.now() / 1000) - 7200; // 2 hours ago

  return {
    sub: userId,
    email: 'test@example.com',
    role: 'user',
    sessionId,
    iat: past - 3600,
    exp: past, // Already expired
    iss: 'agentic-travel-agent',
    aud: 'agentic-travel-agent-users',
  };
};

/**
 * Create expired session data
 */
export const createExpiredSessionData = (user: SessionUser): SessionData => {
  const sessionId = uuidv4();
  const past = new Date(Date.now() - 7200000); // 2 hours ago

  return {
    sessionId,
    userId: user.id,
    user,
    createdAt: past as string,
    expiresAt: past as string, // Already expired
    lastAccessedAt: past as string,
    isActive: true,
    loginMethod: 'email',
  };
};

/**
 * Mock successful authentication response
 */
export const createMockAuthSuccessResponse = (
  user: SessionUser,
  sessionId: string,
  accessToken: string
) => ({
  success: true,
  message: 'Authentication successful',
  data: {
    user,
    sessionId,
    accessToken,
    expiresAt: new Date(Date.now() + 3600000) as string,
    permissions: ['user:read', 'user:update'],
  },
});

/**
 * Mock authentication error response
 */
export const createMockAuthErrorResponse = (errorType: string, message: string, code?: string) => ({
  success: false,
  error: {
    type: errorType,
    message,
    code: code || errorType,
    timestamp: createTimestamp(),
  },
});

/**
 * Wait for a specified amount of time (useful for testing timeouts)
 */
export const wait = (ms: number): Promise<void> => {
  return new Promise((resolve) => setTimeout(resolve, ms));
};

/**
 * Create mock account status
 */
export const createMockAccountStatus = (overrides?: any) => ({
  isEmailVerified: true,
  isAccountLocked: false,
  isAccountSuspended: false,
  failedLoginAttempts: 0,
  ...overrides,
});

/**
 * Create test user registration data
 */
export const createTestRegistrationData = (email?: string) => ({
  firstName: 'Test',
  lastName: 'User',
  email: email || `test-${Date.now()}@example.com`,
  password: generateSecurePassword(),
  confirmPassword: generateSecurePassword(),
  acceptTerms: true,
  marketingOptIn: false,
});

/**
 * Create test login data
 */
export const createTestLoginData = (email: string, password: string) => ({
  email,
  password,
  rememberMe: false,
  deviceInfo: createMockDeviceInfo(),
});

/**
 * Create mock session storage for testing
 */
export class MockSessionStorage {
  private sessions: Map<string, SessionData> = new Map();

  store(sessionId: string, data: SessionData): void {
    this.sessions.set(sessionId, data);
  }

  get(sessionId: string): SessionData | undefined {
    return this.sessions.get(sessionId);
  }

  delete(sessionId: string): boolean {
    return this.sessions.delete(sessionId);
  }

  clear(): void {
    this.sessions.clear();
  }

  getAll(): SessionData[] {
    return Array.from(this.sessions.values());
  }

  getUserSessions(userId: string): SessionData[] {
    return Array.from(this.sessions.values()).filter((session) => session.userId === userId);
  }
}

/**
 * Create mock token storage for testing
 */
export class MockTokenStorage {
  private tokens: Map<string, any> = new Map();

  storePasswordResetToken(token: string, data: any): void {
    this.tokens.set(`reset:${token}`, {
      ...data,
      type: 'passwordReset',
    });
  }

  getPasswordResetToken(token: string): any {
    return this.tokens.get(`reset:${token}`);
  }

  storeEmailVerificationToken(token: string, data: any): void {
    this.tokens.set(`verify:${token}`, {
      ...data,
      type: 'emailVerification',
    });
  }

  getEmailVerificationToken(token: string): any {
    return this.tokens.get(`verify:${token}`);
  }

  deleteToken(token: string): boolean {
    return this.tokens.delete(`reset:${token}`) || this.tokens.delete(`verify:${token}`);
  }

  clear(): void {
    this.tokens.clear();
  }

  getExpiredTokens(): any[] {
    const now = new Date();
    return Array.from(this.tokens.values()).filter((token) => new Date(token.expiresAt) < now);
  }
}

/**
 * Mock email service for testing
 */
export class MockEmailService {
  private sentEmails: any[] = [];

  async sendPasswordResetEmail(email: string, token: string): Promise<void> {
    this.sentEmails.push({
      type: 'passwordReset',
      to: email,
      token,
      sentAt: new Date().toISOString(),
    });
  }

  async sendEmailVerification(email: string, token: string): Promise<void> {
    this.sentEmails.push({
      type: 'emailVerification',
      to: email,
      token,
      sentAt: new Date().toISOString(),
    });
  }

  getSentEmails(): any[] {
    return this.sentEmails;
  }

  getLastEmail(): any {
    return this.sentEmails[this.sentEmails.length - 1];
  }

  clear(): void {
    this.sentEmails = [];
  }
}

export default {
  createMockUserProfile,
  createMockSessionUser,
  createMockJWTPayload,
  createMockJWTToken,
  createMockSessionData,
  createMockPasswordResetToken,
  createMockEmailVerificationToken,
  createMockDeviceInfo,
  createAuthHeaders,
  createRateLimitHeaders,
  generateSecurePassword,
  generateWeakPassword,
  createExpiredJWTPayload,
  createExpiredSessionData,
  createMockAuthSuccessResponse,
  createMockAuthErrorResponse,
  wait,
  createMockAccountStatus,
  createTestRegistrationData,
  createTestLoginData,
  MockSessionStorage,
  MockTokenStorage,
  MockEmailService,
};
