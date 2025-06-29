/**
 * Pure functions for password management
 */

import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import type {
  HashedPassword,
  UserId,
  ResetToken,
  AuthError,
  PasswordResetTokenData,
  TokenStorage,
  TimeProvider,
  Logger,
  PasswordResetTokenRecord,
  PasswordStorage,
  IdGenerator,
} from './types';
import {
  createHashedPassword,
  createResetToken,
} from './types';
import { Result, ok, err, isOk, isErr } from '@/utils/result';
import type { PlainTextPassword } from './password';
import { AUTH_CONSTANTS } from '@/schemas/auth';
import { RequestId } from '@/types/brandedTypes';

/**
 * Hash a plain password using bcrypt
 */
export const hashPassword = async (
  password: PlainTextPassword,
  saltRounds: number = 12
): Promise<Result<HashedPassword, AuthError>> => {
  try {
    const hash = await bcrypt.hash(password, saltRounds);
    return ok(createHashedPassword(hash));
  } catch (error) {
    return err({
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
  password: PlainTextPassword,
  hash: HashedPassword
): Promise<Result<boolean, AuthError>> => {
  try {
    const isValid = await bcrypt.compare(password, hash);
    return ok(isValid);
  } catch (error) {
    return err({
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
    return ok(createResetToken(token));
  } catch (error) {
    return err({
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
    if (isErr(tokenResult)) {
      return err(tokenResult.error);
    }

    const token = isOk(tokenResult) ? tokenResult.value : null;
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
      tokenExpiry: expiresAt,
      requestId,
    });

    return ok(token);
  } catch (error) {
    logger.error('Failed to create password reset token', error, { userId, requestId });
    return err({
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
      return err({
        type: 'TOKEN_INVALID',
        message: 'Invalid reset token',
      });
    }

    if (tokenRecord.used) {
      return err({
        type: 'TOKEN_INVALID',
        message: 'Reset token has already been used',
      });
    }

    if (tokenRecord.expiresAt < timeProvider.now()) {
      return err({
        type: 'TOKEN_EXPIRED',
        message: 'Reset token has expired',
      });
    }

    return ok({ userId: tokenRecord.userId, token: tokenRecord });
  } catch (error) {
    return err({
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
  newPassword: PlainTextPassword,
  requestId: RequestId
): Promise<Result<UserId, AuthError>> => {
  const { passwordStorage, tokenStorage, logger } = deps;

  // Validate token
  const validationResult = await validateResetToken(
    { tokenStorage: deps.tokenStorage, timeProvider: deps.timeProvider },
    token
  );

  if (isErr(validationResult)) {
    return err(validationResult.error);
  }

  const { userId } = (isOk(validationResult) ? validationResult.value : undefined);

  try {
    // Hash new password
    const hashResult = await hashPassword(newPassword);
    if (isErr(hashResult)) {
      return err(hashResult.error);
    }

    // Update password
    await passwordStorage.set(userId, (isOk(hashResult) ? hashResult.value : undefined));

    // Mark token as used
    await tokenStorage.delete(token);

    logger.info('Password reset successful', { userId, requestId });

    return ok(userId);
  } catch (error) {
    logger.error('Password reset failed', error, { userId, requestId });
    return err({
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
  currentPassword: PlainTextPassword,
  newPassword: PlainTextPassword,
  requestId: RequestId
): Promise<Result<void, AuthError>> => {
  const { passwordStorage, logger } = deps;

  try {
    // Get current password hash
    const currentHash = await passwordStorage.get(userId);
    if (!currentHash) {
      logger.error('Password hash not found for user during change', null, { userId });
      return err({
        type: 'SERVER_ERROR',
        message: 'Authentication system error',
        requestId,
      });
    }

    // Verify current password
    const verifyResult = await verifyPassword(currentPassword, currentHash);
    if (isErr(verifyResult)) {
      return err(verifyResult.error);
    }

    if (isErr(verifyResult)) {
      return err({
        type: 'INVALID_CREDENTIALS',
        message: 'Current password is incorrect',
        requestId,
      });
    }

    // Hash new password
    const hashResult = await hashPassword(newPassword);
    if (isErr(hashResult)) {
      return err(hashResult.error);
    }

    // Update password
    await passwordStorage.set(userId, (isOk(hashResult) ? hashResult.value : undefined));

    logger.info('Password changed successfully', { userId, requestId });

    return ok(undefined);
  } catch (error) {
    logger.error('Password change failed', error, { userId, requestId });
    return err({
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
export const validatePasswordStrength = (password: string): Result<PlainTextPassword, AuthError> => {
  if (password.length < 8) {
    return err({
      type: 'VALIDATION_ERROR',
      message: 'Password must be at least 8 characters long',
    });
  }

  if (password.length > 128) {
    return err({
      type: 'VALIDATION_ERROR',
      message: 'Password must not exceed 128 characters',
    });
  }

  if (!/[a-z]/.test(password)) {
    return err({
      type: 'VALIDATION_ERROR',
      message: 'Password must contain at least one lowercase letter',
    });
  }

  if (!/[A-Z]/.test(password)) {
    return err({
      type: 'VALIDATION_ERROR',
      message: 'Password must contain at least one uppercase letter',
    });
  }

  if (!/[0-9]/.test(password)) {
    return err({
      type: 'VALIDATION_ERROR',
      message: 'Password must contain at least one number',
    });
  }

  if (!/[^a-zA-Z0-9]/.test(password)) {
    return err({
      type: 'VALIDATION_ERROR',
      message: 'Password must contain at least one special character',
    });
  }

  return ok(password as PlainTextPassword);
};
