import { AuthService } from '../authService';
import { UserDataManager } from '@/services/storage/userDataManager';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import {
  RegisterRequest,
  LoginRequest,
  PasswordResetRequest,
  PasswordResetConfirm,
  ChangePassword,
  SessionUser,
  AUTH_CONSTANTS,
} from '@/schemas/auth';
import { UserProfile } from '@/schemas/user';

// Mock dependencies
jest.mock('@/services/storage/userDataManager');
jest.mock('bcryptjs');
jest.mock('jsonwebtoken');
jest.mock('@/utils/logger');

describe('AuthService', () => {
  let authService: AuthService;
  let mockUserDataManager: jest.Mocked<UserDataManager>;
  let passwordStorage: Map<string, string>;

  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();

    // Create mock user data manager
    mockUserDataManager = new UserDataManager() as jest.Mocked<UserDataManager>;

    // Create auth service with mocked dependencies
    authService = new AuthService(mockUserDataManager);

    // Create a reference to the private password storage
    passwordStorage = new Map<string, string>();

    // Mock the private methods using spyOn
    jest
      .spyOn(authService as any, 'storeUserPassword')
      .mockImplementation(async (userId: string, hashedPassword: string) => {
        passwordStorage.set(userId, hashedPassword);
      });

    jest
      .spyOn(authService as any, 'getUserPasswordHash')
      .mockImplementation(async (userId: string) => {
        return passwordStorage.get(userId) || null;
      });
  });

  describe('User Registration', () => {
    const validRegisterRequest: RegisterRequest = {
      firstName: 'John',
      lastName: 'Doe',
      email: 'john.doe@example.com',
      password: 'SecurePassword123!',
      confirmPassword: 'SecurePassword123!',
      acceptTerms: true,
      marketingOptIn: false,
    };

    const mockUserProfile: UserProfile = {
      id: uuidv4(),
      firstName: 'John',
      lastName: 'Doe',
      email: 'john.doe@example.com',
      preferences: {
        currency: 'CAD',
        timezone: 'America/Toronto',
        preferredDepartureAirport: 'YYZ',
        communicationFrequency: 'daily',
        subscriptionTier: 'free',
      },
      activeSearches: [],
      searchHistory: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    it('should successfully register a new user', async () => {
      // Mock user doesn't exist
      mockUserDataManager.findUserByEmail.mockResolvedValue(null);

      // Mock password hashing
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashedPassword123');

      // Mock user creation
      mockUserDataManager.createUser.mockResolvedValue(mockUserProfile);

      // Mock JWT signing
      (jwt.sign as jest.Mock).mockReturnValue('mockAccessToken');

      const result = await authService.registerUser(validRegisterRequest);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.user.email).toBe(validRegisterRequest.email);
        expect(result.data.accessToken).toBe('mockAccessToken');
        expect(result.data.sessionId).toBeDefined();
      }

      // Verify password was hashed
      expect(bcrypt.hash).toHaveBeenCalledWith(validRegisterRequest.password, 12);

      // Verify user was created
      expect(mockUserDataManager.createUser).toHaveBeenCalled();
    });

    it('should fail registration if user already exists', async () => {
      // Mock user already exists
      mockUserDataManager.findUserByEmail.mockResolvedValue(mockUserProfile);

      const result = await authService.registerUser(validRegisterRequest);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.type).toBe('USER_ALREADY_EXISTS');
        expect(result.error.message).toContain('already exists');
      }

      // Verify user creation was not attempted
      expect(mockUserDataManager.createUser).not.toHaveBeenCalled();
    });

    it('should fail registration with invalid data', async () => {
      const invalidRequest = {
        ...validRegisterRequest,
        email: 'invalid-email',
      };

      const result = await authService.registerUser(invalidRequest);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.type).toBe('VALIDATION_ERROR');
      }
    });

    it('should fail registration when passwords do not match', async () => {
      const invalidRequest = {
        ...validRegisterRequest,
        confirmPassword: 'DifferentPassword123!',
      };

      const result = await authService.registerUser(invalidRequest);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.type).toBe('VALIDATION_ERROR');
        expect(result.error.message).toContain('Passwords do not match');
      }
    });
  });

  describe('User Login', () => {
    const validLoginRequest: LoginRequest = {
      email: 'john.doe@example.com',
      password: 'SecurePassword123!',
      rememberMe: false,
    };

    const mockUserProfile: UserProfile = {
      id: uuidv4(),
      firstName: 'John',
      lastName: 'Doe',
      email: 'john.doe@example.com',
      preferences: {
        currency: 'CAD',
        timezone: 'America/Toronto',
        preferredDepartureAirport: 'YYZ',
        communicationFrequency: 'daily',
        subscriptionTier: 'free',
      },
      activeSearches: [],
      searchHistory: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    it('should successfully login with valid credentials', async () => {
      // Mock user exists
      mockUserDataManager.findUserByEmail.mockResolvedValue(mockUserProfile);

      // Store a hashed password for the user
      const hashedPassword = 'hashedPassword123';
      passwordStorage.set(mockUserProfile.id, hashedPassword);

      // Mock password comparison
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      // Mock JWT signing
      (jwt.sign as jest.Mock).mockReturnValue('mockAccessToken');

      const result = await authService.loginUser(validLoginRequest);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.user.email).toBe(validLoginRequest.email);
        expect(result.data.accessToken).toBe('mockAccessToken');
        expect(result.data.sessionId).toBeDefined();
      }

      // Verify password was compared
      expect(bcrypt.compare).toHaveBeenCalledWith(validLoginRequest.password, hashedPassword);
    });

    it('should fail login with invalid email', async () => {
      // Mock user doesn't exist
      mockUserDataManager.findUserByEmail.mockResolvedValue(null);

      const result = await authService.loginUser(validLoginRequest);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.type).toBe('INVALID_CREDENTIALS');
        expect(result.error.message).toBe('Invalid email or password');
      }
    });

    it('should fail login with invalid password', async () => {
      // Mock user exists
      mockUserDataManager.findUserByEmail.mockResolvedValue(mockUserProfile);

      // Store a hashed password for the user
      const hashedPassword = 'hashedPassword123';
      passwordStorage.set(mockUserProfile.id, hashedPassword);

      // Mock password comparison fails
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      const result = await authService.loginUser(validLoginRequest);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.type).toBe('INVALID_CREDENTIALS');
        expect(result.error.message).toBe('Invalid email or password');
      }
    });

    it('should create longer session when rememberMe is true', async () => {
      // Mock user exists
      mockUserDataManager.findUserByEmail.mockResolvedValue(mockUserProfile);

      // Store a hashed password for the user
      const hashedPassword = 'hashedPassword123';
      passwordStorage.set(mockUserProfile.id, hashedPassword);

      // Mock password comparison
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      // Mock JWT signing
      (jwt.sign as jest.Mock).mockReturnValue('mockAccessToken');

      const rememberMeRequest = {
        ...validLoginRequest,
        rememberMe: true,
      };

      const result = await authService.loginUser(rememberMeRequest);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.refreshToken).toBeDefined();
      }
    });
  });

  describe('Password Reset', () => {
    const mockUserProfile: UserProfile = {
      id: uuidv4(),
      firstName: 'John',
      lastName: 'Doe',
      email: 'john.doe@example.com',
      preferences: {
        currency: 'CAD',
        timezone: 'America/Toronto',
        preferredDepartureAirport: 'YYZ',
        communicationFrequency: 'daily',
        subscriptionTier: 'free',
      },
      activeSearches: [],
      searchHistory: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    describe('Request Password Reset', () => {
      const validResetRequest: PasswordResetRequest = {
        email: 'john.doe@example.com',
      };

      it('should generate reset token for existing user', async () => {
        // Mock user exists
        mockUserDataManager.findUserByEmail.mockResolvedValue(mockUserProfile);

        const result = await authService.requestPasswordReset(validResetRequest);

        expect(result.success).toBe(true);
        expect(result.message).toContain('reset token generated');
        expect(result.token).toBeDefined(); // In production, this would be sent via email
      });

      it('should return success even for non-existent user (security)', async () => {
        // Mock user doesn't exist
        mockUserDataManager.findUserByEmail.mockResolvedValue(null);

        const result = await authService.requestPasswordReset(validResetRequest);

        expect(result.success).toBe(true);
        expect(result.message).toContain('If an account with this email exists');
        expect(result.token).toBeUndefined();
      });
    });

    describe('Reset Password', () => {
      it('should successfully reset password with valid token', async () => {
        // First request a reset token
        mockUserDataManager.findUserByEmail.mockResolvedValue(mockUserProfile);
        const resetRequest = await authService.requestPasswordReset({
          email: mockUserProfile.email,
        });
        const resetToken = resetRequest.token!;

        // Mock user lookup
        mockUserDataManager.readUserData.mockResolvedValue(mockUserProfile);

        // Mock password hashing
        (bcrypt.hash as jest.Mock).mockResolvedValue('newHashedPassword');

        // Mock JWT signing
        (jwt.sign as jest.Mock).mockReturnValue('mockAccessToken');

        const resetConfirm: PasswordResetConfirm = {
          token: resetToken,
          newPassword: 'NewSecurePassword123!',
          confirmPassword: 'NewSecurePassword123!',
        };

        const result = await authService.resetPassword(resetConfirm);

        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.user.email).toBe(mockUserProfile.email);
          expect(result.data.accessToken).toBeDefined();
        }

        // Verify password was hashed
        expect(bcrypt.hash).toHaveBeenCalledWith(resetConfirm.newPassword, 12);
      });

      it('should fail with invalid reset token', async () => {
        const resetConfirm: PasswordResetConfirm = {
          token: 'invalid-token',
          newPassword: 'NewSecurePassword123!',
          confirmPassword: 'NewSecurePassword123!',
        };

        const result = await authService.resetPassword(resetConfirm);

        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.type).toBe('TOKEN_INVALID');
          expect(result.error.message).toContain('Invalid or expired');
        }
      });
    });
  });

  describe('Change Password', () => {
    const mockUserProfile: UserProfile = {
      id: uuidv4(),
      firstName: 'John',
      lastName: 'Doe',
      email: 'john.doe@example.com',
      preferences: {
        currency: 'CAD',
        timezone: 'America/Toronto',
        preferredDepartureAirport: 'YYZ',
        communicationFrequency: 'daily',
        subscriptionTier: 'free',
      },
      activeSearches: [],
      searchHistory: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const changePasswordRequest: ChangePassword = {
      currentPassword: 'OldPassword123!',
      newPassword: 'NewPassword123!',
      confirmPassword: 'NewPassword123!',
    };

    it('should successfully change password with correct current password', async () => {
      // Mock user exists
      mockUserDataManager.readUserData.mockResolvedValue(mockUserProfile);

      // Store current password hash
      const currentHashedPassword = 'currentHashedPassword';
      passwordStorage.set(mockUserProfile.id, currentHashedPassword);

      // Mock current password verification
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      // Mock new password hashing
      (bcrypt.hash as jest.Mock).mockResolvedValue('newHashedPassword');

      const result = await authService.changePassword(mockUserProfile.id, changePasswordRequest);

      expect(result.success).toBe(true);
      expect(result.message).toContain('changed successfully');

      // Verify passwords were processed correctly
      expect(bcrypt.compare).toHaveBeenCalledWith(
        changePasswordRequest.currentPassword,
        currentHashedPassword
      );
      expect(bcrypt.hash).toHaveBeenCalledWith(changePasswordRequest.newPassword, 12);
    });

    it('should fail with incorrect current password', async () => {
      // Mock user exists
      mockUserDataManager.readUserData.mockResolvedValue(mockUserProfile);

      // Store current password hash
      const currentHashedPassword = 'currentHashedPassword';
      passwordStorage.set(mockUserProfile.id, currentHashedPassword);

      // Mock current password verification fails
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      const result = await authService.changePassword(mockUserProfile.id, changePasswordRequest);

      expect(result.success).toBe(false);
      expect(result.message).toContain('Current password is incorrect');
    });
  });

  describe('JWT Token Validation', () => {
    it('should validate a valid JWT token', async () => {
      const mockPayload = {
        sub: uuidv4(),
        email: 'john.doe@example.com',
        role: 'user' as const,
        sessionId: uuidv4(),
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600,
        iss: 'agentic-travel-agent',
        aud: 'agentic-travel-agent-users',
      };

      // Mock JWT verification
      (jwt.verify as jest.Mock).mockReturnValue(mockPayload);

      // Create a session for the token
      const sessionUser: SessionUser = {
        id: mockPayload.sub,
        email: mockPayload.email,
        firstName: 'John',
        lastName: 'Doe',
        emailVerified: true,
        role: 'user',
        createdAt: new Date().toISOString(),
      };

      // Add session to authService (this is a bit hacky but works for testing)
      (authService as any).sessions[mockPayload.sessionId] = {
        sessionId: mockPayload.sessionId,
        userId: mockPayload.sub,
        user: sessionUser,
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 3600000).toISOString(),
        lastAccessedAt: new Date().toISOString(),
        isActive: true,
        loginMethod: 'email',
      };

      const result = await authService.validateJWTToken('valid-token');

      expect(result).toBeDefined();
      expect(result?.sub).toBe(mockPayload.sub);
      expect(result?.email).toBe(mockPayload.email);
    });

    it('should reject an invalid JWT token', async () => {
      // Mock JWT verification failure
      (jwt.verify as jest.Mock).mockImplementation(() => {
        throw new jwt.JsonWebTokenError('Invalid token');
      });

      const result = await authService.validateJWTToken('invalid-token');

      expect(result).toBeNull();
    });

    it('should reject a token with expired session', async () => {
      const mockPayload = {
        sub: uuidv4(),
        email: 'john.doe@example.com',
        role: 'user' as const,
        sessionId: uuidv4(),
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600,
        iss: 'agentic-travel-agent',
        aud: 'agentic-travel-agent-users',
      };

      // Mock JWT verification
      (jwt.verify as jest.Mock).mockReturnValue(mockPayload);

      // No session exists for this token
      const result = await authService.validateJWTToken('valid-token-no-session');

      expect(result).toBeNull();
    });
  });

  describe('Session Management', () => {
    const mockSessionUser: SessionUser = {
      id: uuidv4(),
      email: 'john.doe@example.com',
      firstName: 'John',
      lastName: 'Doe',
      emailVerified: true,
      role: 'user',
      createdAt: new Date().toISOString(),
    };

    it('should validate an active session', async () => {
      const sessionId = uuidv4();

      // Add session to authService
      (authService as any).sessions[sessionId] = {
        sessionId,
        userId: mockSessionUser.id,
        user: mockSessionUser,
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 3600000).toISOString(),
        lastAccessedAt: new Date().toISOString(),
        isActive: true,
        loginMethod: 'email',
      };

      const result = await authService.validateSession(sessionId);

      expect(result).toBeDefined();
      expect(result?.email).toBe(mockSessionUser.email);
    });

    it('should reject an expired session', async () => {
      const sessionId = uuidv4();

      // Add expired session to authService
      (authService as any).sessions[sessionId] = {
        sessionId,
        userId: mockSessionUser.id,
        user: mockSessionUser,
        createdAt: new Date(Date.now() - 7200000).toISOString(),
        expiresAt: new Date(Date.now() - 3600000).toISOString(),
        lastAccessedAt: new Date(Date.now() - 3600000).toISOString(),
        isActive: true,
        loginMethod: 'email',
      };

      const result = await authService.validateSession(sessionId);

      expect(result).toBeNull();
    });

    it('should successfully logout user', async () => {
      const sessionId = uuidv4();

      // Add session to authService
      (authService as any).sessions[sessionId] = {
        sessionId,
        userId: mockSessionUser.id,
        user: mockSessionUser,
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 3600000).toISOString(),
        lastAccessedAt: new Date().toISOString(),
        isActive: true,
        loginMethod: 'email',
      };

      const result = await authService.logoutUser(sessionId);

      expect(result.success).toBe(true);
      expect(result.message).toContain('Logged out successfully');

      // Verify session was removed
      expect((authService as any).sessions[sessionId]).toBeUndefined();
    });
  });

  describe('Rate Limiting', () => {
    const loginRequest: LoginRequest = {
      email: 'john.doe@example.com',
      password: 'WrongPassword123!',
      rememberMe: false,
    };

    it('should lock account after max failed attempts', async () => {
      // Mock user exists
      const mockUserProfile: UserProfile = {
        id: uuidv4(),
        firstName: 'John',
        lastName: 'Doe',
        email: loginRequest.email,
        preferences: {
          currency: 'CAD',
          timezone: 'America/Toronto',
          preferredDepartureAirport: 'YYZ',
          communicationFrequency: 'daily',
          subscriptionTier: 'free',
        },
        activeSearches: [],
        searchHistory: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      mockUserDataManager.findUserByEmail.mockResolvedValue(mockUserProfile);

      // Store a password hash for the user
      const hashedPassword = 'hashedPassword123';
      passwordStorage.set(mockUserProfile.id, hashedPassword);

      // Mock password comparison always fails
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      // Attempt login multiple times
      for (let i = 0; i < AUTH_CONSTANTS.SECURITY.MAX_FAILED_ATTEMPTS; i++) {
        await authService.loginUser(loginRequest);
      }

      // Next attempt should be rate limited
      const result = await authService.loginUser(loginRequest);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.type).toBe('RATE_LIMIT_EXCEEDED');
        expect(result.error.message).toContain('Too many failed login attempts');
      }
    });
  });

  describe('User Retrieval', () => {
    const mockUserProfile: UserProfile = {
      id: uuidv4(),
      firstName: 'John',
      lastName: 'Doe',
      email: 'john.doe@example.com',
      preferences: {
        currency: 'CAD',
        timezone: 'America/Toronto',
        preferredDepartureAirport: 'YYZ',
        communicationFrequency: 'daily',
        subscriptionTier: 'free',
      },
      activeSearches: [],
      searchHistory: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    it('should get user by ID', async () => {
      mockUserDataManager.readUserData.mockResolvedValue(mockUserProfile);

      const result = await authService.getUserById(mockUserProfile.id);

      expect(result).toBeDefined();
      expect(result?.id).toBe(mockUserProfile.id);
      expect(result?.email).toBe(mockUserProfile.email);
    });

    it('should get user by email', async () => {
      mockUserDataManager.findUserByEmail.mockResolvedValue(mockUserProfile);

      const result = await authService.getUserByEmail(mockUserProfile.email);

      expect(result).toBeDefined();
      expect(result?.id).toBe(mockUserProfile.id);
      expect(result?.email).toBe(mockUserProfile.email);
    });

    it('should return null for non-existent user', async () => {
      mockUserDataManager.readUserData.mockResolvedValue(null);
      mockUserDataManager.findUserByEmail.mockResolvedValue(null);

      const resultById = await authService.getUserById('non-existent-id');
      const resultByEmail = await authService.getUserByEmail('non-existent@example.com');

      expect(resultById).toBeNull();
      expect(resultByEmail).toBeNull();
    });
  });
});
