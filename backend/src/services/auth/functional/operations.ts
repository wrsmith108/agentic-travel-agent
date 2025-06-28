/**
 * Pure functions for authentication operations
 * No side effects - all I/O operations are passed as dependencies
 */

import { v4 as uuidv4 } from 'uuid';
import type {
  Result,
  AuthError,
  UserId,
  Email,
  HashedPassword,
  SessionId,
  Timestamp,
  AuthUser,
  AuthSession,
  AuthTokenPair,
} from './types';
import { ok, err } from '@/utils/result';
import { AUTH_CONSTANTS, createUserId, createSessionId, createEmail, createTimestamp, isTimestampExpired, addSecondsToTimestamp,  } from './types';
import type {
  PasswordStorageOps,
  SessionStorageOps,
  AccountStatusStorageOps,
  StorageOps,
} from './storage/interfaces';
import { hashPassword, verifyPassword } from './storage';

// ============================================================================
// Registration Operations
// ============================================================================

export interface RegisterInput {
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
}

export interface RegisterDeps {
  storage: StorageOps;
  generateTokens: (userId: UserId, sessionId: SessionId) => Promise<AuthTokenPair>;
  sendVerificationEmail: (email: Email, token: string) => Promise<void>;
}

export async function register(
  input: RegisterInput,
  deps: RegisterDeps
): Promise<Result<AuthSuccess, AuthError>> {
  try {
    // Validate input
    const email = createEmail(input.email);

    // Check if user already exists
    const existingUserId = await deps.storage.password.exists(email as unknown as UserId);
    if (existingUserId.ok && existingUserId.value) {
      return err({ type: 'USER_ALREADY_EXISTS', message: 'User with this email already exists' });
    }

    // Create new user
    const userId = createUserId();
    const hashedPassword = await hashPassword(input.password);
    const now = createTimestamp();

    // Store password
    const storeResult = await deps.storage.password.store(userId, hashedPassword);
    if (!storeResult.ok) {
      return err({ type: 'SERVER_ERROR', message: 'Failed to create user' });
    }

    // Create account status
    const accountStatus = {
      userId,
      emailVerified: false,
      failedLoginAttempts: 0,
      lastFailedAttempt: null,
      accountLocked: false,
      lockedUntil: null,
      accountSuspended: false,
      suspendedUntil: null,
      createdAt: now,
      updatedAt: now,
    };

    await deps.storage.accountStatus.create(userId as any, accountStatus);

    // Create session
    const sessionId = createSessionId();
    const session: any = {
      sessionId,
      userId,
      createdAt: now,
      expiresAt: addSecondsToTimestamp(now, AUTH_CONSTANTS.SESSION_DURATION.DEFAULT),
      lastAccessedAt: now,
    };

    const sessionResult = await deps.storage.session.create(session);
    if (!sessionResult.ok) {
      return err({ type: 'SERVER_ERROR', message: 'Failed to create session' });
    }

    // Generate tokens
    const tokens = await deps.generateTokens(userId, sessionId);

    // Send verification email (fire and forget)
    deps.sendVerificationEmail(email, 'verification-token').catch(() => {
      // Log error but don't fail registration
    });

    const user: AuthUser = {
      id: userId,
      email,
      hashedPassword,
      emailVerified: false,
      createdAt: now,
      updatedAt: now,
    };

    return ok({
      user: {
        id: userId,
        email,
        firstName: input.firstName || '',
        lastName: input.lastName || '',
        emailVerified: false,
        role: 'user',
        createdAt: now,
      },
      session: {
        sessionId,
        expiresAt: session.expiresAt,
      },
      tokens,
      permissions: [],
    });
  } catch (error) {
    return err({ type: 'SERVER_ERROR', message: 'Registration failed' });
  }
}

// ============================================================================
// Login Operations
// ============================================================================

export interface LoginInput {
  email: string;
  password: string;
  rememberMe?: boolean;
  ipAddress?: string;
  userAgent?: string;
}

export interface LoginDeps {
  storage: StorageOps;
  generateTokens: (userId: UserId, sessionId: SessionId) => Promise<AuthTokenPair>;
  checkRateLimit: (email: Email) => Promise<boolean>;
}

