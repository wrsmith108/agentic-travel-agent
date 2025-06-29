import bcrypt from 'bcryptjs';
import { createTimestamp } from '@/services/auth/functional/types';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';
import { env } from '@/config/env';
import { logError, logInfo, logWarn } from '@/utils/logger';
import { UserDataManager } from '@/services/storage/userDataManager';
import { UserProfile, CreateUserProfile } from '@/schemas/user';
import {
  SessionUser,
  SessionData,
  JWTPayload,
  AuthSuccessResponse,
  AuthErrorResponse,
  AccountStatus,
  createAuthError,
  createAuthSuccess,
  validateRegisterRequest,
  validateLoginRequest,
  validatePasswordResetRequest,
  validatePasswordResetConfirm,
  validateChangePassword,
  AUTH_CONSTANTS,
} from '@/schemas/auth';

/**
 * Password reset token data structure
 */
interface PasswordResetToken {
  userId: string;
  token: string;
  expiresAt: Date;
  createdAt: Date;
  used: boolean;
}

/**
 * Email verification token data structure
 */
interface EmailVerificationToken {
  userId: string;
  token: string;
  email: string;
  expiresAt: Date;
  createdAt: Date;
  used: boolean;
}

/**
 * Session storage interface for managing user sessions
 */
interface SessionStorage {
  [sessionId: string]: SessionData;
}

/**
 * Core authentication service providing comprehensive user management,
 * session handling, and security features with bcrypt password hashing
 */
class AuthService {
  private readonly userDataManager: UserDataManager;
  private readonly jwtSecret: string;
  private readonly jwtRefreshSecret: string;
  private readonly passwordResetTokens: Map<string, PasswordResetToken> = new Map();
  private readonly emailVerificationTokens: Map<string, EmailVerificationToken> = new Map();
  private readonly sessions: SessionStorage = {};
  private readonly failedLoginAttempts: Map<
    string,
    { count: number; lastAttempt: Date; lockedUntil?: Date }
  > = new Map();
  private readonly passwordStorage: Map<string, string> = new Map();

  constructor(userDataManager?: UserDataManager) {
    this.userDataManager = userDataManager || new UserDataManager();
    this.jwtSecret = env.JWT_SECRET || this.generateFallbackSecret();
    this.jwtRefreshSecret = env.JWT_REFRESH_SECRET || this.generateFallbackSecret();

    // Start cleanup intervals for expired tokens and sessions
    this.startCleanupIntervals();

    logInfo('AuthService initialized', {
      jwtSecretConfigured: !!env.JWT_SECRET,
      refreshSecretConfigured: !!env.JWT_REFRESH_SECRET,
    });
  }

