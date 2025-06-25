/**
 * Backward Compatibility Wrapper for AuthService
 *
 * This provides a class-based interface that wraps the functional auth module,
 * allowing existing code to continue working during the migration period.
 */

import { authService as functionalAuth } from './functional';
import { isOk, isErr, type Result } from './functional/types';
import { UserDataManager } from '@/services/storage/userDataManager';
import {
  AuthSuccessResponse,
  AuthErrorResponse,
  SessionUser,
  JWTPayload,
  createAuthError,
  createAuthSuccess,
} from '@/schemas/auth';
import { logInfo, logWarn } from '@/utils/logger';

/**
 * Compatibility class that maintains the original AuthService interface
 * while using the new functional implementation internally
 */
class AuthServiceCompat {
  private readonly userDataManager: UserDataManager;

  constructor(userDataManager?: UserDataManager) {
    this.userDataManager = userDataManager || new UserDataManager();
    logInfo('AuthServiceCompat initialized - using functional auth implementation');
  }

  /**
   * Register a new user - compatibility wrapper
   */
  async registerUser(data: unknown): Promise<AuthSuccessResponse | AuthErrorResponse> {
    const result = await functionalAuth.register(data as any);

    if (isOk(result)) {
      const { user, sessionId, tokens } = result.value;
      return createAuthSuccess(
        'Registration successful',
        user,
        sessionId,
        tokens.accessToken,
        tokens.expiresAt,
        tokens.refreshToken,
        ['user:read', 'user:update']
      );
    } else {
      const error = result.error;
      return createAuthError(
        error.type as any,
        error.message,
        error.details,
        error.code,
        error.requestId
      );
    }
  }

  /**
   * Login user - compatibility wrapper
   */
  async loginUser(data: unknown): Promise<AuthSuccessResponse | AuthErrorResponse> {
    const result = await functionalAuth.login(data as any);

    if (isOk(result)) {
      const { user, sessionId, tokens } = result.value;
      return createAuthSuccess(
        'Login successful',
        user,
        sessionId,
        tokens.accessToken,
        tokens.expiresAt,
        tokens.refreshToken,
        ['user:read', 'user:update', 'user:delete']
      );
    } else {
      const error = result.error;
      return createAuthError(
        error.type as any,
        error.message,
        error.details,
        error.code,
        error.requestId
      );
    }
  }

  /**
   * Logout user - compatibility wrapper
   */
  async logoutUser(sessionId: string): Promise<{ success: boolean; message: string }> {
    const result = await functionalAuth.logout({ sessionId: sessionId as any });

    if (isOk(result)) {
      return {
        success: true,
        message: 'Logged out successfully',
      };
    } else {
      return {
        success: false,
        message: result.error.message,
      };
    }
  }

  /**
   * Validate session - compatibility wrapper
   */
  async validateSession(sessionId: string): Promise<SessionUser | null> {
    const result = await functionalAuth.validateSession({ sessionId: sessionId as any });

    if (isOk(result)) {
      return result.value;
    } else {
      logWarn('Session validation failed', { sessionId, error: result.error });
      return null;
    }
  }

  /**
   * Validate JWT token - compatibility wrapper
   * Note: This now validates the session associated with the token
   */
  async validateJWTToken(token: string): Promise<JWTPayload | null> {
    // In the functional implementation, JWT validation is handled internally
    // For compatibility, we parse the token to get the session ID
    try {
      // This is a simplified approach - in production, use proper JWT parsing
      const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString()) as any;
      const sessionResult = await functionalAuth.validateSession({
        sessionId: payload.sessionId,
      });

      if (isOk(sessionResult) && sessionResult.value) {
        return {
          sub: sessionResult.value.id,
          email: sessionResult.value.email,
          role: sessionResult.value.role,
          sessionId: payload.sessionId,
          iat: payload.iat,
          exp: payload.exp,
          iss: payload.iss || 'agentic-travel-agent',
          aud: payload.aud || 'agentic-travel-agent-users',
        };
      }
    } catch (error) {
      logWarn('JWT token parsing failed', { error });
    }

    return null;
  }

  /**
   * Request password reset - compatibility wrapper
   */
  async requestPasswordReset(
    data: unknown
  ): Promise<{ success: boolean; message: string; token?: string }> {
    // This functionality needs to be added to the functional module
    // For now, return a placeholder response
    return {
      success: true,
      message: 'Password reset functionality pending migration',
    };
  }

  /**
   * Reset password - compatibility wrapper
   */
  async resetPassword(data: unknown): Promise<AuthSuccessResponse | AuthErrorResponse> {
    // This functionality needs to be added to the functional module
    // For now, return an error
    return createAuthError(
      'SERVER_ERROR',
      'Password reset functionality pending migration',
      {},
      'AUTH_COMPAT_001'
    );
  }

  /**
   * Change password - compatibility wrapper
   */
  async changePassword(
    userId: string,
    data: unknown
  ): Promise<{ success: boolean; message: string }> {
    // This functionality needs to be added to the functional module
    // For now, return a placeholder response
    return {
      success: false,
      message: 'Change password functionality pending migration',
    };
  }

  /**
   * Get user by ID - compatibility wrapper
   */
  async getUserById(userId: string): Promise<any> {
    // Use the existing UserDataManager for now
    return this.userDataManager.readUserData(userId);
  }

  /**
   * Get user by email - compatibility wrapper
   */
  async getUserByEmail(email: string): Promise<any> {
    // Use the existing UserDataManager for now
    return this.userDataManager.findUserByEmail(email);
  }

  /**
   * Get user account status - compatibility wrapper
   */
  async getUserAccountStatus(userId: string): Promise<any> {
    // Return default status for compatibility
    return {
      isEmailVerified: true,
      isAccountLocked: false,
      isAccountSuspended: false,
      failedLoginAttempts: 0,
    };
  }

  // MVP Testing Support - Expose internals for testing
  // These will be removed in production
  private storeUserPassword = async (userId: string, hashedPassword: string): Promise<void> => {
    logInfo('Compat: storeUserPassword called', { userId });
  };

  private getUserPasswordHash = async (userId: string): Promise<string | null> => {
    logInfo('Compat: getUserPasswordHash called', { userId });
    return null;
  };
}

// Export singleton instance for backward compatibility
export const authService = new AuthServiceCompat();

// Export class for testing and custom instances
export { AuthServiceCompat as AuthService };
