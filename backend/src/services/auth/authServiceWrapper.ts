import { Result, ok, err, isErr } from '@/utils/result';
import { authService as mainAuthService } from './authService';
import { AuthSuccessResponse, AuthErrorResponse, RegisterRequest, LoginRequest, SessionUser } from '@/schemas/auth';
import { AuthSuccess, AuthError } from '@/types/auth';

/**
 * Converts AuthSuccessResponse to AuthSuccess for Result pattern
 */
const convertToAuthSuccess = (response: AuthSuccessResponse): AuthSuccess => {
  // response.data.user is the Zod-inferred SessionUser type
  const user = response.data.user;
  
  return {
    user: {
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      createdAt: user.createdAt,
      isEmailVerified: user.isEmailVerified,
      role: user.role,
      lastLoginAt: user.lastLoginAt,
    },
    accessToken: response.data.accessToken,
    refreshToken: response.data.refreshToken,
    expiresAt: response.data.expiresAt,
  };
};

/**
 * Converts AuthErrorResponse to AuthError for Result pattern
 */
const convertToAuthError = (response: AuthErrorResponse): AuthError => {
  // Map auth error types to simplified error types
  const errorType = response.error?.type || 'SYSTEM_ERROR';
  const errorMessage = response.error?.message || 'An error occurred';
  
  switch (errorType) {
    case 'INVALID_CREDENTIALS':
      return { type: 'INVALID_CREDENTIALS', message: errorMessage };
    case 'USER_NOT_FOUND':
      return { type: 'USER_NOT_FOUND', message: errorMessage };
    case 'USER_ALREADY_EXISTS':
      return { type: 'USER_ALREADY_EXISTS', message: errorMessage };
    case 'VALIDATION_ERROR':
      return { type: 'VALIDATION_ERROR', message: errorMessage, details: response.error?.details };
    default:
      return { type: 'SYSTEM_ERROR', message: errorMessage, code: response.error?.code };
  }
};

/**
 * Wrapper for auth service that returns Result pattern
 */
export const authServiceWrapper = {
  /**
   * Register user with Result pattern
   */
  async register(data: RegisterRequest): Promise<Result<AuthSuccess, AuthError>> {
    const response = await mainAuthService.registerUser(data);
    
    if (response.success) {
      const authSuccess = convertToAuthSuccess(response as AuthSuccessResponse);
      return ok(authSuccess);
    } else {
      const authError = convertToAuthError(response as AuthErrorResponse);
      return err(authError);
    }
  },

  /**
   * Login user with Result pattern
   */
  async login(data: LoginRequest): Promise<Result<AuthSuccess, AuthError>> {
    const response = await mainAuthService.loginUser(data);
    
    if (response.success) {
      const authSuccess = convertToAuthSuccess(response as AuthSuccessResponse);
      return ok(authSuccess);
    } else {
      const authError = convertToAuthError(response as AuthErrorResponse);
      return err(authError);
    }
  },

  /**
   * Validate user credentials (compatibility method for old routes)
   * Returns legacy format instead of Result pattern
   */
  async validateCredentials(email: string, password: string): Promise<{ success: boolean; user?: any; message?: string }> {
    const loginData = { email, password };
    const result = await this.login(loginData);
    
    if (isErr(result)) {
      return {
        success: false,
        message: (result.error as AuthError).message || 'Authentication failed'
      };
    }
    
    return {
      success: true,
      user: result.value.user
    };
  },

  /**
   * Logout user with Result pattern
   */
  async logout(sessionId: string): Promise<Result<{ message: string }, AuthError>> {
    const response = await mainAuthService.logoutUser(sessionId);
    
    if (response.success) {
      return ok({ message: response.message });
    } else {
      return err({ type: 'SYSTEM_ERROR', message: response.message });
    }
  },

  /**
   * Request password reset with Result pattern
   */
  async requestPasswordReset(email: string): Promise<Result<{ message: string; token?: string }, AuthError>> {
    const response = await mainAuthService.requestPasswordReset({ email });
    
    if (response.success) {
      return ok({ message: response.message, token: response.token });
    } else {
      return err({ type: 'SYSTEM_ERROR', message: response.message });
    }
  },

  /**
   * Reset password with Result pattern
   */
  async resetPassword(data: { token: string; newPassword: string }): Promise<Result<AuthSuccess, AuthError>> {
    const response = await mainAuthService.resetPassword(data);
    
    if ('success' in response && response.success) {
      const authSuccess = convertToAuthSuccess(response as AuthSuccessResponse);
      return ok(authSuccess);
    } else {
      const authError = convertToAuthError(response as AuthErrorResponse);
      return err(authError);
    }
  },

  /**
   * Get user by ID
   */
  async getUserById(userId: string): Promise<any> {
    // Direct passthrough for now
    return mainAuthService.getUserById(userId);
  },
};