  /**
   * Register a new user with comprehensive validation and security checks
   */
  async registerUser(data: unknown): Promise<AuthSuccessResponse | AuthErrorResponse> {
    const requestId = uuidv4();

    try {
      // Validate input data
      const registerRequest = validateRegisterRequest(data);

      logInfo('User registration attempt', {
        email: registerRequest.email,
        requestId,
      });

      // Check if user already exists
      const existingUser = await this.userDataManager.findUserByEmail(registerRequest.email);
      if (existingUser) {
        logWarn('Registration attempt with existing email', {
          email: registerRequest.email,
          requestId,
        });
        return createAuthError(
          'USER_ALREADY_EXISTS',
          'An account with this email address already exists',
          { email: registerRequest.email },
          'AUTH_001',
          requestId
        );
      }

      // Hash password with bcrypt
      const saltRounds = 12; // High security salt rounds
      const hashedPassword = await bcrypt.hash(registerRequest.password, saltRounds);

      // Create user profile data
      const userProfileData: CreateUserProfile = {
        firstName: registerRequest.firstName,
        lastName: registerRequest.lastName,
        email: registerRequest.email,
        preferences: {
          currency: 'CAD',
          timezone: 'America/Toronto',
          preferredDepartureAirport: 'YYZ', // Default to Toronto
          communicationFrequency: 'daily',
          subscriptionTier: 'free', // Default tier
        },
      };

      // Create user through UserDataManager
      const userProfile = await this.userDataManager.createUser(userProfileData);

      // Store password hash separately (not in the main profile for security)
      await this.storeUserPassword(userProfile.id, hashedPassword);

      // Create initial account status
      await this.createUserAccountStatus(userProfile.id);

      // Create initial security settings
      await this.createUserSecuritySettings(userProfile.id);

      // Generate email verification token if needed
      let verificationToken: string | undefined;
      if (env.REQUIRE_EMAIL_VERIFICATION) {
        verificationToken = await this.generateEmailVerificationToken(
          userProfile.id,
          userProfile.email
        );
      }

      // Create session for the new user
      const sessionUser: SessionUser = {
        id: userProfile.id,
        email: userProfile.email,
        firstName: userProfile.firstName,
        lastName: userProfile.lastName,
        isEmailVerified: !env.REQUIRE_EMAIL_VERIFICATION, // Auto-verify if not required
        role: 'user',
        createdAt: userProfile.createdAt,
      };

      const { sessionId, accessToken, expiresAt } = await this.createUserSession(sessionUser);

      logInfo('User registered successfully', {
        userId: userProfile.id,
        email: userProfile.email,
        emailVerificationRequired: !!verificationToken,
        requestId,
      });

      return createAuthSuccess(
        'Registration successful',
        sessionUser,
        sessionId,
        accessToken,
        expiresAt,
        undefined, // No refresh token for new registrations by default
        ['user:read', 'user:update']
      );
    } catch (error) {
      logError('User registration failed', error, { requestId });

      // Handle Zod validation errors
      if (error instanceof z.ZodError) {
        const firstError = error.errors[0];
        const message = firstError?.message || 'Validation failed';
        return createAuthError(
          'VALIDATION_ERROR',
          message,
          { errors: error.errors },
          'AUTH_002',
          requestId
        );
      }

      if (error instanceof Error) {
        // Handle other validation errors
        if (error.message.includes('validation')) {
          return createAuthError('VALIDATION_ERROR', error.message, {}, 'AUTH_002', requestId);
        }
      }

      return createAuthError(
        'SERVER_ERROR',
        'Registration failed due to server error',
        {},
        'AUTH_003',
        requestId
      );
    }
  }

  /**
   * Validate user credentials (email and password) without creating session
   */
  async validateCredentials(email: string, password: string): Promise<{ success: boolean; user?: UserProfile; message?: string }> {
    try {
      // Find user by email
      const userProfile = await this.userDataManager.findUserByEmail(email);
      if (!userProfile) {
        await this.recordFailedLoginAttempt(email);
        return { success: false, message: 'Invalid email or password' };
      }

      // Check account status
      const accountStatus = await this.getUserAccountStatus(userProfile.id);
      if (accountStatus.isAccountLocked) {
        return { success: false, message: 'Account is locked' };
      }

      if (accountStatus.isAccountSuspended) {
        return { success: false, message: 'Account is suspended' };
      }

      // Verify password
      const storedPasswordHash = await this.getUserPasswordHash(userProfile.id);
      if (!storedPasswordHash) {
        logError('Password hash not found for user', null, { userId: userProfile.id });
        return { success: false, message: 'Authentication system error' };
      }

      const passwordValid = await bcrypt.compare(password, storedPasswordHash);
      if (!passwordValid) {
        await this.recordFailedLoginAttempt(email);
        return { success: false, message: 'Invalid email or password' };
      }

      // Check email verification if required
      if (env.REQUIRE_EMAIL_VERIFICATION && !accountStatus.isEmailVerified) {
        return { success: false, message: 'Please verify your email address before logging in' };
      }

      // Clear failed login attempts on successful authentication
      this.cleanupFailedLoginAttempts();

      return { success: true, user: userProfile };
    } catch (error) {
      logError('Credential validation failed', error, { email });
      return { success: false, message: 'Authentication system error' };
    }
  }

