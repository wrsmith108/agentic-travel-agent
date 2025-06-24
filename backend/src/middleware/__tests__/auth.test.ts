import { Request, Response, NextFunction } from 'express';
import { 
  requireAuth, 
  optionalAuth, 
  requireRole,
  isAuthenticated,
  getCurrentUser,
  getCurrentSessionUser,
  hasRole,
  UserRole,
  AuthenticatedRequest 
} from '../auth';
import { authService } from '@/services/auth/authService';
import { AppError } from '../errorHandler';
import { CreateUserProfile } from '@/schemas/user';

// Mock the authService
jest.mock('@/services/auth/authService');
const mockAuthService = authService as jest.Mocked<typeof authService>;

// Mock external dependencies
jest.mock('@sendgrid/mail');
jest.mock('@anthropic-ai/sdk');
jest.mock('amadeus');

describe('Authentication Middleware', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let nextFunction: NextFunction;

  const mockUser = {
    id: 'user-123',
    firstName: 'John',
    lastName: 'Doe',
    email: 'john.doe@example.com',
    preferences: {
      currency: 'CAD' as const,
      timezone: 'America/Toronto',
      preferredDepartureAirport: 'YYZ',
      communicationFrequency: 'daily' as const,
    },
    activeSearches: [],
    searchHistory: [],
    createdAt: '2025-01-01T00:00:00.000Z',
    updatedAt: '2025-01-01T00:00:00.000Z',
  };

  const mockSessionUser = {
    id: 'user-123',
    email: 'john.doe@example.com',
    firstName: 'John',
    lastName: 'Doe',
    role: UserRole.USER,
    lastActivity: '2025-01-01T00:00:00.000Z',
    isEmailVerified: true,
    accountStatus: 'active' as const,
  };

  beforeEach(() => {
    jest.clearAllMocks();

    mockRequest = {
      headers: {},
      cookies: {},
      ip: '127.0.0.1',
      get: jest.fn((header: string) => {
        if (header === 'user-agent') return 'Test Browser';
        return mockRequest.headers?.[header.toLowerCase()];
      }),
      header: jest.fn((name: string) => {
        return mockRequest.headers?.[name.toLowerCase()];
      }),
    };

    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      setHeader: jest.fn(),
    };

    nextFunction = jest.fn();
  });

  describe('requireAuth middleware', () => {
    it('should authenticate user with valid Bearer token', async () => {
      const validToken = 'valid-jwt-token';
      mockRequest.headers = { authorization: `Bearer ${validToken}` };

      const mockJWTPayload = {
        sub: mockUser.id,
        email: mockUser.email,
        role: UserRole.USER,
        sessionId: 'session-123',
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600,
        iss: 'agentic-travel-agent',
        aud: 'agentic-travel-agent-users',
      };

      mockAuthService.validateJWTToken.mockResolvedValue(mockJWTPayload);
      mockAuthService.validateSession.mockResolvedValue(mockSessionUser);

      const middleware = requireAuth();
      await middleware(mockRequest as Request, mockResponse as Response, nextFunction);

      expect(mockAuthService.validateJWTToken).toHaveBeenCalledWith(validToken);
      expect((mockRequest as AuthenticatedRequest).user).toEqual(mockJWTPayload);
      expect((mockRequest as AuthenticatedRequest).sessionUser).toEqual(mockSessionUser);
      expect(nextFunction).toHaveBeenCalledWith();
    });

    it('should authenticate user with x-access-token header', async () => {
      const validToken = 'valid-jwt-token';
      mockRequest.headers = { 'x-access-token': validToken };

      const mockJWTPayload = {
        sub: mockUser.id,
        email: mockUser.email,
        role: UserRole.USER,
        sessionId: 'session-123',
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600,
        iss: 'agentic-travel-agent',
        aud: 'agentic-travel-agent-users',
      };

      mockAuthService.validateJWTToken.mockResolvedValue(mockJWTPayload);
      mockAuthService.validateSession.mockResolvedValue(mockSessionUser);

      const middleware = requireAuth();
      await middleware(mockRequest as Request, mockResponse as Response, nextFunction);

      expect(mockAuthService.validateJWTToken).toHaveBeenCalledWith(validToken);
      expect(nextFunction).toHaveBeenCalledWith();
    });

    it('should authenticate user with access_token cookie', async () => {
      const validToken = 'valid-jwt-token';
      mockRequest.cookies = { access_token: validToken };

      const mockJWTPayload = {
        sub: mockUser.id,
        email: mockUser.email,
        role: UserRole.USER,
        sessionId: 'session-123',
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600,
        iss: 'agentic-travel-agent',
        aud: 'agentic-travel-agent-users',
      };

      mockAuthService.validateJWTToken.mockResolvedValue(mockJWTPayload);
      mockAuthService.validateSession.mockResolvedValue(mockSessionUser);

      const middleware = requireAuth();
      await middleware(mockRequest as Request, mockResponse as Response, nextFunction);

      expect(mockAuthService.validateJWTToken).toHaveBeenCalledWith(validToken);
      expect(nextFunction).toHaveBeenCalledWith();
    });

    it('should reject request without token', async () => {
      const middleware = requireAuth();
      await middleware(mockRequest as Request, mockResponse as Response, nextFunction);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            code: 'AUTHENTICATION_REQUIRED',
          }),
        })
      );
      expect(nextFunction).not.toHaveBeenCalled();
    });

    it('should reject request with invalid token', async () => {
      const invalidToken = 'invalid-jwt-token';
      mockRequest.headers = { authorization: `Bearer ${invalidToken}` };

      mockAuthService.validateJWTToken.mockResolvedValue(null);

      const middleware = requireAuth();
      await middleware(mockRequest as Request, mockResponse as Response, nextFunction);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            code: 'INVALID_TOKEN',
          }),
        })
      );
      expect(nextFunction).not.toHaveBeenCalled();
    });

    it('should include user profile when withProfile option is true', async () => {
      const validToken = 'valid-jwt-token';
      mockRequest.headers = { authorization: `Bearer ${validToken}` };

      const mockJWTPayload = {
        sub: mockUser.id,
        email: mockUser.email,
        role: UserRole.USER,
        sessionId: 'session-123',
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600,
        iss: 'agentic-travel-agent',
        aud: 'agentic-travel-agent-users',
      };

      mockAuthService.validateJWTToken.mockResolvedValue(mockJWTPayload);
      mockAuthService.validateSession.mockResolvedValue(mockSessionUser);

      const middleware = requireAuth({ includeUserProfile: true });
      await middleware(mockRequest as Request, mockResponse as Response, nextFunction);

      expect((mockRequest as AuthenticatedRequest).user).toEqual(mockJWTPayload);
      expect(nextFunction).toHaveBeenCalledWith();
    });

    it('should handle authentication service errors', async () => {
      const validToken = 'valid-jwt-token';
      mockRequest.headers = { authorization: `Bearer ${validToken}` };

      mockAuthService.validateJWTToken.mockRejectedValue(new Error('Service error'));

      const middleware = requireAuth();
      await middleware(mockRequest as Request, mockResponse as Response, nextFunction);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            code: 'INTERNAL_SERVER_ERROR',
          }),
        })
      );
      expect(nextFunction).not.toHaveBeenCalled();
    });
  });

  describe('optionalAuth middleware', () => {
    it('should authenticate user when valid token is provided', async () => {
      const validToken = 'valid-jwt-token';
      mockRequest.headers = { authorization: `Bearer ${validToken}` };

      const mockJWTPayload = {
        sub: mockUser.id,
        email: mockUser.email,
        role: UserRole.USER,
        sessionId: 'session-123',
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600,
        iss: 'agentic-travel-agent',
        aud: 'agentic-travel-agent-users',
      };

      mockAuthService.validateJWTToken.mockResolvedValue(mockJWTPayload);
      mockAuthService.validateSession.mockResolvedValue(mockSessionUser);

      const middleware = optionalAuth();
      await middleware(mockRequest as Request, mockResponse as Response, nextFunction);

      expect((mockRequest as AuthenticatedRequest).user).toEqual(mockJWTPayload);
      expect((mockRequest as AuthenticatedRequest).sessionUser).toEqual(mockSessionUser);
      expect(nextFunction).toHaveBeenCalledWith();
    });

    it('should continue without authentication when no token is provided', async () => {
      const middleware = optionalAuth();
      await middleware(mockRequest as Request, mockResponse as Response, nextFunction);

      expect((mockRequest as AuthenticatedRequest).user).toBeUndefined();
      expect((mockRequest as AuthenticatedRequest).sessionUser).toBeUndefined();
      expect(nextFunction).toHaveBeenCalledWith();
    });

    it('should continue without authentication when invalid token is provided', async () => {
      const invalidToken = 'invalid-jwt-token';
      mockRequest.headers = { authorization: `Bearer ${invalidToken}` };

      mockAuthService.validateJWTToken.mockResolvedValue(null);

      const middleware = optionalAuth();
      await middleware(mockRequest as Request, mockResponse as Response, nextFunction);

      expect((mockRequest as AuthenticatedRequest).user).toBeUndefined();
      expect(nextFunction).toHaveBeenCalledWith();
    });
  });

  describe('requireRole middleware', () => {
    beforeEach(() => {
      (mockRequest as AuthenticatedRequest).sessionUser = mockSessionUser;
    });

    it('should allow access for user with required role', async () => {
      const middleware = requireRole(UserRole.USER);
      await middleware(mockRequest as AuthenticatedRequest, mockResponse as Response, nextFunction);

      expect(nextFunction).toHaveBeenCalledWith();
    });

    it('should deny access for user without required role', async () => {
      const adminSessionUser = { ...mockSessionUser, role: UserRole.USER };
      (mockRequest as AuthenticatedRequest).sessionUser = adminSessionUser;

      const middleware = requireRole(UserRole.ADMIN);
      await middleware(mockRequest as AuthenticatedRequest, mockResponse as Response, nextFunction);

      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            code: 'AUTHORIZATION_FAILED',
          }),
        })
      );
      expect(nextFunction).not.toHaveBeenCalled();
    });

    it('should handle multiple required roles with requireAll=false', async () => {
      const moderatorSessionUser = { ...mockSessionUser, role: UserRole.MODERATOR };
      (mockRequest as AuthenticatedRequest).sessionUser = moderatorSessionUser;

      const middleware = requireRole({
        requiredRoles: [UserRole.ADMIN, UserRole.MODERATOR],
        requireAll: false,
      });
      await middleware(mockRequest as AuthenticatedRequest, mockResponse as Response, nextFunction);

      expect(nextFunction).toHaveBeenCalledWith();
    });

    it('should handle multiple required roles with requireAll=true', async () => {
      const userSessionUser = { ...mockSessionUser, role: UserRole.USER };
      (mockRequest as AuthenticatedRequest).sessionUser = userSessionUser;

      const middleware = requireRole({
        requiredRoles: [UserRole.ADMIN, UserRole.MODERATOR],
        requireAll: true,
      });
      await middleware(mockRequest as AuthenticatedRequest, mockResponse as Response, nextFunction);

      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(nextFunction).not.toHaveBeenCalled();
    });

    it('should deny access when no session user is present', async () => {
      delete (mockRequest as AuthenticatedRequest).sessionUser;

      const middleware = requireRole(UserRole.USER);
      await middleware(mockRequest as AuthenticatedRequest, mockResponse as Response, nextFunction);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(nextFunction).not.toHaveBeenCalled();
    });
  });

  describe('Utility functions', () => {
    beforeEach(() => {
      (mockRequest as AuthenticatedRequest).user = mockUser;
      (mockRequest as AuthenticatedRequest).sessionUser = mockSessionUser;
    });

    describe('isAuthenticated', () => {
      it('should return true when user is authenticated', () => {
        const result = isAuthenticated(mockRequest as AuthenticatedRequest);
        expect(result).toBe(true);
      });

      it('should return false when user is not authenticated', () => {
        delete (mockRequest as AuthenticatedRequest).user;
        delete (mockRequest as AuthenticatedRequest).sessionUser;

        const result = isAuthenticated(mockRequest as AuthenticatedRequest);
        expect(result).toBe(false);
      });
    });

    describe('getCurrentUser', () => {
      it('should return user when authenticated', () => {
        const result = getCurrentUser(mockRequest as AuthenticatedRequest);
        expect(result).toEqual(mockUser);
      });

      it('should return undefined when not authenticated', () => {
        delete (mockRequest as AuthenticatedRequest).user;

        const result = getCurrentUser(mockRequest as AuthenticatedRequest);
        expect(result).toBeUndefined();
      });
    });

    describe('getCurrentSessionUser', () => {
      it('should return session user when authenticated', () => {
        const result = getCurrentSessionUser(mockRequest as AuthenticatedRequest);
        expect(result).toEqual(mockSessionUser);
      });

      it('should return undefined when not authenticated', () => {
        delete (mockRequest as AuthenticatedRequest).sessionUser;

        const result = getCurrentSessionUser(mockRequest as AuthenticatedRequest);
        expect(result).toBeUndefined();
      });
    });

    describe('hasRole', () => {
      it('should return true when user has required role', () => {
        const result = hasRole(mockRequest as AuthenticatedRequest, UserRole.USER);
        expect(result).toBe(true);
      });

      it('should return false when user does not have required role', () => {
        const result = hasRole(mockRequest as AuthenticatedRequest, UserRole.ADMIN);
        expect(result).toBe(false);
      });

      it('should return false when no session user is present', () => {
        delete (mockRequest as AuthenticatedRequest).sessionUser;

        const result = hasRole(mockRequest as AuthenticatedRequest, UserRole.USER);
        expect(result).toBe(false);
      });

      it('should handle multiple roles with requireAll=false', () => {
        const result = hasRole(
          mockRequest as AuthenticatedRequest,
          {
            requiredRoles: [UserRole.ADMIN, UserRole.USER],
            requireAll: false,
          }
        );
        expect(result).toBe(true);
      });

      it('should handle multiple roles with requireAll=true', () => {
        const result = hasRole(
          mockRequest as AuthenticatedRequest,
          {
            requiredRoles: [UserRole.ADMIN, UserRole.USER],
            requireAll: true,
          }
        );
        expect(result).toBe(false);
      });
    });
  });

  describe('Token extraction', () => {
    it('should extract token from Authorization header with Bearer prefix', async () => {
      mockRequest.headers = { authorization: 'Bearer valid-token' };

      const mockJWTPayload = {
        sub: mockUser.id,
        email: mockUser.email,
        role: UserRole.USER,
        sessionId: 'session-123',
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600,
        iss: 'agentic-travel-agent',
        aud: 'agentic-travel-agent-users',
      };

      mockAuthService.validateJWTToken.mockResolvedValue(mockJWTPayload);
      mockAuthService.validateSession.mockResolvedValue(mockSessionUser);

      const middleware = requireAuth();
      await middleware(mockRequest as Request, mockResponse as Response, nextFunction);

      expect(mockAuthService.validateJWTToken).toHaveBeenCalledWith('valid-token');
    });

    it('should handle malformed Authorization header', async () => {
      mockRequest.headers = { authorization: 'InvalidFormat' };

      const middleware = requireAuth();
      await middleware(mockRequest as Request, mockResponse as Response, nextFunction);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(nextFunction).not.toHaveBeenCalled();
    });

    it('should prioritize Authorization header over other sources', async () => {
      mockRequest.headers = { 
        authorization: 'Bearer header-token',
        'x-access-token': 'header-x-token'
      };
      mockRequest.cookies = { access_token: 'cookie-token' };

      const mockJWTPayload = {
        sub: mockUser.id,
        email: mockUser.email,
        role: UserRole.USER,
        sessionId: 'session-123',
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600,
        iss: 'agentic-travel-agent',
        aud: 'agentic-travel-agent-users',
      };

      mockAuthService.validateJWTToken.mockResolvedValue(mockJWTPayload);
      mockAuthService.validateSession.mockResolvedValue(mockSessionUser);

      const middleware = requireAuth();
      await middleware(mockRequest as Request, mockResponse as Response, nextFunction);

      expect(mockAuthService.validateJWTToken).toHaveBeenCalledWith('header-token');
    });

    it('should fall back to x-access-token header when Authorization is not present', async () => {
      mockRequest.headers = { 'x-access-token': 'header-x-token' };
      mockRequest.cookies = { access_token: 'cookie-token' };

      const mockJWTPayload = {
        sub: mockUser.id,
        email: mockUser.email,
        role: UserRole.USER,
        sessionId: 'session-123',
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600,
        iss: 'agentic-travel-agent',
        aud: 'agentic-travel-agent-users',
      };

      mockAuthService.validateJWTToken.mockResolvedValue(mockJWTPayload);
      mockAuthService.validateSession.mockResolvedValue(mockSessionUser);

      const middleware = requireAuth();
      await middleware(mockRequest as Request, mockResponse as Response, nextFunction);

      expect(mockAuthService.validateJWTToken).toHaveBeenCalledWith('header-x-token');
    });

    it('should fall back to cookie when headers are not present', async () => {
      mockRequest.cookies = { access_token: 'cookie-token' };

      const mockJWTPayload = {
        sub: mockUser.id,
        email: mockUser.email,
        role: UserRole.USER,
        sessionId: 'session-123',
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600,
        iss: 'agentic-travel-agent',
        aud: 'agentic-travel-agent-users',
      };

      mockAuthService.validateJWTToken.mockResolvedValue(mockJWTPayload);
      mockAuthService.validateSession.mockResolvedValue(mockSessionUser);

      const middleware = requireAuth();
      await middleware(mockRequest as Request, mockResponse as Response, nextFunction);

      expect(mockAuthService.validateJWTToken).toHaveBeenCalledWith('cookie-token');
    });
  });

  describe('Error logging and metadata', () => {
    it('should log authentication attempts with device information', async () => {
      const validToken = 'valid-jwt-token';
      mockRequest.headers = { 
        authorization: `Bearer ${validToken}`,
        'user-agent': 'Mozilla/5.0 Test Browser'
      };
      mockRequest.ip = '192.168.1.100';

      const mockJWTPayload = {
        sub: mockUser.id,
        email: mockUser.email,
        role: UserRole.USER,
        sessionId: 'session-123',
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600,
        iss: 'agentic-travel-agent',
        aud: 'agentic-travel-agent-users',
      };

      mockAuthService.validateJWTToken.mockResolvedValue(mockJWTPayload);
      mockAuthService.validateSession.mockResolvedValue(mockSessionUser);

      const middleware = requireAuth();
      await middleware(mockRequest as Request, mockResponse as Response, nextFunction);

      expect(nextFunction).toHaveBeenCalledWith();
    });

    it('should include request metadata in error responses', async () => {
      const middleware = requireAuth();
      await middleware(mockRequest as Request, mockResponse as Response, nextFunction);

      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          meta: expect.objectContaining({
            requestId: expect.any(String),
            timestamp: expect.any(String),
          }),
        })
      );
    });
  });
});