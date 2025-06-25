/**
 * Authentication service using functional programming and Result pattern
 */

import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { Result, ok, err, flatMap, map } from '@/utils/result';
import { 
  generateTokenPair, 
  verifyAccessToken, 
  verifyRefreshToken,
  generateAccessToken,
  generateRefreshToken,
  asAccessToken,
  asRefreshToken,
  JWTError,
  JWTPayload,
} from '@/utils/jwt';
import {
  createSession,
  getSession,
  deleteSession,
  deleteUserSessions,
  touchSession,
  updateSessionRefreshToken,
  findSessionByRefreshToken,
  extendSession,
  SessionId,
  Session,
  SessionError,
} from './sessionManager';
import { getUserDataManagerOps } from '@/services/storage/userDataManager';
import { asUserId, asEmail } from '@/services/storage/functional';
import { UserId } from '@/types/brandedTypes';
import {
  AuthError,
  AuthSuccess,
  RegisterRequest,
  LoginRequest,
  invalidCredentials,
  userNotFound,
  userAlreadyExists,
  validationError,
  systemError,
} from '@/types/auth';
import { validateRegisterRequest, validateLoginRequest } from '@/utils/validation';
import { CreateUserProfile } from '@/schemas/user';

// Get user data manager operations
const userDataOps = getUserDataManagerOps();

// Constants
const SALT_ROUNDS = 10;

/**
 * Register a new user
 */
