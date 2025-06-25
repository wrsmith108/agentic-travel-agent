/**
 * Pure functions for password management
 */

import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import type {
  PlainPassword,
  HashedPassword,
  UserId,
  ResetToken,
  RequestId,
} from '@/types/brandedTypes';
import {
  PlainPassword as createPlainPassword,
  HashedPassword as createHashedPassword,
  ResetToken as createResetToken,
} from '@/types/brandedTypes';
import type {
  Result,
  AuthError,
  PasswordStorage,
  TokenStorage,
  PasswordResetTokenRecord,
  Logger,
  IdGenerator,
  TimeProvider,
} from './types';
import { success, failure } from './types';
import { AUTH_CONSTANTS } from '@/schemas/auth';

/**
 * Hash a plain password using bcrypt
 */
export const hashPassword = async (
  password: PlainPassword,
  saltRounds: number = 12
): Promise<Result<HashedPassword, AuthError>> => {
  try {
    const hash = await bcrypt.hash(password, saltRounds);
    return success(createHashedPassword(hash));
  } catch (error) {
    return failure({
      type: 'SERVER_ERROR',
      message: 'Failed to hash password',
      details: { error: error instanceof Error ? error.message : 'Unknown error' },
    });
  }
};

/**
 * Verify a plain password against a hashed password
 */
export const verifyPassword = async (
  password: PlainPassword,
  hash: HashedPassword
): Promise<Result<boolean, AuthError>> => {
  try {
    const isValid = await bcrypt.compare(password, hash);
    return success(isValid);
  } catch (error) {
    return failure({
      type: 'SERVER_ERROR',
      message: 'Failed to verify password',
      details: { error: error instanceof Error ? error.message : 'Unknown error' },
    });
  }
};

/**
 * Generate a secure reset token
 */
export const generateResetToken = (): Result<ResetToken, AuthError> => {
  try {
    const token = crypto.randomBytes(32).toString('hex');
    return success(createResetToken(token));
  } catch (error) {
    return failure({
      type: 'SERVER_ERROR',
      message: 'Failed to generate reset token',
      details: { error: error instanceof Error ? error.message : 'Unknown error' },
    });
  }
};

/**
 * Create a password reset token and store it
 */
export const createPasswordResetToken = async (
  deps: {
    tokenStorage: TokenStorage<PasswordResetTokenRecord>;
    timeProvider: TimeProvider;
    logger: Logger;
  },
  userId: UserId,
  requestId: RequestId
): Promise<Result<ResetToken, AuthError>> => {
  const { tokenStorage, timeProvider, logger } = deps;

  try {
    // Generate token
    const tokenResult = generateResetToken();
    if (!tokenResult.success) {
      return tokenResult;
    }

    const token = tokenResult.data;
    const now = timeProvider.now();
    const expiresAt = new Date(now.getTime() + AUTH_CONSTANTS.TOKEN_EXPIRY.RESET_TOKEN * 1000);

    // Store token
    const tokenRecord: PasswordResetTokenRecord = {
      type: 'password_reset',
      userId,
      token,
      expiresAt,
      createdAt: now,
      used: false,
    };

    await tokenStorage.store(token, tokenRecord);

    logger.info('Password reset token generated', {
      userId,
      tokenExpiry: expiresAt.toISOString(),
      requestId,
    });

    return success(token);
  } catch (error) {
    logger.error('Failed to create password reset token', error, { userId, requestId });
    return failure({
      type: 'SERVER_ERROR',
      message: 'Failed to create password reset token',
      details: { error: error instanceof Error ? error.message : 'Unknown error' },
      requestId,
    });
  }
};

/**
 * Validate a password reset token
 */
export const validateResetToken = async (
  deps: {
    tokenStorage: TokenStorage<PasswordResetTokenRecord>;
    timeProvider: TimeProvider;
  },
  token: ResetToken
): Promise<Result<{ userId: UserId; token: PasswordResetTokenRecord }, AuthError>> => {
  const { tokenStorage, timeProvider } = deps;

  try {
    const tokenRecord = await tokenStorage.retrieve(token);

    if (!tokenRecord) {
      return failure({
        type: 'TOKEN_INVALID',
        message: 'Invalid reset token',
      });
    }

    if (tokenRecord.used) {
      return failure({
        type: 'TOKEN_INVALID',
        message: 'Reset token has already been used',
      });
    }

    if (tokenRecord.expiresAt < timeProvider.now()) {
      return failure({
        type: 'TOKEN_EXPIRED',
        message: 'Reset token has expired',
      });
    }

    return success({ userId: tokenRecord.userId, token: tokenRecord });
  } catch (error) {
    return failure({
      type: 'SERVER_ERROR',
      message: 'Failed to validate reset token',
      details: { error: error instanceof Error ? error.message : 'Unknown error' },
    });
  }
};