export async function login(
  input: LoginInput,
  deps: LoginDeps
): Promise<Result<AuthSuccess, AuthError>> {
  try {
    const email = createEmail(input.email);

    // Check rate limit
    const rateLimitOk = await deps.checkRateLimit(email);
    if (!rateLimitOk) {
      return err({
        type: 'RATE_LIMIT_EXCEEDED',
        message: 'Too many login attempts. Please try again later.',
        retryAfter: 900, // 15 minutes
      });
    }

    // Get user ID by email (in real app, this would be a user lookup)
    // For now, we'll use a simple approach
    const userLookup = await deps.storage.password.retrieve(email as unknown as UserId);
    if (!userLookup.ok || !userLookup.value) {
      // Record failed attempt
      await deps.storage.accountStatus.incrementFailedAttempts(email as unknown as UserId);
      return err({ type: 'INVALID_CREDENTIALS', message: 'Invalid email or password' });
    }

    // Verify password
    const passwordValid = await verifyPassword(input.password, userLookup.value);
    if (!passwordValid) {
      // Record failed attempt
      await deps.storage.accountStatus.incrementFailedAttempts(email as unknown as UserId);
      return err({ type: 'INVALID_CREDENTIALS', message: 'Invalid email or password' });
    }

    // Check account status
    const accountStatus = await deps.storage.accountStatus.get(email as unknown as UserId);
    if (accountStatus.ok && accountStatus.value) {
      if (accountStatus.value.accountLocked) {
        return err({
          type: 'ACCOUNT_LOCKED',
          message: 'Account is locked due to too many failed attempts',
          lockedUntil: accountStatus.value.lockedUntil?.toISOString() as Timestamp,
        });
      }
      if (accountStatus.value.accountSuspended) {
        return err({
          type: 'ACCOUNT_SUSPENDED',
          message: 'Account has been suspended',
          suspendedUntil: accountStatus.value.suspendedUntil?.toISOString() as Timestamp,
        });
      }
    }

    // Reset failed attempts on successful login
    await deps.storage.accountStatus.resetFailedAttempts(email as unknown as UserId);

    // Create session
    const userId = email as unknown as UserId; // In real app, get from user lookup
    const sessionId = createSessionId();
    const now = createTimestamp();
    const sessionDuration = input.rememberMe
      ? AUTH_CONSTANTS.SESSION_DURATION.REMEMBER_ME
      : AUTH_CONSTANTS.SESSION_DURATION.DEFAULT;

    const session: any = {
      sessionId,
      userId,
      createdAt: now,
      expiresAt: addSecondsToTimestamp(now, sessionDuration),
      lastAccessedAt: now,
      ipAddress: input.ipAddress as any,
      userAgent: input.userAgent as any,
    };

    const sessionResult = await deps.storage.session.create(session);
    if (!sessionResult.ok) {
      return err({ type: 'SERVER_ERROR', message: 'Failed to create session' });
    }

    // Generate tokens
    const tokens = await deps.generateTokens(userId, sessionId);

    return ok({
      user: {
        id: userId,
        email,
        firstName: '',
        lastName: '',
        emailVerified: (accountStatus.ok && accountStatus.value?.emailVerified) || false,
        role: 'user',
        createdAt: now,
      },
      session: {
        sessionId,
        expiresAt: session.expiresAt,
      },
      tokens,
      permissions: [],
    });
  } catch (error) {
    return err({ type: 'SERVER_ERROR', message: 'Login failed' });
  }
}

// ============================================================================
// Logout Operations
// ============================================================================

export interface LogoutInput {
  sessionId: SessionId;
  logoutAll?: boolean;
}

export interface LogoutDeps {
  storage: StorageOps;
  revokeTokens: (sessionId: SessionId) => Promise<void>;
}

export async function logout(
  input: LogoutInput,
  deps: LogoutDeps
): Promise<Result<void, AuthError>> {
  try {
    // Get session to find user
    const sessionResult = await deps.storage.session.get(input.sessionId);
    if (!sessionResult.ok || !sessionResult.value) {
      return err({ type: 'SESSION_EXPIRED', message: 'Session not found or already expired' });
    }

    const session = sessionResult.value;

    if (input.logoutAll) {
      // Delete all sessions for the user
      const deleteResult = await deps.storage.session.deleteAll(session.userId);
      if (!deleteResult.ok) {
        return err({ type: 'SERVER_ERROR', message: 'Failed to logout from all sessions' });
      }
    } else {
      // Delete only the current session
      const deleteResult = await deps.storage.session.delete(input.sessionId);
      if (!deleteResult.ok) {
        return err({ type: 'SERVER_ERROR', message: 'Failed to logout' });
      }
    }

    // Revoke tokens
    await deps.revokeTokens(input.sessionId);

    return ok(undefined);
  } catch (error) {
    return err({ type: 'SERVER_ERROR', message: 'Logout failed' });
  }
}

// ============================================================================
// Session Validation Operations
// ============================================================================

export interface ValidateSessionInput {
  sessionId: SessionId;
  updateLastAccessed?: boolean;
}

export interface ValidateSessionDeps {
  storage: StorageOps;
}

export async function validateSession(
  input: ValidateSessionInput,
  deps: ValidateSessionDeps
): Promise<Result<AuthSession, AuthError>> {
  try {
    const sessionResult = await deps.storage.session.get(input.sessionId);
    if (!sessionResult.ok || !sessionResult.value) {
      return err({ type: 'SESSION_EXPIRED', message: 'Session not found' });
    }

    const session = sessionResult.value;

    // Check if session is expired
    if (isTimestampExpired(session.expiresAt)) {
      // Clean up expired session
      await deps.storage.session.delete(input.sessionId);
      return err({ type: 'SESSION_EXPIRED', message: 'Session has expired' });
    }

    // Update last accessed time if requested
    if (input.updateLastAccessed) {
      const now = createTimestamp();
      await deps.storage.session.update(input.sessionId, { lastAccessedAt: now });
      session.lastAccessedAt = now;
    }

    return ok(session);
  } catch (error) {
    return err({ type: 'SERVER_ERROR', message: 'Session validation failed' });
  }
}

// ============================================================================
// Helper Types
// ============================================================================

export interface AuthSuccess {
  user: {
    id: UserId;
    email: Email;
    firstName: string;
    lastName: string;
    emailVerified: boolean;
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
