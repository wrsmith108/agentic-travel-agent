/**
 * Functional Auth Service - Storage Module
 *
 * Manages storage for passwords, tokens, and failed login attempts
 */

import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { logError, logInfo, logWarn } from '@/utils/logger';
import type {
  UserId,
  Email,
  HashedPassword,
  ResetToken,
  VerificationToken,
  PasswordResetToken,
  EmailVerificationToken,
  FailedLoginAttempt,
  PasswordStorage,
  TokenStorage,
  FailedAttemptStorage,
} from '../types';

// ===== Password Storage Implementation =====

const passwordMap = new Map<string, string>();

export const passwordStorage: PasswordStorage = {
  async get(userId: UserId): Promise<HashedPassword | null> {
    const hash = passwordMap.get(userId);
    return hash ? (hash as HashedPassword) : null;
  },

  async set(userId: UserId, hash: HashedPassword): Promise<void> {
    passwordMap.set(userId, hash);
  },

  async delete(userId: UserId): Promise<boolean> {
    return passwordMap.delete(userId);
  },

  async clear(): Promise<void> {
    passwordMap.clear();
  },
};

// ===== Token Storage Implementation =====

const createTokenStorage = <T>(): TokenStorage<T> => {
  const storage = new Map<string, T>();

  return {
    async get(token: string): Promise<T | null> {
      return storage.get(token) || null;
    },

    async set(token: string, data: T): Promise<void> {
      storage.set(token, data);
    },

    async delete(token: string): Promise<boolean> {
      return storage.delete(token);
    },

    async clear(): Promise<void> {
      storage.clear();
    },

    async getAll(): Promise<Map<string, T>> {
      return new Map(storage);
    },

    // Alias methods
    async store(token: string, data: T): Promise<void> {
      return this.set(token, data);
    },

    async retrieve(token: string): Promise<T | null> {
      return this.get(token);
    },
  };
};

export const passwordResetTokens = createTokenStorage<PasswordResetToken>();
export const emailVerificationTokens = createTokenStorage<EmailVerificationToken>();

// ===== Failed Login Attempts Storage =====

const failedAttemptMap = new Map<string, FailedLoginAttempt>();

export const failedLoginAttempts: FailedAttemptStorage = {
  get(email: Email): FailedLoginAttempt | undefined {
    return failedAttemptMap.get(email);
  },

  set(email: Email, attempt: FailedLoginAttempt): void {
    failedAttemptMap.set(email, attempt);
  },

  delete(email: Email): boolean {
    return failedAttemptMap.delete(email);
  },

  clear(): void {
    failedAttemptMap.clear();
  },
};

// ===== Password Hashing Functions =====

export const hashPassword = async (password: string): Promise<HashedPassword> => {
  const saltRounds = 12;
  const hash = await bcrypt.hash(password, saltRounds);
  return hash as HashedPassword;
};

export const verifyPassword = async (password: string, hash: HashedPassword): Promise<boolean> => {
  return bcrypt.compare(password, hash);
};

// ===== Token Generation Functions =====

export const generateResetToken = (): ResetToken => {
  return crypto.randomBytes(32).toString('hex') as ResetToken;
};

export const generateVerificationToken = (): VerificationToken => {
  return crypto.randomBytes(32).toString('hex') as VerificationToken;
};

// ===== Cleanup Functions =====

export const cleanupExpiredTokens = async (): Promise<void> => {
  const now = new Date();
  let cleanedCount = 0;

  // Clean password reset tokens
  for (const [token, data] of (await passwordResetTokens.getAll()).entries()) {
    if (data.expiresAt < now || data.used) {
      passwordResetTokens.delete(token);
      cleanedCount++;
    }
  }

  // Clean email verification tokens
  for (const [token, data] of (await emailVerificationTokens.getAll()).entries()) {
    if (data.expiresAt < now || data.used) {
      emailVerificationTokens.delete(token);
      cleanedCount++;
    }
  }

  if (cleanedCount > 0) {
    logInfo('Expired tokens cleaned up', { count: cleanedCount });
  }
};

export const cleanupFailedLoginAttempts = (): void => {
  const now = new Date();
  const cutoff = new Date(now.getTime() - 24 * 60 * 60 * 1000); // 24 hours
  let cleanedCount = 0;

  for (const [email, attempts] of failedAttemptMap.entries()) {
    if (attempts.lastAttempt < cutoff) {
      failedAttemptMap.delete(email);
      cleanedCount++;
    }
  }

  if (cleanedCount > 0) {
    logInfo('Old failed login attempts cleaned up', { count: cleanedCount });
  }
};

// ===== Account Status Functions =====

export const createUserAccountStatus = async (userId: UserId): Promise<void> => {
  // In a real implementation, this would be stored in a database
  // For now, we just track it in the failed attempts map
  logInfo('Account status created', { userId });
};

export const createUserSecuritySettings = async (userId: UserId): Promise<void> => {
  // In a real implementation, this would be stored in a database
  // For now, we use default settings
  logInfo('Security settings created', { userId });
};

// ===== Utility Functions =====

export const generateFallbackSecret = (): string => {
  const secret = crypto.randomBytes(64).toString('hex');
  logWarn(
    'Using generated fallback JWT secret - set JWT_SECRET environment variable for production'
  );
  return secret;
};

// ===== Export All Storage Functions =====

export const storage = {
  passwords: passwordStorage,
  passwordResetTokens,
  emailVerificationTokens,
  failedLoginAttempts,
  hashPassword,
  verifyPassword,
  generateResetToken,
  generateVerificationToken,
  cleanupExpiredTokens,
  cleanupFailedLoginAttempts,
  createUserAccountStatus,
  createUserSecuritySettings,
  generateFallbackSecret,
} as const;