  /**
   * Authenticate user login with password verification and security checks
   */
  async loginUser(data: unknown): Promise<AuthSuccessResponse | AuthErrorResponse> {
    const requestId = uuidv4();

    try {
      // Validate input data
      const loginRequest = validateLoginRequest(data);

      logInfo('User login attempt', {
        email: loginRequest.email,
        rememberMe: loginRequest.rememberMe,
        requestId,
      });

      // Check rate limiting for failed attempts
      const rateLimitResult = await this.checkLoginRateLimit(loginRequest.email);
      if (!rateLimitResult.allowed) {
        return createAuthError(
          'RATE_LIMIT_EXCEEDED',
          `Too many failed login attempts. Account locked until ${rateLimitResult.lockedUntil}`,
          { lockedUntil: rateLimitResult.lockedUntil },
          'AUTH_004',
          requestId
        );
      }

      // Find user by email
      const userProfile = await this.userDataManager.findUserByEmail(loginRequest.email);
      if (!userProfile) {
        await this.recordFailedLoginAttempt(loginRequest.email);
        return createAuthError(
          'INVALID_CREDENTIALS',
          'Invalid email or password',
          {},
          'AUTH_005',
          requestId
        );
      }

      // Check account status
      const accountStatus = await this.getUserAccountStatus(userProfile.id);
      if (accountStatus.isAccountLocked) {
        return createAuthError(
          'ACCOUNT_LOCKED',
          accountStatus.lockReason || 'Account is locked',
          { lockedUntil: accountStatus.lockedUntil },
          'AUTH_006',
          requestId
        );
      }

      if (accountStatus.isAccountSuspended) {
        return createAuthError(
          'ACCOUNT_SUSPENDED',
          accountStatus.suspensionReason || 'Account is suspended',
          { suspendedUntil: accountStatus.suspendedUntil },
          'AUTH_007',
          requestId
        );
      }

      // Verify password
      const storedPasswordHash = await this.getUserPasswordHash(userProfile.id);
      if (!storedPasswordHash) {
        logError('Password hash not found for user', null, { userId: userProfile.id });
        return createAuthError(
          'SERVER_ERROR',
          'Authentication system error',
          {},
          'AUTH_008',
          requestId
        );
      }

      const passwordValid = await bcrypt.compare(loginRequest.password, storedPasswordHash);
      if (!passwordValid) {
        await this.recordFailedLoginAttempt(loginRequest.email);
        return createAuthError(
          'INVALID_CREDENTIALS',
          'Invalid email or password',
          {},
          'AUTH_009',
          requestId
        );
      }

      // Check email verification if required
      if (env.REQUIRE_EMAIL_VERIFICATION && !accountStatus.isEmailVerified) {
        return createAuthError(
          'EMAIL_NOT_VERIFIED',
          'Please verify your email address before logging in',
          {},
          'AUTH_010',
          requestId
        );
      }

      // Clear failed login attempts on successful authentication
      this.failedLoginAttempts.delete(loginRequest.email);

      // Update last login timestamp
      await this.updateUserLastLogin(userProfile.id);

      // Create session user
      const sessionUser: SessionUser = {
        id: userProfile.id,
        email: userProfile.email,
        firstName: userProfile.firstName,
        lastName: userProfile.lastName,
        isEmailVerified: accountStatus.isEmailVerified,
        role: 'user',
        lastLoginAt: new Date().toISOString(),
        createdAt: userProfile.createdAt,
      };

      // Create session with appropriate duration
      const sessionDuration = loginRequest.rememberMe
        ? AUTH_CONSTANTS.SESSION_DURATION.REMEMBER_ME
        : AUTH_CONSTANTS.SESSION_DURATION.DEFAULT;

      const deviceInfo = loginRequest.deviceInfo
        ? {
            ...(loginRequest.deviceInfo.userAgent && {
              userAgent: loginRequest.deviceInfo.userAgent,
            }),
            ...(loginRequest.deviceInfo.ipAddress && {
              ipAddress: loginRequest.deviceInfo.ipAddress,
            }),
            ...(loginRequest.deviceInfo.fingerprint && {
              fingerprint: loginRequest.deviceInfo.fingerprint,
            }),
          }
        : undefined;

      const { sessionId, accessToken, refreshToken, expiresAt } = await this.createUserSession(
        sessionUser,
        sessionDuration,
        deviceInfo
      );

      logInfo('User login successful', {
        userId: userProfile.id,
        email: userProfile.email,
        sessionId,
        rememberMe: loginRequest.rememberMe,
        requestId,
      });

      return createAuthSuccess(
        'Login successful',
        sessionUser,
        sessionId,
        accessToken,
        expiresAt,
        refreshToken,
        ['user:read', 'user:update', 'user:delete']
      );
    } catch (error) {
      logError('User login failed', error, { requestId });

      return createAuthError(
        'SERVER_ERROR',
        'Login failed due to server error',
        {},
        'AUTH_011',
        requestId
      );
    }
  }