/**
 * Reset user password with a valid token
 */
export const resetPasswordWithToken = async (
  deps: {
    passwordStorage: PasswordStorage;
    tokenStorage: TokenStorage<PasswordResetTokenRecord>;
    timeProvider: TimeProvider;
    logger: Logger;
  },
  token: ResetToken,
  newPassword: PlainPassword,
  requestId: RequestId
): Promise<Result<UserId, AuthError>> => {
  const { passwordStorage, tokenStorage, logger } = deps;

  // Validate token
  const validationResult = await validateResetToken(
    { tokenStorage: deps.tokenStorage, timeProvider: deps.timeProvider },
    token
  );

  if (!validationResult.success) {
    return validationResult;
  }

  const { userId } = validationResult.data;

  try {
    // Hash new password
    const hashResult = await hashPassword(newPassword);
    if (!hashResult.success) {
      return hashResult;
    }

    // Update password
    await passwordStorage.store(userId, hashResult.data);

    // Mark token as used
    await tokenStorage.markUsed(token);

    logger.info('Password reset successful', { userId, requestId });

    return success(userId);
  } catch (error) {
    logger.error('Password reset failed', error, { userId, requestId });
    return failure({
      type: 'SERVER_ERROR',
      message: 'Failed to reset password',
      details: { error: error instanceof Error ? error.message : 'Unknown error' },
      requestId,
    });
  }
};

/**
 * Change user password (requires current password)
 */
export const changeUserPassword = async (
  deps: {
    passwordStorage: PasswordStorage;
    logger: Logger;
  },
  userId: UserId,
  currentPassword: PlainPassword,
  newPassword: PlainPassword,
  requestId: RequestId
): Promise<Result<void, AuthError>> => {
  const { passwordStorage, logger } = deps;

  try {
    // Get current password hash
    const currentHash = await passwordStorage.retrieve(userId);
    if (!currentHash) {
      logger.error('Password hash not found for user during change', null, { userId });
      return failure({
        type: 'SERVER_ERROR',
        message: 'Authentication system error',
        requestId,
      });
    }

    // Verify current password
    const verifyResult = await verifyPassword(currentPassword, currentHash);
    if (!verifyResult.success) {
      return verifyResult;
    }

    if (!verifyResult.data) {
      return failure({
        type: 'INVALID_CREDENTIALS',
        message: 'Current password is incorrect',
        requestId,
      });
    }

    // Hash new password
    const hashResult = await hashPassword(newPassword);
    if (!hashResult.success) {
      return hashResult;
    }

    // Update password
    await passwordStorage.store(userId, hashResult.data);

    logger.info('Password changed successfully', { userId, requestId });

    return success(undefined);
  } catch (error) {
    logger.error('Password change failed', error, { userId, requestId });
    return failure({
      type: 'SERVER_ERROR',
      message: 'Password change failed',
      details: { error: error instanceof Error ? error.message : 'Unknown error' },
      requestId,
    });
  }
};

/**
 * Validate password strength
 */
export const validatePasswordStrength = (password: string): Result<PlainPassword, AuthError> => {
  if (password.length < 8) {
    return failure({
      type: 'VALIDATION_ERROR',
      message: 'Password must be at least 8 characters long',
    });
  }

  if (password.length > 128) {
    return failure({
      type: 'VALIDATION_ERROR',
      message: 'Password must not exceed 128 characters',
    });
  }

  if (!/[a-z]/.test(password)) {
    return failure({
      type: 'VALIDATION_ERROR',
      message: 'Password must contain at least one lowercase letter',
    });
  }

  if (!/[A-Z]/.test(password)) {
    return failure({
      type: 'VALIDATION_ERROR',
      message: 'Password must contain at least one uppercase letter',
    });
  }

  if (!/[0-9]/.test(password)) {
    return failure({
      type: 'VALIDATION_ERROR',
      message: 'Password must contain at least one number',
    });
  }

  if (!/[^a-zA-Z0-9]/.test(password)) {
    return failure({
      type: 'VALIDATION_ERROR',
      message: 'Password must contain at least one special character',
    });
  }

  return success(createPlainPassword(password));
};
