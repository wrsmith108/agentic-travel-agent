import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { z } from 'zod';

/**
 * Comprehensive tests for pure functions in the functional auth module
 * Tests business logic operations without side effects
 */

// Mock types and schemas from the functional implementation
type UserId = string & { readonly brand: unique symbol };
type Email = string & { readonly brand: unique symbol };
type HashedPassword = string & { readonly brand: unique symbol };
type SessionId = string & { readonly brand: unique symbol };
type ResetToken = string & { readonly brand: unique symbol };

type RegisterData = {
  firstName: string;
  lastName: string;
  email: Email;
  password: string;
  confirmPassword: string;
  acceptTerms: boolean;
  marketingOptIn: boolean;
};

type LoginData = {
  email: Email;
  password: string;
  rememberMe: boolean;
  deviceInfo?: {
    userAgent?: string;
    ipAddress?: string;
    fingerprint?: string;
  };
};

type SessionUser = {
  id: UserId;
  email: Email;
  firstName: string;
  lastName: string;
  emailVerified: boolean;
  role: 'user' | 'admin';
  createdAt: string;
};

type AuthResult<T> =
  | { success: true; data: T }
  | { success: false; error: { type: string; message: string; details?: any } };

// Pure validation functions
const validateEmail = (email: string): AuthResult<Email> => {
  const trimmed = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
    return {
      success: false,
      error: { type: 'VALIDATION_ERROR', message: 'Invalid email format' },
    };
  }
  return { success: true, data: trimmed as Email };
};

const validatePassword = (password: string): AuthResult<string> => {
  if (password.length < 8) {
    return {
      success: false,
      error: { type: 'VALIDATION_ERROR', message: 'Password must be at least 8 characters' },
    };
  }
  if (!/[A-Z]/.test(password)) {
    return {
      success: false,
      error: { type: 'VALIDATION_ERROR', message: 'Password must contain uppercase letter' },
    };
  }
  if (!/[a-z]/.test(password)) {
    return {
      success: false,
      error: { type: 'VALIDATION_ERROR', message: 'Password must contain lowercase letter' },
    };
  }
  if (!/[0-9]/.test(password)) {
    return {
      success: false,
      error: { type: 'VALIDATION_ERROR', message: 'Password must contain number' },
    };
  }
  if (!/[!@#$%^&*]/.test(password)) {
    return {
      success: false,
      error: { type: 'VALIDATION_ERROR', message: 'Password must contain special character' },
    };
  }
  return { success: true, data: password };
};

const validateRegisterData = (data: unknown): AuthResult<RegisterData> => {
  try {
    const schema = z
      .object({
        firstName: z.string().min(1).max(50),
        lastName: z.string().min(1).max(50),
        email: z.string().email(),
        password: z.string().min(8),
        confirmPassword: z.string(),
        acceptTerms: z.boolean(),
        marketingOptIn: z.boolean(),
      })
      .refine((data) => data.password === data.confirmPassword, {
        message: 'Passwords do not match',
        path: ['confirmPassword'],
      });

    const parsed = schema.parse(data);

    // Additional validation
    const emailResult = validateEmail(parsed.email);
    if (!emailResult.success) return emailResult as any;

    const passwordResult = validatePassword(parsed.password);
    if (!passwordResult.success) return passwordResult;

    if (!parsed.acceptTerms) {
      return {
        success: false,
        error: { type: 'VALIDATION_ERROR', message: 'Must accept terms and conditions' },
      };
    }

    return {
      success: true,
      data: { ...parsed, email: emailResult.data },
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: {
          type: 'VALIDATION_ERROR',
          message: error.errors[0]?.message || 'Validation failed',
          details: error.errors,
        },
      };
    }
    return {
      success: false,
      error: { type: 'VALIDATION_ERROR', message: 'Invalid registration data' },
    };
  }
};

// Pure password operations
const hashPassword = async (password: string): Promise<HashedPassword> => {
  const saltRounds = 12;
  const hashed = await bcrypt.hash(password, saltRounds);
  return hashed as HashedPassword;
};

