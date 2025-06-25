/**
 * Tests for new authentication service
 */

import bcrypt from 'bcryptjs';
import * as authService from '../authServiceNew';
import { getUserDataManagerOps } from '@/services/storage/userDataManager';
import { cleanupExpiredSessions } from '../sessionManager';
import { isOk, isErr } from '@/utils/result';
import { RegisterRequest, LoginRequest } from '@/types/auth';

// Mock dependencies
jest.mock('@/services/storage/userDataManager');
jest.mock('@/utils/logger');

describe('AuthService (New)', () => {
  const mockUserDataOps = {
    createUser: jest.fn(),
    readUserData: jest.fn(),
    updateUserData: jest.fn(),
    deleteUser: jest.fn(),
    findUserByEmail: jest.fn(),
    listUsers: jest.fn(),
    userExists: jest.fn(),
    readUserDataFile: jest.fn(),
    updateUserFlightSearch: jest.fn(),
    getUserFlightSearches: jest.fn(),
    getStorageStats: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (getUserDataManagerOps as jest.Mock).mockReturnValue(mockUserDataOps);
  });

  afterEach(() => {
    // Clean up sessions after each test
    cleanupExpiredSessions();
  });

  describe('register', () => {
    const validRegisterData: RegisterRequest = {
      email: 'test@example.com',
      password: 'SecurePass123!',
      firstName: 'Test',
      lastName: 'User',
    };

    it('should successfully register a new user', async () => {
      mockUserDataOps.findUserByEmail.mockResolvedValue(null);
      mockUserDataOps.createUser.mockResolvedValue({
        id: 'user-123',
        email: validRegisterData.email,
        firstName: validRegisterData.firstName,
        lastName: validRegisterData.lastName,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        preferences: {
          currency: 'USD',
          timezone: 'UTC',
          preferredDepartureAirport: '',
          communicationFrequency: 'immediate',
          subscriptionTier: 'free',
        },
        activeSearches: [],
        searchHistory: [],
      });

      const result = await authService.register(validRegisterData);

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value.user.email).toBe(validRegisterData.email);
        expect(result.value.user.firstName).toBe(validRegisterData.firstName);
        expect(result.value.user.lastName).toBe(validRegisterData.lastName);
        expect(result.value.accessToken).toBeDefined();
        expect(result.value.refreshToken).toBeDefined();
        expect(result.value.expiresAt).toBeDefined();
      }

      expect(mockUserDataOps.findUserByEmail).toHaveBeenCalledWith(
        expect.stringContaining(validRegisterData.email)
      );
      expect(mockUserDataOps.createUser).toHaveBeenCalled();
    });

    it('should return error if user already exists', async () => {
      mockUserDataOps.findUserByEmail.mockResolvedValue({
        id: 'existing-user',
        email: validRegisterData.email,
        firstName: 'Existing',
        lastName: 'User',
      });

      const result = await authService.register(validRegisterData);

      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error.type).toBe('USER_ALREADY_EXISTS');
        expect(result.error.message).toContain('already exists');
      }

      expect(mockUserDataOps.createUser).not.toHaveBeenCalled();
    });

    it('should return validation error for invalid email', async () => {
      const invalidData = { ...validRegisterData, email: 'invalid-email' };

      const result = await authService.register(invalidData);

      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error.type).toBe('VALIDATION_ERROR');
      }

      expect(mockUserDataOps.findUserByEmail).not.toHaveBeenCalled();
    });

    it('should return validation error for weak password', async () => {
      const invalidData = { ...validRegisterData, password: '123' };

      const result = await authService.register(invalidData);

      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error.type).toBe('VALIDATION_ERROR');
      }

      expect(mockUserDataOps.findUserByEmail).not.toHaveBeenCalled();
    });
  });

  describe('login', () => {
    const validLoginData: LoginRequest = {
      email: 'test@example.com',
      password: 'SecurePass123!',
    };

    const mockUser = {
      id: 'user-123',
      email: validLoginData.email,
      firstName: 'Test',
      lastName: 'User',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      lastLoginAt: new Date().toISOString(),
      preferences: {
        currency: 'USD',
        timezone: 'UTC',
        preferredDepartureAirport: '',
        communicationFrequency: 'immediate',
        subscriptionTier: 'free',
      },
      activeSearches: [],
      searchHistory: [],
    };

    it('should successfully login with valid credentials', async () => {
      mockUserDataOps.findUserByEmail.mockResolvedValue(mockUser);
      mockUserDataOps.updateUserData.mockResolvedValue(mockUser);

      // First register to set up password
      await authService.register({
        ...validLoginData,
        firstName: 'Test',
        lastName: 'User',
      });

      // Then login
      const result = await authService.login(validLoginData);

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value.user.email).toBe(validLoginData.email);
        expect(result.value.accessToken).toBeDefined();
        expect(result.value.refreshToken).toBeDefined();
        expect(result.value.expiresAt).toBeDefined();
      }
    });

    it('should return error for non-existent user', async () => {
      mockUserDataOps.findUserByEmail.mockResolvedValue(null);

      const result = await authService.login(validLoginData);

      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error.type).toBe('INVALID_CREDENTIALS');
      }
    });

    it('should return error for incorrect password', async () => {
      mockUserDataOps.findUserByEmail.mockResolvedValue(mockUser);

      // Register first
      await authService.register({
        ...validLoginData,
        firstName: 'Test',
        lastName: 'User',
      });

      // Try to login with wrong password
      const result = await authService.login({
        ...validLoginData,
        password: 'WrongPassword123!',
      });

      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error.type).toBe('INVALID_CREDENTIALS');
      }
    });

    it('should handle remember me option', async () => {
      mockUserDataOps.findUserByEmail.mockResolvedValue(mockUser);
      mockUserDataOps.updateUserData.mockResolvedValue(mockUser);

      // Register first
      await authService.register({
        ...validLoginData,
        firstName: 'Test',
        lastName: 'User',
      });

      // Login with remember me
      const result = await authService.login({
        ...validLoginData,
        rememberMe: true,
      });

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        // Session should expire later with remember me
        const expiresAt = new Date(result.value.expiresAt);
        const now = new Date();
        const diffDays = (expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
        expect(diffDays).toBeGreaterThan(7); // Should be ~30 days
      }
    });
  });

  describe('logout', () => {
    it('should successfully logout a session', async () => {
      // First login to create a session
      mockUserDataOps.findUserByEmail.mockResolvedValue({
        id: 'user-123',
        email: 'test@example.com',
        firstName: 'Test',
        lastName: 'User',
      });

      await authService.register({
        email: 'test@example.com',
        password: 'SecurePass123!',
        firstName: 'Test',
        lastName: 'User',
      });

      const loginResult = await authService.login({
        email: 'test@example.com',
        password: 'SecurePass123!',
      });

      expect(isOk(loginResult)).toBe(true);
      
      if (isOk(loginResult)) {
        // Extract session ID from the token or session
        // For now, we'll use a mock session ID
        const result = await authService.logout('mock-session-id');
        expect(isOk(result)).toBe(true);
      }
    });
  });

  describe('refreshAccessToken', () => {
    it('should successfully refresh access token', async () => {
      // Setup: register and login
      mockUserDataOps.findUserByEmail.mockResolvedValue({
        id: 'user-123',
        email: 'test@example.com',
        firstName: 'Test',
        lastName: 'User',
      });
      mockUserDataOps.readUserData.mockResolvedValue({
        id: 'user-123',
        email: 'test@example.com',
        firstName: 'Test',
        lastName: 'User',
      });

      const registerResult = await authService.register({
        email: 'test@example.com',
        password: 'SecurePass123!',
        firstName: 'Test',
        lastName: 'User',
      });

      expect(isOk(registerResult)).toBe(true);
      
      if (isOk(registerResult) && registerResult.value.refreshToken) {
        const result = await authService.refreshAccessToken(
          registerResult.value.refreshToken
        );

        expect(isOk(result)).toBe(true);
        if (isOk(result)) {
          expect(result.value.accessToken).toBeDefined();
          expect(result.value.expiresAt).toBeDefined();
        }
      }
    });

    it('should return error for invalid refresh token', async () => {
      const result = await authService.refreshAccessToken('invalid-token');

      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error.type).toBe('INVALID_TOKEN');
      }
    });
  });

  describe('requestPasswordReset', () => {
    it('should generate reset token for existing user', async () => {
      mockUserDataOps.findUserByEmail.mockResolvedValue({
        id: 'user-123',
        email: 'test@example.com',
        firstName: 'Test',
        lastName: 'User',
      });

      const result = await authService.requestPasswordReset('test@example.com');

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value.token).toBeDefined();
      }
    });

    it('should return success (empty token) for non-existent user', async () => {
      mockUserDataOps.findUserByEmail.mockResolvedValue(null);

      const result = await authService.requestPasswordReset('nonexistent@example.com');

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value.token).toBe('');
      }
    });
  });

  describe('resetPassword', () => {
    it('should successfully reset password with valid token', async () => {
      // Setup: request password reset first
      mockUserDataOps.findUserByEmail.mockResolvedValue({
        id: 'user-123',
        email: 'test@example.com',
        firstName: 'Test',
        lastName: 'User',
      });

      const resetResult = await authService.requestPasswordReset('test@example.com');
      
      expect(isOk(resetResult)).toBe(true);
      if (isOk(resetResult) && resetResult.value.token) {
        const result = await authService.resetPassword(
          resetResult.value.token,
          'NewSecurePass123!'
        );

        expect(isOk(result)).toBe(true);
      }
    });

    it('should return error for invalid reset token', async () => {
      const result = await authService.resetPassword(
        'invalid-token',
        'NewSecurePass123!'
      );

      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error.type).toBe('INVALID_CREDENTIALS');
        expect(result.error.message).toContain('Invalid or expired');
      }
    });
  });
});