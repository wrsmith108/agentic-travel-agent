/**
 * Functional Auth Service Tests
 *
 * MVP Testing Note:
 * These tests currently access private implementation details for comprehensive testing.
 * For production, refactor to test only through public API as per TDD best practices.
 */

import { authService } from '../index';
import {
  ok,
  err,
  isOk,
  isErr,
  createEmail,
  createUserId,
  createSessionId,
  type RegisterInput,
  type LoginInput,
  type AuthError,
} from '../types';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';

// Mock dependencies
jest.mock('bcryptjs');
jest.mock('jsonwebtoken');
jest.mock('@/utils/logger');

describe('Functional Auth Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Registration', () => {
    const validRegisterInput: RegisterInput = {
      firstName: 'John',
      lastName: 'Doe',
      email: 'john.doe@example.com',
      password: 'SecurePassword123!',
      confirmPassword: 'SecurePassword123!',
      acceptTerms: true,
      marketingOptIn: false,
    };

    it('should successfully register a new user', async () => {
      // Mock bcrypt
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashedPassword123');

      const result = await authService.register(validRegisterInput);

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value.user.email).toBe(validRegisterInput.email);
        expect(result.value.user.firstName).toBe(validRegisterInput.firstName);
        expect(result.value.sessionId).toBeDefined();
        expect(result.value.tokens.accessToken).toBeDefined();
      }
    });

    it('should fail registration when passwords do not match', async () => {
      const invalidInput = {
        ...validRegisterInput,
        confirmPassword: 'DifferentPassword123!',
      };

      const result = await authService.register(invalidInput);

      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error.type).toBe('VALIDATION_ERROR');
        expect(result.error.message).toContain('Passwords do not match');
      }
    });

    it('should fail registration with invalid email', async () => {
      const invalidInput = {
        ...validRegisterInput,
        email: 'invalid-email',
      };

      const result = await authService.register(invalidInput);

      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error.type).toBe('VALIDATION_ERROR');
      }
    });

    it('should fail registration when user already exists', async () => {
      // First registration succeeds
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashedPassword123');
      await authService.register(validRegisterInput);

      // Second registration with same email should fail
      const result = await authService.register(validRegisterInput);

      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error.type).toBe('USER_ALREADY_EXISTS');
      }
    });
  });

  describe('Login', () => {
    const validLoginInput: LoginInput = {
      email: 'john.doe@example.com',
      password: 'SecurePassword123!',
      rememberMe: false,
    };

    beforeEach(async () => {
      // Register a user for login tests
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashedPassword123');
      await authService.register({
        firstName: 'John',
        lastName: 'Doe',
        email: validLoginInput.email,
        password: validLoginInput.password,
        confirmPassword: validLoginInput.password,
        acceptTerms: true,
        marketingOptIn: false,
      });
    });

    it('should successfully login with valid credentials', async () => {
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      const result = await authService.login(validLoginInput);

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value.user.email).toBe(validLoginInput.email);
        expect(result.value.sessionId).toBeDefined();
        expect(result.value.tokens.accessToken).toBeDefined();
      }
    });

    it('should fail login with invalid password', async () => {
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      const result = await authService.login({
        ...validLoginInput,
        password: 'WrongPassword123!',
      });

      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error.type).toBe('INVALID_CREDENTIALS');
      }
    });

    it('should fail login with non-existent user', async () => {
      const result = await authService.login({
        ...validLoginInput,
        email: 'nonexistent@example.com',
      });

      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error.type).toBe('USER_NOT_FOUND');
      }
    });

    it('should create longer session when rememberMe is true', async () => {
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      const result = await authService.login({
        ...validLoginInput,
        rememberMe: true,
      });

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value.tokens.refreshToken).toBeDefined();
      }
    });
  });

  describe('Logout', () => {
    it('should successfully logout a session', async () => {
      // First login
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashedPassword123');
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      const registerResult = await authService.register({
        firstName: 'John',
        lastName: 'Doe',
        email: 'john.doe@example.com',
        password: 'SecurePassword123!',
        confirmPassword: 'SecurePassword123!',
        acceptTerms: true,
        marketingOptIn: false,
      });

      if (isOk(registerResult)) {
        const logoutResult = await authService.logout({
          sessionId: registerResult.value.sessionId,
        });

        expect(isOk(logoutResult)).toBe(true);
        if (isOk(logoutResult)) {
          expect(logoutResult.value).toBe(true);
        }
      }
    });

    it('should handle logout of non-existent session', async () => {
      const result = await authService.logout({
        sessionId: createSessionId(uuidv4()),
      });

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value).toBe(false);
      }
    });
  });

  describe('Session Validation', () => {
    it('should validate an active session', async () => {
      // Register and get session
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashedPassword123');
      const registerResult = await authService.register({
        firstName: 'John',
        lastName: 'Doe',
        email: 'john.doe@example.com',
        password: 'SecurePassword123!',
        confirmPassword: 'SecurePassword123!',
        acceptTerms: true,
        marketingOptIn: false,
      });

      if (isOk(registerResult)) {
        const validateResult = await authService.validateSession({
          sessionId: registerResult.value.sessionId,
        });

        expect(isOk(validateResult)).toBe(true);
        if (isOk(validateResult)) {
          expect(validateResult.value?.email).toBe('john.doe@example.com');
        }
      }
    });

    it('should return null for invalid session', async () => {
      const result = await authService.validateSession({
        sessionId: createSessionId(uuidv4()),
      });

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value).toBeNull();
      }
    });
  });

  describe('Result Pattern Error Handling', () => {
    it('should return typed errors for validation failures', async () => {
      const invalidInput = {
        firstName: '',
        lastName: '',
        email: 'invalid',
        password: 'weak',
        confirmPassword: 'different',
        acceptTerms: false,
        marketingOptIn: false,
      };

      const result = await authService.register(invalidInput);

      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error.type).toBe('VALIDATION_ERROR');
        expect(result.error.details).toBeDefined();
      }
    });

    it('should handle server errors gracefully', async () => {
      // Mock bcrypt to throw an error
      (bcrypt.hash as jest.Mock).mockRejectedValue(new Error('Bcrypt error'));

      const result = await authService.register({
        firstName: 'John',
        lastName: 'Doe',
        email: 'john.doe@example.com',
        password: 'SecurePassword123!',
        confirmPassword: 'SecurePassword123!',
        acceptTerms: true,
        marketingOptIn: false,
      });

      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error.type).toBe('SERVER_ERROR');
      }
    });
  });

  describe('Rate Limiting', () => {
    it('should lock account after max failed login attempts', async () => {
      const email = 'ratelimit@example.com';

      // Register user
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashedPassword123');
      await authService.register({
        firstName: 'Rate',
        lastName: 'Limit',
        email,
        password: 'SecurePassword123!',
        confirmPassword: 'SecurePassword123!',
        acceptTerms: true,
        marketingOptIn: false,
      });

      // Always fail password check
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      // Attempt login 5 times (max attempts)
      for (let i = 0; i < 5; i++) {
        await authService.login({
          email,
          password: 'WrongPassword',
          rememberMe: false,
        });
      }

      // Next attempt should be rate limited
      const result = await authService.login({
        email,
        password: 'WrongPassword',
        rememberMe: false,
      });

      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error.type).toBe('RATE_LIMIT_EXCEEDED');
      }
    });
  });
});