export const register = async (
  data: RegisterRequest
): Promise<Result<AuthSuccess, AuthError>> => {
  try {
    // Validate input
    const validation = validateRegisterRequest(data);
    if (!validation.isValid) {
      return err(validationError('Validation failed', validation.errors));
    }

    // Check if user already exists
    const existingUser = await userDataOps.findUserByEmail(asEmail(data.email));
    if (existingUser) {
      return err(userAlreadyExists('An account with this email already exists'));
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(data.password, SALT_ROUNDS);

    // Create user profile
    const userProfile: CreateUserProfile = {
      firstName: data.firstName,
      lastName: data.lastName,
      email: data.email,
      preferences: {
        currency: 'USD',
        timezone: 'UTC',
        preferredDepartureAirport: '',
        communicationFrequency: 'immediate',
        subscriptionTier: 'free',
      },
    };

    const newUser = await userDataOps.createUser(userProfile);
    const userId = asUserId(newUser.id);

    // Store password hash (in real app, this would be in the user record)
    // For now, we'll store it in a separate map
    storePasswordHash(userId, hashedPassword);

    // Create session
    const sessionResult = createSession(userId, {
      ipAddress: undefined,
      userAgent: undefined,
    });

    if (!sessionResult.ok) {
      return err(systemError('Failed to create session'));
    }

    const session = sessionResult.value;

    // Generate tokens
    const tokenResult = generateTokenPair(
      userId,
      newUser.email,
      session.id,
      'user',
      false
    );

    if (!tokenResult.ok) {
      return err(systemError('Failed to generate tokens'));
    }

    const { accessToken, refreshToken } = tokenResult.value;

    // Update session with refresh token
    updateSessionRefreshToken(session.id, refreshToken);

    return ok({
      user: {
        id: newUser.id,
        firstName: newUser.firstName,
        lastName: newUser.lastName,
        email: newUser.email,
        createdAt: newUser.createdAt,
        emailVerified: false,
        role: 'user',
        lastLoginAt: new Date().toISOString(),
      },
      accessToken,
      refreshToken,
      expiresAt: session.expiresAt.toISOString(),
    });
  } catch (error) {
    return err(systemError(
      error instanceof Error ? error.message : 'Registration failed'
    ));
  }
};

/**
 * Login user
 */
export const login = async (
  data: LoginRequest & { rememberMe?: boolean }
): Promise<Result<AuthSuccess, AuthError>> => {
  try {
    // Validate input
    const validation = validateLoginRequest(data);
    if (!validation.isValid) {
      return err(validationError('Validation failed', validation.errors));
    }

    // Find user by email
    const user = await userDataOps.findUserByEmail(asEmail(data.email));
    if (!user) {
      return err(invalidCredentials());
    }

    const userId = asUserId(user.id);

    // Get stored password hash
    const storedHash = getPasswordHash(userId);
    if (!storedHash) {
      return err(invalidCredentials());
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(data.password, storedHash);
    if (!isPasswordValid) {
      return err(invalidCredentials());
    }

    // Create session
    const sessionResult = createSession(userId, {
      rememberMe: data.rememberMe,
      ipAddress: undefined,
      userAgent: undefined,
    });

    if (!sessionResult.ok) {
      return err(systemError('Failed to create session'));
    }

    const session = sessionResult.value;

    // Generate tokens
    const tokenResult = generateTokenPair(
      userId,
      user.email,
      session.id,
      'user',
      data.rememberMe
    );

    if (!tokenResult.ok) {
      return err(systemError('Failed to generate tokens'));
    }

    const { accessToken, refreshToken } = tokenResult.value;

    // Update session with refresh token
    updateSessionRefreshToken(session.id, refreshToken);

    // Update last login time
    await userDataOps.updateUserData(userId, {
      lastLoginAt: new Date().toISOString(),
    });

    return ok({
      user: {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        createdAt: user.createdAt,
        emailVerified: false,
        role: 'user',
        lastLoginAt: new Date().toISOString(),
      },
      accessToken,
      refreshToken,
      expiresAt: session.expiresAt.toISOString(),
    });
  } catch (error) {
    return err(systemError(
      error instanceof Error ? error.message : 'Login failed'
    ));
  }
};

/**
 * Logout user
 */
export const logout = async (
  sessionId: string,
  logoutAll = false
): Promise<Result<void, AuthError>> => {
  try {
    const session = getSession(sessionId as SessionId);
    
    if (logoutAll && session.ok) {
      // Delete all user sessions
      deleteUserSessions(session.value.userId);
    } else {
      // Delete single session
      deleteSession(sessionId as SessionId);
    }

    return ok(undefined);
  } catch (error) {
    return err(systemError(
      error instanceof Error ? error.message : 'Logout failed'
    ));
  }
};

/**
 * Refresh access token
 */
export const refreshAccessToken = async (
  refreshToken: string
): Promise<Result<{ accessToken: string; expiresAt: string }, AuthError | JWTError>> => {
  try {
    // Verify refresh token
    const tokenResult = verifyRefreshToken(asRefreshToken(refreshToken));
    if (!tokenResult.ok) {
      return tokenResult;
    }

    const tokenPayload = tokenResult.value;

    // Find session by refresh token
    const sessionResult = findSessionByRefreshToken(refreshToken);
    if (!sessionResult.ok) {
      return err(invalidCredentials('Invalid refresh token'));
    }

    const session = sessionResult.value;

    // Verify session belongs to user in token
    if (session.userId !== tokenPayload.sub) {
      return err(invalidCredentials('Token mismatch'));
    }

    // Get user data
    const user = await userDataOps.readUserData(asUserId(tokenPayload.sub));
    if (!user) {
      return err(userNotFound());
    }

    // Generate new access token
    const newTokenResult = generateAccessToken({
      sub: user.id,
      email: user.email,
      sessionId: session.id,
      role: 'user',
    });

    if (!newTokenResult.ok) {
      return newTokenResult;
    }

    // Touch session to update last accessed
    touchSession(session.id);

    return ok({
      accessToken: newTokenResult.value,
      expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(), // 15 minutes
    });
  } catch (error) {
    return err(systemError(
      error instanceof Error ? error.message : 'Token refresh failed'
    ));
  }
};

/**
 * Verify session
 */
export const verifySession = async (
  sessionId: string
): Promise<Result<Session, AuthError | SessionError>> => {
  const sessionResult = getSession(sessionId as SessionId);
  
  if (!sessionResult.ok) {
    return sessionResult;
  }

  // Touch session to update last accessed
  touchSession(sessionId as SessionId);

  return sessionResult;
};

/**
 * Request password reset
 */
export const requestPasswordReset = async (
  email: string
): Promise<Result<{ token: string }, AuthError>> => {
  try {
    // Find user by email
    const user = await userDataOps.findUserByEmail(asEmail(email));
    if (!user) {
      // Don't reveal if user exists
      return ok({ token: '' });
    }

    // Generate reset token
    const resetToken = uuidv4();
    const resetExpiry = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    // Store reset token (in real app, store in database)
    storePasswordResetToken(asUserId(user.id), resetToken, resetExpiry);

    // In production, send email with reset link
    // For now, return token for testing
    return ok({ token: resetToken });
  } catch (error) {
    return err(systemError(
      error instanceof Error ? error.message : 'Password reset request failed'
    ));
  }
};

/**
 * Reset password with token
 */
export const resetPassword = async (
  token: string,
  newPassword: string
): Promise<Result<void, AuthError>> => {
  try {
    // Find user by reset token
    const userId = getUserIdByResetToken(token);
    if (!userId) {
      return err(invalidCredentials('Invalid or expired reset token'));
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, SALT_ROUNDS);

    // Update password
    storePasswordHash(userId, hashedPassword);

    // Clear reset token
    clearPasswordResetToken(userId);

    // Invalidate all existing sessions
    deleteUserSessions(userId);

    return ok(undefined);
  } catch (error) {
    return err(systemError(
      error instanceof Error ? error.message : 'Password reset failed'
    ));
  }
};

// Temporary in-memory storage for passwords and reset tokens
// In production, these would be stored in the database
const passwordStore = new Map<UserId, string>();
const resetTokenStore = new Map<string, { userId: UserId; expiry: Date }>();

const storePasswordHash = (userId: UserId, hash: string): void => {
  passwordStore.set(userId, hash);
};

const getPasswordHash = (userId: UserId): string | undefined => {
  return passwordStore.get(userId);
};

const storePasswordResetToken = (userId: UserId, token: string, expiry: Date): void => {
  resetTokenStore.set(token, { userId, expiry });
};

const getUserIdByResetToken = (token: string): UserId | null => {
  const data = resetTokenStore.get(token);
  if (!data) return null;
  
  if (data.expiry.getTime() < Date.now()) {
    resetTokenStore.delete(token);
    return null;
  }
  
  return data.userId;
};

const clearPasswordResetToken = (userId: UserId): void => {
  for (const [token, data] of resetTokenStore.entries()) {
    if (data.userId === userId) {
      resetTokenStore.delete(token);
    }
  }
};