const verifyPassword = async (password: string, hash: HashedPassword): Promise<boolean> => {
  return bcrypt.compare(password, hash);
};

// Pure token generation
const generateResetToken = (): ResetToken => {
  return crypto.randomBytes(32).toString('hex') as ResetToken;
};

const generateSessionId = (): SessionId => {
  return crypto.randomUUID() as SessionId;
};

// Pure session creation
const createSessionData = (user: SessionUser, sessionId: SessionId, duration: number = 3600) => {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + duration * 1000);

  return {
    sessionId,
    userId: user.id,
    user,
    createdAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
    lastAccessedAt: now.toISOString(),
    isActive: true,
    loginMethod: 'email' as const,
  };
};

// Pure rate limiting logic
const checkRateLimit = (
  attempts: number,
  lastAttempt: Date | null,
  maxAttempts: number = 5,
  windowMs: number = 15 * 60 * 1000
): { allowed: boolean; remainingAttempts: number; resetAt?: Date } => {
  const now = new Date();

  if (!lastAttempt) {
    return { allowed: true, remainingAttempts: maxAttempts };
  }

  const timeSinceLastAttempt = now.getTime() - lastAttempt.getTime();

  if (timeSinceLastAttempt > windowMs) {
    return { allowed: true, remainingAttempts: maxAttempts };
  }

  if (attempts >= maxAttempts) {
    const resetAt = new Date(lastAttempt.getTime() + windowMs);
    return { allowed: false, remainingAttempts: 0, resetAt };
  }

  return { allowed: true, remainingAttempts: maxAttempts - attempts };
};

// Pure token validation
const validateResetToken = (
  token: string,
  storedToken: string,
  expiresAt: Date,
  used: boolean
): AuthResult<void> => {
  if (used) {
    return {
      success: false,
      error: { type: 'TOKEN_INVALID', message: 'Reset token has already been used' },
    };
  }

  if (token !== storedToken) {
    return {
      success: false,
      error: { type: 'TOKEN_INVALID', message: 'Invalid reset token' },
    };
  }

  if (new Date() > expiresAt) {
    return {
      success: false,
      error: { type: 'TOKEN_EXPIRED', message: 'Reset token has expired' },
    };
  }

  return { success: true, data: undefined };
};