  /**
   * Generate password reset token and initiate reset process
   */
  async requestPasswordReset(
    data: unknown
  ): Promise<{ success: boolean; message: string; token?: string }> {
    const requestId = uuidv4();

    try {
      const resetRequest = validatePasswordResetRequest(data);

      logInfo('Password reset requested', {
        email: resetRequest.email,
        requestId,
      });

      // Find user by email
      const userProfile = await this.userDataManager.findUserByEmail(resetRequest.email);
      if (!userProfile) {
        // Don't reveal that user doesn't exist for security
        logWarn('Password reset request for non-existent user', {
          email: resetRequest.email,
          requestId,
        });
        return {
          success: true,
          message: 'If an account with this email exists, a reset link has been sent',
        };
      }

      // Generate secure reset token
      const resetToken = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + AUTH_CONSTANTS.TOKEN_EXPIRY.RESET_TOKEN * 1000);

      // Store reset token
      this.passwordResetTokens.set(resetToken, {
        userId: userProfile.id,
        token: resetToken,
        expiresAt,
        createdAt: new Date().toISOString(),
        used: false,
      });

      logInfo('Password reset token generated', {
        userId: userProfile.id,
        tokenExpiry: expiresAt,
        requestId,
      });

      // In a real implementation, you would send this via email
      // For now, we'll return it (remove this in production)
      return {
        success: true,
        message: 'Password reset token generated',
        token: resetToken, // Remove this in production - send via email instead
      };
    } catch (error) {
      logError('Password reset request failed', error, { requestId });

      return {
        success: false,
        message: 'Password reset request failed',
      };
    }
  }

  /**
   * Reset password using valid reset token
   */
  async resetPassword(data: unknown): Promise<AuthSuccessResponse | AuthErrorResponse> {
    const requestId = uuidv4();

    try {
      const resetConfirm = validatePasswordResetConfirm(data);

      logInfo('Password reset confirmation attempt', {
        token: resetConfirm.token.substring(0, 8) + '...',
        requestId,
      });

      // Validate reset token
      const tokenData = this.passwordResetTokens.get(resetConfirm.token);
      if (!tokenData || tokenData.used || tokenData.expiresAt < new Date()) {
        return createAuthError(
          'TOKEN_INVALID',
          'Invalid or expired reset token',
          {},
          'AUTH_012',
          requestId
        );
      }

      // Get user profile
      const userProfile = await this.userDataManager.readUserData(tokenData.userId);
      if (!userProfile) {
        return createAuthError(
          'USER_NOT_FOUND',
          'User account not found',
          {},
          'AUTH_013',
          requestId
        );
      }

      // Hash new password
      const saltRounds = 12;
      const hashedPassword = await bcrypt.hash(resetConfirm.newPassword, saltRounds);

      // Update password
      await this.storeUserPassword(userProfile.id, hashedPassword);

      // Mark token as used
      tokenData.used = true;

      // Clear any failed login attempts
      this.failedLoginAttempts.delete(userProfile.email);

      // Invalidate all existing sessions for security
      await this.invalidateAllUserSessions(userProfile.id);

      logInfo('Password reset successful', {
        userId: userProfile.id,
        email: userProfile.email,
        requestId,
      });

      // Create new session for the user
      const sessionUser: SessionUser = {
        id: userProfile.id,
        email: userProfile.email,
        firstName: userProfile.firstName,
        lastName: userProfile.lastName,
        isEmailVerified: true, // Assume verified if they can reset password
        role: 'user',
        createdAt: userProfile.createdAt,
      };

      const { sessionId, accessToken, expiresAt } = await this.createUserSession(sessionUser);

      return createAuthSuccess(
        'Password reset successful',
        sessionUser,
        sessionId,
        accessToken,
        expiresAt,
        undefined,
        ['user:read', 'user:update']
      );
    } catch (error) {
      logError('Password reset failed', error, { requestId });

      return createAuthError(
        'SERVER_ERROR',
        'Password reset failed due to server error',
        {},
        'AUTH_014',
        requestId
      );
    }
  }

  /**
   * Change password for authenticated user
   */
  async changePassword(
    userId: string,
    data: unknown
  ): Promise<{ success: boolean; message: string }> {
    const requestId = uuidv4();

    try {
      const changePasswordRequest = validateChangePassword(data);

      logInfo('Password change attempt', {
        userId,
        requestId,
      });

      // Get user profile
      const userProfile = await this.userDataManager.readUserData(userId);
      if (!userProfile) {
        return {
          success: false,
          message: 'User not found',
        };
      }

      // Verify current password
      const storedPasswordHash = await this.getUserPasswordHash(userId);
      if (!storedPasswordHash) {
        logError('Password hash not found for user during change', null, { userId });
        return {
          success: false,
          message: 'Authentication system error',
        };
      }

      const currentPasswordValid = await bcrypt.compare(
        changePasswordRequest.currentPassword,
        storedPasswordHash
      );
      if (!currentPasswordValid) {
        return {
          success: false,
          message: 'Current password is incorrect',
        };
      }

      // Hash new password
      const saltRounds = 12;
      const hashedPassword = await bcrypt.hash(changePasswordRequest.newPassword, saltRounds);

      // Update password
      await this.storeUserPassword(userId, hashedPassword);

      // Invalidate all other sessions for security (keep current session)
      await this.invalidateOtherUserSessions(userId);

      logInfo('Password changed successfully', {
        userId,
        email: userProfile.email,
        requestId,
      });

      return {
        success: true,
        message: 'Password changed successfully',
      };
    } catch (error) {
      logError('Password change failed', error, { userId, requestId });

      return {
        success: false,
        message: 'Password change failed',
      };
    }
  }

  /**
   * Validate user session and return user data
   */
  async validateSession(sessionId: string): Promise<SessionUser | null> {
    try {
      const sessionData = this.sessions[sessionId];
      if (!sessionData) {
        return null;
      }

      // Check if session is expired
      if (new Date(sessionData.expiresAt) < new Date()) {
        delete this.sessions[sessionId];
        return null;
      }

      // Check if session is active
      if (!sessionData.isActive) {
        return null;
      }

      // Update last accessed time
      sessionData.lastAccessedAt = createTimestamp();

      return sessionData.user;
    } catch (error) {
      logError('Session validation failed', error, { sessionId });
      return null;
    }
  }

  /**
   * Validate JWT token and return payload
   */
  async validateJWTToken(token: string): Promise<JWTPayload | null> {
    try {
      const payload = jwt.verify(token, this.jwtSecret) as JWTPayload;

      // Validate session still exists
      const sessionUser = await this.validateSession(payload.sessionId);
      if (!sessionUser) {
        return null;
      }

      return payload;
    } catch (error) {
      if (error instanceof jwt.JsonWebTokenError) {
        logWarn('Invalid JWT token', { error: error.message });
      } else {
        logError('JWT token validation failed', error);
      }
      return null;
    }
  }

  /**
   * Logout user and invalidate session
   */
  async logoutUser(sessionId: string): Promise<{ success: boolean; message: string }> {
    try {
      const sessionData = this.sessions[sessionId];
      if (sessionData) {
        delete this.sessions[sessionId];

        logInfo('User logged out', {
          userId: sessionData.userId,
          sessionId,
        });
      }

      return {
        success: true,
        message: 'Logged out successfully',
      };
    } catch (error) {
      logError('Logout failed', error, { sessionId });

      return {
        success: false,
        message: 'Logout failed',
      };
    }
  }

  /**
   * Get user by ID with validation
   */
  async getUserById(userId: string): Promise<UserProfile | null> {
    try {
      return await this.userDataManager.readUserData(userId);
    } catch (error) {
      logError('Failed to get user by ID', error, { userId });
      return null;
    }
  }

  /**
   * Get user by email with validation
   */
  async getUserByEmail(email: string): Promise<UserProfile | null> {
    try {
      return await this.userDataManager.findUserByEmail(email);
    } catch (error) {
      logError('Failed to get user by email', error, { email });
      return null;
    }
  }

  /**
   * Get user account status
   */
  async getUserAccountStatus(userId: string): Promise<AccountStatus> {
    // In a real implementation, this would be stored in a database
    // For now, return default status
    const failedAttempts = this.failedLoginAttempts.get(userId);

    return {
      isEmailVerified: true, // Default for now
      isAccountLocked: failedAttempts
        ? failedAttempts.count >= AUTH_CONSTANTS.SECURITY.MAX_FAILED_ATTEMPTS
        : false,
      isAccountSuspended: false,
      failedLoginAttempts: failedAttempts?.count || 0,
      lastFailedLoginAt: failedAttempts?.lastAttempt?.toISOString(),
      lockedUntil: failedAttempts?.lockedUntil?.toISOString(),
    };
  }

  // Private helper methods

  private generateFallbackSecret(): string {
    const secret = crypto.randomBytes(64).toString('hex');
    logWarn(
      'Using generated fallback JWT secret - set JWT_SECRET environment variable for production'
    );
    return secret;
  }

  private async createUserSession(
    user: SessionUser,
    duration: number = AUTH_CONSTANTS.SESSION_DURATION.DEFAULT,
    deviceInfo?: { userAgent?: string; ipAddress?: string; fingerprint?: string }
  ): Promise<{ sessionId: string; accessToken: string; refreshToken?: string; expiresAt: string }> {
    const sessionId = uuidv4();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + duration * 1000);

    // Create session data
    const sessionData: SessionData = {
      sessionId,
      userId: user.id,
      user,
      createdAt: now.toISOString(),
      expiresAt: expiresAt,
      lastAccessedAt: now.toISOString(),
      ipAddress: deviceInfo?.ipAddress,
      userAgent: deviceInfo?.userAgent,
      deviceFingerprint: deviceInfo?.fingerprint,
      isActive: true,
      loginMethod: 'email',
    };

    // Store session
    this.sessions[sessionId] = sessionData;

    // Create JWT token
    const jwtPayload: JWTPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      sessionId,
      iat: Math.floor(now.getTime() / 1000),
      exp: Math.floor(expiresAt.getTime() / 1000),
      iss: 'agentic-travel-agent',
      aud: 'agentic-travel-agent-users',
    };

    const accessToken = jwt.sign(jwtPayload, this.jwtSecret);

    // Create refresh token for longer sessions
    let refreshToken: string | undefined;
    if (duration > AUTH_CONSTANTS.SESSION_DURATION.DEFAULT) {
      refreshToken = jwt.sign({ ...jwtPayload, type: 'refresh' }, this.jwtRefreshSecret, {
        expiresIn: AUTH_CONSTANTS.TOKEN_EXPIRY.REFRESH_TOKEN,
      });
    }

    const result: {
      sessionId: string;
      accessToken: string;
      refreshToken?: string;
      expiresAt: string;
    } = {
      sessionId,
      accessToken,
      expiresAt: expiresAt,
    };

    if (refreshToken) {
      result.refreshToken = refreshToken;
    }

    return result;
  }

  private async checkLoginRateLimit(
    email: string
  ): Promise<{ allowed: boolean; lockedUntil?: Date }> {
    const attempts = this.failedLoginAttempts.get(email);

    if (!attempts) {
      return { allowed: true };
    }

    // Check if account is currently locked
    if (attempts.lockedUntil && attempts.lockedUntil > new Date()) {
      return { allowed: false, lockedUntil: attempts.lockedUntil };
    }

    // Check if too many failed attempts
    if (attempts.count >= AUTH_CONSTANTS.SECURITY.MAX_FAILED_ATTEMPTS) {
      const lockUntil = new Date(Date.now() + AUTH_CONSTANTS.SECURITY.LOCKOUT_DURATION * 1000);
      attempts.lockedUntil = lockUntil;
      return { allowed: false, lockedUntil: lockUntil };
    }

    return { allowed: true };
  }

  private async recordFailedLoginAttempt(email: string): Promise<void> {
    const now = new Date();
    const existing = this.failedLoginAttempts.get(email);

    if (existing) {
      existing.count += 1;
      existing.lastAttempt = now;
    } else {
      this.failedLoginAttempts.set(email, {
        count: 1,
        lastAttempt: now,
      });
    }
  }

  private async storeUserPassword(userId: string, hashedPassword: string): Promise<void> {
    // In a real implementation, this would be stored in a secure database
    // For this MVP, we'll store in a simple in-memory map
    // This is NOT production-ready and should be replaced with proper storage
    this.passwordStorage.set(userId, hashedPassword);
  }

  private async getUserPasswordHash(userId: string): Promise<string | null> {
    // In a real implementation, this would be fetched from a secure database
    return this.passwordStorage.get(userId) || null;
  }

  private async createUserAccountStatus(_userId: string): Promise<void> {
    // In a real implementation, this would be stored in a database
    // For now, we just track it in the failed attempts map
  }

  private async createUserSecuritySettings(_userId: string): Promise<void> {
    // In a real implementation, this would be stored in a database
    // For now, we use default settings
  }

  private async generateEmailVerificationToken(userId: string, email: string): Promise<string> {
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + AUTH_CONSTANTS.TOKEN_EXPIRY.VERIFICATION_TOKEN * 1000);

    this.emailVerificationTokens.set(token, {
      userId,
      token,
      email,
      expiresAt,
      createdAt: new Date().toISOString(),
      used: false,
    });

    return token;
  }

  private async updateUserLastLogin(userId: string): Promise<void> {
    try {
      await this.userDataManager.updateUserData(userId, {
        updatedAt: createTimestamp(),
      });
    } catch (error) {
      logError('Failed to update user last login', error, { userId });
    }
  }

  private async invalidateAllUserSessions(userId: string): Promise<void> {
    const sessionIds = Object.keys(this.sessions).filter(
      (sessionId) => this.sessions[sessionId]?.userId === userId
    );

    for (const sessionId of sessionIds) {
      delete this.sessions[sessionId];
    }

    logInfo('All user sessions invalidated', { userId, sessionCount: sessionIds.length });
  }

  private async invalidateOtherUserSessions(userId: string, keepSessionId?: string): Promise<void> {
    const sessionIds = Object.keys(this.sessions).filter(
      (sessionId) => this.sessions[sessionId]?.userId === userId && sessionId !== keepSessionId
    );

    for (const sessionId of sessionIds) {
      delete this.sessions[sessionId];
    }

    logInfo('Other user sessions invalidated', { userId, sessionCount: sessionIds.length });
  }

  private startCleanupIntervals(): void {
    // Clean up expired tokens and sessions every 15 minutes
    const cleanupInterval = 15 * 60 * 1000; // 15 minutes

    setInterval(() => {
      this.cleanupExpiredTokens();
      this.cleanupExpiredSessions();
      this.cleanupFailedLoginAttempts();
    }, cleanupInterval);

    logInfo('Cleanup intervals started', { intervalMinutes: 15 });
  }

  private cleanupExpiredTokens(): void {
    const now = new Date();
    let cleanedCount = 0;

    // Clean password reset tokens
    for (const [token, data] of this.passwordResetTokens.entries()) {
      if (data.expiresAt < now || data.used) {
        this.passwordResetTokens.delete(token);
        cleanedCount++;
      }
    }

    // Clean email verification tokens
    for (const [token, data] of this.emailVerificationTokens.entries()) {
      if (data.expiresAt < now || data.used) {
        this.emailVerificationTokens.delete(token);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      logInfo('Expired tokens cleaned up', { count: cleanedCount });
    }
  }

  private cleanupExpiredSessions(): void {
    const now = new Date();
    let cleanedCount = 0;

    for (const [sessionId, sessionData] of Object.entries(this.sessions)) {
      if (new Date(sessionData.expiresAt) < now) {
        delete this.sessions[sessionId];
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      logInfo('Expired sessions cleaned up', { count: cleanedCount });
    }
  }

  private cleanupFailedLoginAttempts(): void {
    const now = new Date();
    let cleanedCount = 0;

    for (const [email, attempts] of this.failedLoginAttempts.entries()) {
      // Clean up old failed attempts (older than 24 hours)
      const cutoff = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      if (attempts.lastAttempt < cutoff) {
        this.failedLoginAttempts.delete(email);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      logInfo('Old failed login attempts cleaned up', { count: cleanedCount });
    }
  }
}

// Export singleton instance
export const authService = new AuthService();

// Export class for testing and custom instances
export { AuthService };
