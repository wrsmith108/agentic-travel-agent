import type { z } from 'zod';

/**
 * Password Operations Module
 *
 * This module provides pure functions for password hashing, verification,
 * and storage operations using bcrypt with proper dependency injection.
 * All functions work with the HashedPassword branded type for type safety.
 */

// ============================================================================
// Branded Types
// ============================================================================

/**
 * Branded type for hashed passwords to ensure type safety
 * This prevents accidentally using plain text passwords where hashed ones are expected
 */
export type HashedPassword = string & { readonly __brand: unique symbol };

/**
 * Plain text password type for clarity
 */
export type PlainTextPassword = string;

/**
 * Type guard to check if a string is a hashed password
 * Bcrypt hashes always start with $2a$, $2b$, or $2y$
 */
export const isHashedPassword = (value: string): value is HashedPassword => {
  return /^\$2[aby]\$\d{2}\$/.test(value);
};

/**
 * Creates a HashedPassword from a string (unsafe - use only when loading from storage)
 */
export const unsafeCreateHashedPassword = (hash: string): HashedPassword => {
  if (!isHashedPassword(hash)) {
    throw new Error('Invalid password hash format');
  }
  return hash;
};

// ============================================================================
// Dependencies Types
// ============================================================================

/**
 * Bcrypt dependency interface for dependency injection
 */
export interface BcryptDependency {
  hash: (password: string, saltRounds: number) => Promise<string>;
  compare: (password: string, hash: string) => Promise<boolean>;
  genSalt: (rounds: number) => Promise<string>;
  getRounds: (hash: string) => number;
}

/**
 * Password configuration
 */
export interface PasswordConfig {
  saltRounds: number;
  minLength: number;
  maxLength: number;
  requireUppercase: boolean;
  requireLowercase: boolean;
  requireNumbers: boolean;
  requireSpecialChars: boolean;
}

/**
 * Default password configuration matching the existing auth schema
 */
export const defaultPasswordConfig: PasswordConfig = {
  saltRounds: 12,
  minLength: 8,
  maxLength: 128,
  requireUppercase: true,
  requireLowercase: true,
  requireNumbers: true,
  requireSpecialChars: true,
};

// ============================================================================
// Validation Functions
// ============================================================================

/**
 * Validates a plain text password against configuration rules
 */