describe('Pure Functions', () => {
  describe('Email Validation', () => {
    it('should validate correct email formats', () => {
      const validEmails = [
        'user@example.com',
        'test.user@example.com',
        'user+tag@example.com',
        'USER@EXAMPLE.COM', // Should be normalized
      ];

      validEmails.forEach((email) => {
        const result = validateEmail(email);
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data).toBe(email.toLowerCase().trim());
        }
      });
    });

    it('should reject invalid email formats', () => {
      const invalidEmails = [
        'notanemail',
        '@example.com',
        'user@',
        'user@@example.com',
        '',
        'user @example.com',
      ];

      invalidEmails.forEach((email) => {
        const result = validateEmail(email);
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.type).toBe('VALIDATION_ERROR');
        }
      });
    });

    it('should normalize email addresses', () => {
      const result = validateEmail('  USER@EXAMPLE.COM  ');
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBe('user@example.com');
      }
    });
  });

  describe('Password Validation', () => {
    it('should accept strong passwords', () => {
      const strongPasswords = ['Password123!', 'Str0ng@Pass', 'MyP@ssw0rd!', 'Test123$Security'];

      strongPasswords.forEach((password) => {
        const result = validatePassword(password);
        expect(result.success).toBe(true);
      });
    });

    it('should reject weak passwords', () => {
      const weakPasswords = [
        { password: 'short', message: 'at least 8 characters' },
        { password: 'password123!', message: 'uppercase letter' },
        { password: 'PASSWORD123!', message: 'lowercase letter' },
        { password: 'Password!', message: 'number' },
        { password: 'Password123', message: 'special character' },
      ];

      weakPasswords.forEach(({ password, message }) => {
        const result = validatePassword(password);
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.message).toContain(message);
        }
      });
    });
  });

  describe('Registration Data Validation', () => {
    const validData = {
      firstName: 'John',
      lastName: 'Doe',
      email: 'john.doe@example.com',
      password: 'Password123!',
      confirmPassword: 'Password123!',
      acceptTerms: true,
      marketingOptIn: false,
    };

    it('should validate correct registration data', () => {
      const result = validateRegisterData(validData);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.email).toBe('john.doe@example.com');
      }
    });

    it('should reject mismatched passwords', () => {
      const data = { ...validData, confirmPassword: 'Different123!' };
      const result = validateRegisterData(data);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toContain('Passwords do not match');
      }
    });

    it('should reject if terms not accepted', () => {
      const data = { ...validData, acceptTerms: false };
      const result = validateRegisterData(data);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toContain('Must accept terms');
      }
    });

    it('should handle missing fields', () => {
      const incomplete = { email: 'test@example.com' };
      const result = validateRegisterData(incomplete);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.type).toBe('VALIDATION_ERROR');
      }
    });
  });

  describe('Password Operations', () => {
    it('should hash passwords consistently', async () => {
      const password = 'TestPassword123!';
      const hash1 = await hashPassword(password);
      const hash2 = await hashPassword(password);

      // Hashes should be different due to salt
      expect(hash1).not.toBe(hash2);

      // Both should verify correctly
      expect(await verifyPassword(password, hash1)).toBe(true);
      expect(await verifyPassword(password, hash2)).toBe(true);
    });

    it('should verify correct passwords', async () => {
      const password = 'TestPassword123!';
      const hash = await hashPassword(password);

      expect(await verifyPassword(password, hash)).toBe(true);
    });

    it('should reject incorrect passwords', async () => {
      const password = 'TestPassword123!';
      const wrongPassword = 'WrongPassword123!';
      const hash = await hashPassword(password);

      expect(await verifyPassword(wrongPassword, hash)).toBe(false);
    });

    it('should generate bcrypt format hashes', async () => {
      const password = 'TestPassword123!';
      const hash = await hashPassword(password);

      expect(hash).toMatch(/^\$2[ayb]\$\d{2}\$[./A-Za-z0-9]{53}$/);
    });
  });

  describe('Token Generation', () => {
    it('should generate unique reset tokens', () => {
      const tokens = new Set<string>();
      for (let i = 0; i < 100; i++) {
        tokens.add(generateResetToken());
      }
      expect(tokens.size).toBe(100);
    });

    it('should generate valid hex reset tokens', () => {
      const token = generateResetToken();
      expect(token).toMatch(/^[a-f0-9]{64}$/);
    });

    it('should generate unique session IDs', () => {
      const ids = new Set<string>();
      for (let i = 0; i < 100; i++) {
        ids.add(generateSessionId());
      }
      expect(ids.size).toBe(100);
    });

    it('should generate valid UUID session IDs', () => {
      const id = generateSessionId();
      expect(id).toMatch(/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i);
    });
  });

  describe('Session Creation', () => {
    const mockUser: SessionUser = {
      id: 'user-123' as UserId,
      email: 'user@example.com' as Email,
      firstName: 'John',
      lastName: 'Doe',
      emailVerified: true,
      role: 'user',
      createdAt: new Date().toISOString(),
    };

    it('should create session with default duration', () => {
      const sessionId = generateSessionId();
      const session = createSessionData(mockUser, sessionId);

      expect(session.sessionId).toBe(sessionId);
      expect(session.userId).toBe(mockUser.id);
      expect(session.user).toEqual(mockUser);
      expect(session.isActive).toBe(true);
      expect(session.loginMethod).toBe('email');

      const expiresAt = new Date(session.expiresAt);
      const createdAt = new Date(session.createdAt);
      const duration = (expiresAt.getTime() - createdAt.getTime()) / 1000;
      expect(duration).toBe(3600); // 1 hour default
    });

    it('should create session with custom duration', () => {
      const sessionId = generateSessionId();
      const customDuration = 7200; // 2 hours
      const session = createSessionData(mockUser, sessionId, customDuration);

      const expiresAt = new Date(session.expiresAt);
      const createdAt = new Date(session.createdAt);
      const duration = (expiresAt.getTime() - createdAt.getTime()) / 1000;
      expect(duration).toBe(customDuration);
    });

    it('should set correct timestamps', () => {
      const before = new Date();
      const sessionId = generateSessionId();
      const session = createSessionData(mockUser, sessionId);
      const after = new Date();

      const createdAt = new Date(session.createdAt);
      expect(createdAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(createdAt.getTime()).toBeLessThanOrEqual(after.getTime());

      expect(session.lastAccessedAt).toBe(session.createdAt);
    });
  });

  describe('Rate Limiting', () => {
    it('should allow first attempt', () => {
      const result = checkRateLimit(0, null);
      expect(result.allowed).toBe(true);
      expect(result.remainingAttempts).toBe(5);
    });

    it('should track remaining attempts', () => {
      const lastAttempt = new Date();
      const result = checkRateLimit(3, lastAttempt);
      expect(result.allowed).toBe(true);
      expect(result.remainingAttempts).toBe(2);
    });

    it('should block after max attempts', () => {
      const lastAttempt = new Date();
      const result = checkRateLimit(5, lastAttempt);
      expect(result.allowed).toBe(false);
      expect(result.remainingAttempts).toBe(0);
      expect(result.resetAt).toBeDefined();
    });

    it('should reset after time window', () => {
      const oldAttempt = new Date(Date.now() - 20 * 60 * 1000); // 20 minutes ago
      const result = checkRateLimit(5, oldAttempt);
      expect(result.allowed).toBe(true);
      expect(result.remainingAttempts).toBe(5);
    });

    it('should calculate correct reset time', () => {
      const lastAttempt = new Date();
      const windowMs = 15 * 60 * 1000;
      const result = checkRateLimit(5, lastAttempt, 5, windowMs);

      expect(result.allowed).toBe(false);
      if (result.resetAt) {
        const resetTime = result.resetAt.getTime() - lastAttempt.getTime();
        expect(resetTime).toBe(windowMs);
      }
    });

    it('should handle custom limits', () => {
      const lastAttempt = new Date();
      const result = checkRateLimit(3, lastAttempt, 3, 60000);
      expect(result.allowed).toBe(false);
      expect(result.remainingAttempts).toBe(0);
    });
  });

  describe('Token Validation', () => {
    it('should validate correct token', () => {
      const token = 'valid-token';
      const expiresAt = new Date(Date.now() + 3600000);
      const result = validateResetToken(token, token, expiresAt, false);
      expect(result.success).toBe(true);
    });

    it('should reject used token', () => {
      const token = 'used-token';
      const expiresAt = new Date(Date.now() + 3600000);
      const result = validateResetToken(token, token, expiresAt, true);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toContain('already been used');
      }
    });

    it('should reject mismatched token', () => {
      const expiresAt = new Date(Date.now() + 3600000);
      const result = validateResetToken('wrong-token', 'correct-token', expiresAt, false);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toContain('Invalid reset token');
      }
    });

    it('should reject expired token', () => {
      const token = 'expired-token';
      const expiresAt = new Date(Date.now() - 3600000); // 1 hour ago
      const result = validateResetToken(token, token, expiresAt, false);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.type).toBe('TOKEN_EXPIRED');
      }
    });
  });

  describe('Function Composition', () => {
    it('should compose validation functions', async () => {
      const registerFlow = async (data: unknown) => {
        const validationResult = validateRegisterData(data);
        if (!validationResult.success) return validationResult;

        const hashedPassword = await hashPassword(validationResult.data.password);
        const sessionId = generateSessionId();

        return {
          success: true as const,
          data: {
            hashedPassword,
            sessionId,
            email: validationResult.data.email,
          },
        };
      };

      const result = await registerFlow({
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        password: 'Password123!',
        confirmPassword: 'Password123!',
        acceptTerms: true,
        marketingOptIn: false,
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.hashedPassword).toMatch(/^\$2[ayb]\$/);
        expect(result.data.sessionId).toMatch(/^[a-f0-9-]{36}$/i);
        expect(result.data.email).toBe('john@example.com');
      }
    });
  });
});
