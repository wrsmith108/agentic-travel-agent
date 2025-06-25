import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { authService } from '../index';
import { ok, err, isOk, isErr } from '../types';
import type { Result, AuthError, SessionId, UserId, Email } from '../types';

describe('Functional Auth Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('register', () => {
    it('should successfully register a new user', async () => {
      const input = {
        email: 'test@example.com',
        password: 'SecurePass123!',
        firstName: 'John',
        lastName: 'Doe',
      };

      const result = await authService.register(input);

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value.user.email).toBe(input.email as Email);
        expect(result.value.user.firstName).toBe(input.firstName);
        expect(result.value.user.lastName).toBe(input.lastName);
        expect(result.value.user.emailVerified).toBe(false);
        expect(result.value.user.role).toBe('user');
        expect(result.value.tokens.accessToken).toBeDefined();
        expect(result.value.tokens.refreshToken).toBeDefined();
        expect(result.value.session.sessionId).toBeDefined();
      }
    });

    it('should handle registration without optional fields', async () => {
      const input = {
        email: 'minimal@example.com',
        password: 'SecurePass123!',
      };

      const result = await authService.register(input);

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value.user.firstName).toBe('');
        expect(result.value.user.lastName).toBe('');
      }
    });

    it('should fail registration with invalid email', async () => {
      const input = {
        email: 'invalid-email',
        password: 'SecurePass123!',
      };

      const result = await authService.register(input);

      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error.type).toBe('VALIDATION_ERROR');
        expect(result.error.message).toContain('Invalid email format');
      }
    });

    it('should fail registration with weak password', async () => {
      const input = {
        email: 'test@example.com',
        password: '123', // Too short
      };

      const result = await authService.register(input);

      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error.type).toBe('VALIDATION_ERROR');
        expect(result.error.message).toContain('Password must be at least');
      }
    });

    it('should fail registration when user already exists', async () => {
      const input = {
        email: 'existing@example.com',
        password: 'SecurePass123!',
      };

      // First registration should succeed
      const firstResult = await authService.register(input);
      expect(isOk(firstResult)).toBe(true);

      // Second registration with same email should fail
      const secondResult = await authService.register(input);
      expect(isErr(secondResult)).toBe(true);
      if (isErr(secondResult)) {
        expect(secondResult.error.type).toBe('USER_ALREADY_EXISTS');
      }
    });
  });

  describe('login', () => {
    const testUser = {
      email: 'login@example.com',
      password: 'SecurePass123!',
    };

    beforeEach(async () => {
      // Register a test user
      await authService.register(testUser);
    });

    it('should successfully login with valid credentials', async () => {
      const result = await authService.login({
        email: testUser.email,
        password: testUser.password,
      });

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value.user.email).toBe(testUser.email as Email);
        expect(result.value.tokens.accessToken).toBeDefined();
        expect(result.value.tokens.refreshToken).toBeDefined();
        expect(result.value.session.sessionId).toBeDefined();
      }
    });

    it('should support remember me option', async () => {
      const result = await authService.login({
        email: testUser.email,
        password: testUser.password,
        rememberMe: true,
      });

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        // Session should have longer expiry with remember me
        expect(result.value.session.expiresAt).toBeDefined();
      }
    });

    it('should include IP address and user agent when provided', async () => {
      const result = await authService.login({
        email: testUser.email,
        password: testUser.password,
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0',
      });

      expect(isOk(result)).toBe(true);
    });

    it('should fail login with invalid email', async () => {
      const result = await authService.login({
        email: 'wrong@example.com',
        password: testUser.password,
      });

      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error.type).toBe('INVALID_CREDENTIALS');
      }
    });

    it('should fail login with invalid password', async () => {
      const result = await authService.login({
        email: testUser.email,
        password: 'WrongPassword123!',
      });

      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error.type).toBe('INVALID_CREDENTIALS');
      }
    });

    it('should handle rate limiting after multiple failed attempts', async () => {
      // Simulate multiple failed login attempts
      for (let i = 0; i < 6; i++) {
        await authService.login({
          email: testUser.email,
          password: 'WrongPassword',
        });
      }

      // Next attempt should be rate limited
      const result = await authService.login({
        email: testUser.email,
        password: testUser.password,
      });

      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error.type).toBe('RATE_LIMIT_EXCEEDED');
        expect(result.error.retryAfter).toBeDefined();
      }
    });
  });

  describe('logout', () => {
    let sessionId: SessionId;

    beforeEach(async () => {
      // Register and login to get a session
      const user = {
        email: 'logout@example.com',
        password: 'SecurePass123!',
      };
      await authService.register(user);
      const loginResult = await authService.login(user);
      if (isOk(loginResult)) {
        sessionId = loginResult.value.session.sessionId;
      }
    });

    it('should successfully logout a session', async () => {
      const result = await authService.logout({ sessionId });

      expect(isOk(result)).toBe(true);

      // Verify session is invalid after logout
      const validateResult = await authService.validateSession({ sessionId });
      expect(isErr(validateResult)).toBe(true);
      if (isErr(validateResult)) {
        expect(validateResult.error.type).toBe('SESSION_EXPIRED');
      }
    });

    it('should support logout from all sessions', async () => {
      // Create multiple sessions
      const user = {
        email: 'logoutall@example.com',
        password: 'SecurePass123!',
      };
      await authService.register(user);

      const session1 = await authService.login(user);
      const session2 = await authService.login(user);

      if (isOk(session1) && isOk(session2)) {
        // Logout all sessions
        const result = await authService.logout({
          sessionId: session1.value.session.sessionId,
          logoutAll: true,
        });

        expect(isOk(result)).toBe(true);

        // Verify both sessions are invalid
        const validate1 = await authService.validateSession({
          sessionId: session1.value.session.sessionId,
        });
        const validate2 = await authService.validateSession({
          sessionId: session2.value.session.sessionId,
        });

        expect(isErr(validate1)).toBe(true);
        expect(isErr(validate2)).toBe(true);
      }
    });

    it('should fail logout with invalid session', async () => {
      const result = await authService.logout({
        sessionId: 'invalid-session-id' as SessionId,
      });

      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error.type).toBe('SESSION_EXPIRED');
      }
    });
  });

  describe('validateSession', () => {
    let sessionId: SessionId;

    beforeEach(async () => {
      // Register and login to get a session
      const user = {
        email: 'validate@example.com',
        password: 'SecurePass123!',
      };
      await authService.register(user);
      const loginResult = await authService.login(user);
      if (isOk(loginResult)) {
        sessionId = loginResult.value.session.sessionId;
      }
    });

    it('should successfully validate an active session', async () => {
      const result = await authService.validateSession({ sessionId });

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value.sessionId).toBe(sessionId);
        expect(result.value.userId).toBeDefined();
        expect(result.value.expiresAt).toBeDefined();
      }
    });

    it('should update last accessed time when requested', async () => {
      const result = await authService.validateSession({
        sessionId,
        updateLastAccessed: true,
      });

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value.lastAccessedAt).toBeDefined();
      }
    });

    it('should fail validation for invalid session', async () => {
      const result = await authService.validateSession({
        sessionId: 'invalid-session' as SessionId,
      });

      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error.type).toBe('SESSION_EXPIRED');
      }
    });

    it('should fail validation for logged out session', async () => {
      // Logout the session
      await authService.logout({ sessionId });

      // Try to validate
      const result = await authService.validateSession({ sessionId });

      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error.type).toBe('SESSION_EXPIRED');
      }
    });
  });

  describe('cleanup', () => {
    it('should execute cleanup without errors', async () => {
      // This should not throw
      await expect(authService.cleanup()).resolves.not.toThrow();
    });
  });
});