export const validatePassword = (
  password: PlainTextPassword,
  config: PasswordConfig = defaultPasswordConfig
): { valid: boolean; errors: string[] } => {
  const errors: string[] = [];

  if (password.length < config.minLength) {
    errors.push(`Password must be at least ${config.minLength} characters long`);
  }

  if (password.length > config.maxLength) {
    errors.push(`Password must not exceed ${config.maxLength} characters`);
  }

  if (config.requireLowercase && !/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }

  if (config.requireUppercase && !/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }

  if (config.requireNumbers && !/[0-9]/.test(password)) {
    errors.push('Password must contain at least one number');
  }

  if (config.requireSpecialChars && !/[^a-zA-Z0-9]/.test(password)) {
    errors.push('Password must contain at least one special character');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
};

// ============================================================================
// Core Password Functions
// ============================================================================

/**
 * Hashes a plain text password using bcrypt
 * Returns a HashedPassword branded type
 */
export const hashPassword = async (
  bcrypt: BcryptDependency,
  password: PlainTextPassword,
  config: PasswordConfig = defaultPasswordConfig
): Promise<HashedPassword> => {
  // Validate password before hashing
  const validation = validatePassword(password, config);
  if (!validation.valid) {
    throw new Error(`Invalid password: ${validation.errors.join(', ')}`);
  }

  // Hash the password
  const hash = await bcrypt.hash(password, config.saltRounds);

  // Return as branded type
  return hash as HashedPassword;
};

/**
 * Verifies a plain text password against a hashed password
 */
export const verifyPassword = async (
  bcrypt: BcryptDependency,
  password: PlainTextPassword,
  hash: HashedPassword
): Promise<boolean> => {
  try {
    return await bcrypt.compare(password, hash);
  } catch (error) {
    // Log error in production
    console.error('Password verification error:', error);
    return false;
  }
};

/**
 * Gets the number of salt rounds used in a password hash
 */
export const getHashRounds = (bcrypt: BcryptDependency, hash: HashedPassword): number => {
  return bcrypt.getRounds(hash);
};

/**
 * Checks if a password hash needs to be upgraded (e.g., if salt rounds changed)
 */
export const needsRehash = (
  bcrypt: BcryptDependency,
  hash: HashedPassword,
  config: PasswordConfig = defaultPasswordConfig
): boolean => {
  const currentRounds = getHashRounds(bcrypt, hash);
  return currentRounds !== config.saltRounds;
};

// ============================================================================
// Storage Operations
// ============================================================================

/**
 * Password storage entry
 */
export interface PasswordStorageEntry {
  userId: string;
  hash: HashedPassword;
  createdAt: Date;
  updatedAt: Date;
  version: number;
}

/**
 * Creates a password storage entry
 */
export const createPasswordStorage = (
  userId: string,
  hash: HashedPassword
): PasswordStorageEntry => {
  const now = new Date();
  return {
    userId,
    hash,
    createdAt: now,
    updatedAt: now,
    version: 1,
  };
};

/**
 * Updates a password storage entry
 */
export const updatePasswordStorage = (
  entry: PasswordStorageEntry,
  newHash: HashedPassword
): PasswordStorageEntry => {
  return {
    ...entry,
    hash: newHash,
    updatedAt: new Date(),
    version: entry.version + 1,
  };
};

// ============================================================================
// Password History
// ============================================================================

/**
 * Password history entry for preventing password reuse
 */
export interface PasswordHistoryEntry {
  hash: HashedPassword;
  createdAt: Date;
}

/**
 * Checks if a password was previously used
 */
export const wasPasswordPreviouslyUsed = async (
  bcrypt: BcryptDependency,
  password: PlainTextPassword,
  history: PasswordHistoryEntry[]
): Promise<boolean> => {
  for (const entry of history) {
    if (await verifyPassword(bcrypt, password, entry.hash)) {
      return true;
    }
  }
  return false;
};

/**
 * Adds a password to history, maintaining a maximum number of entries
 */
export const addToPasswordHistory = (
  history: PasswordHistoryEntry[],
  hash: HashedPassword,
  maxEntries: number = 5
): PasswordHistoryEntry[] => {
  const newEntry: PasswordHistoryEntry = {
    hash,
    createdAt: new Date(),
  };

  const updatedHistory = [newEntry, ...history];

  // Keep only the most recent entries
  return updatedHistory.slice(0, maxEntries);
};

// ============================================================================
// Password Strength
// ============================================================================

/**
 * Password strength levels
 */
export type PasswordStrength = 'weak' | 'fair' | 'good' | 'strong' | 'very-strong';

/**
 * Calculates password strength based on various criteria
 */
export const calculatePasswordStrength = (
  password: PlainTextPassword
): {
  strength: PasswordStrength;
  score: number;
  feedback: string[];
} => {
  let score = 0;
  const feedback: string[] = [];

  // Length scoring
  if (password.length >= 8) score += 1;
  if (password.length >= 12) score += 1;
  if (password.length >= 16) score += 1;

  // Character diversity
  if (/[a-z]/.test(password)) score += 1;
  if (/[A-Z]/.test(password)) score += 1;
  if (/[0-9]/.test(password)) score += 1;
  if (/[^a-zA-Z0-9]/.test(password)) score += 1;

  // Pattern detection (penalize common patterns)
  if (/(.)\1{2,}/.test(password)) {
    score -= 1;
    feedback.push('Avoid repeating characters');
  }
  if (/^(123|abc|qwerty)/i.test(password)) {
    score -= 2;
    feedback.push('Avoid common patterns');
  }

  // Normalize score
  score = Math.max(0, Math.min(10, score));

  // Determine strength
  let strength: PasswordStrength;
  if (score <= 2) {
    strength = 'weak';
    feedback.push('Consider using a longer password with more character variety');
  } else if (score <= 4) {
    strength = 'fair';
    feedback.push('Add more character types for better security');
  } else if (score <= 6) {
    strength = 'good';
  } else if (score <= 8) {
    strength = 'strong';
  } else {
    strength = 'very-strong';
  }

  return { strength, score, feedback };
};

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Generates a secure random password
 */
export const generateSecurePassword = (
  length: number = 16,
  options: {
    includeUppercase?: boolean;
    includeLowercase?: boolean;
    includeNumbers?: boolean;
    includeSpecialChars?: boolean;
  } = {}
): PlainTextPassword => {
  const {
    includeUppercase = true,
    includeLowercase = true,
    includeNumbers = true,
    includeSpecialChars = true,
  } = options;

  let charset = '';
  if (includeLowercase) charset += 'abcdefghijklmnopqrstuvwxyz';
  if (includeUppercase) charset += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  if (includeNumbers) charset += '0123456789';
  if (includeSpecialChars) charset += '!@#$%^&*()_+-=[]{}|;:,.<>?';

  if (charset.length === 0) {
    throw new Error('At least one character type must be included');
  }

  // Use crypto for secure random generation
  const crypto = globalThis.crypto || require('crypto');
  const randomValues = new Uint8Array(length);
  crypto.getRandomValues(randomValues);

  let password = '';
  for (let i = 0; i < length; i++) {
    password += charset[randomValues[i] % charset.length];
  }

  return password;
};

/**
 * Masks a password for logging (shows only length)
 */
export const maskPassword = (password: string): string => {
  return '*'.repeat(password.length);
};

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Creates a password hasher function with fixed dependencies
 */
export const createPasswordHasher = (
  bcrypt: BcryptDependency,
  config: PasswordConfig = defaultPasswordConfig
) => {
  return (password: PlainTextPassword) => hashPassword(bcrypt, password, config);
};

/**
 * Creates a password verifier function with fixed dependencies
 */
export const createPasswordVerifier = (bcrypt: BcryptDependency) => {
  return (password: PlainTextPassword, hash: HashedPassword) =>
    verifyPassword(bcrypt, password, hash);
};

// ============================================================================
// Re-exports for convenience
// ============================================================================
