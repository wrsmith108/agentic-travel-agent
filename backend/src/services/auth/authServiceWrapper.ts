import { Result, ok, err } from '@/utils/result';
import { authService } from './authService';
import { AuthSuccessResponse, AuthErrorResponse, RegisterRequest, LoginRequest } from '@/schemas/auth';
import { AuthSuccess, AuthError } from '@/types/auth';

/**
 * Converts AuthSuccessResponse to AuthSuccess for Result pattern
 */
const convertToAuthSuccess = (response: AuthSuccessResponse): AuthSuccess => {
  return {
    user: {
      id: response.data.user.id!,
      firstName: response.data.user.firstName!,
      lastName: response.data.user.lastName!,
      email: response.data.user.email!,
      createdAt: response.data.user.createdAt!,
      emailVerified: response.data.user.emailVerified!,
      role: response.data.user.role!,
      lastLoginAt: response.data.user.lastLoginAt,
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
  switch (response.error.type) {
    case 'INVALID_CREDENTIALS':
      return { type: 'INVALID_CREDENTIALS', message: response.error.message };
    case 'USER_NOT_FOUND':
      return { type: 'USER_NOT_FOUND', message: response.error.message };
    case 'USER_ALREADY_EXISTS':
      return { type: 'USER_ALREADY_EXISTS', message: response.error.message };
    case 'VALIDATION_ERROR':
      return { type: 'VALIDATION_ERROR', message: response.error.message, details: response.error.details };
    default:
      return { type: 'SYSTEM_ERROR', message: response.error.message, code: response.error.code };
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
    const response = await authService.registerUser(data);
    
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
    const response = await authService.loginUser(data);
    
    if (response.success) {
      const authSuccess = convertToAuthSuccess(response as AuthSuccessResponse);
      return ok(authSuccess);
    } else {
      const authError = convertToAuthError(response as AuthErrorResponse);
      return err(authError);
    }
  },

  /**
   * Logout user with Result pattern
   */
  async logout(sessionId: string): Promise<Result<{ message: string }, AuthError>> {
    const response = await authService.logoutUser(sessionId);
    
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
    const response = await authService.requestPasswordReset({ email });
    
    if (response.success) {
      return ok({ message: response.message, token: response.token });
    } else {
      return err({ type: 'SYSTEM_ERROR', message: response.message });
    }
  },

  /**
   * Reset password with Result pattern
   */
  async resetPassword(token: string, password: string): Promise<Result<AuthSuccess, AuthError>> {
    const response = await authService.resetPassword({ token, newPassword: password });
    
    if ('success' in response && response.success) {
      const authSuccess = convertToAuthSuccess(response as AuthSuccessResponse);
      return ok(authSuccess);
    } else {
      const authError = convertToAuthError(response as AuthErrorResponse);
      return err(authError);
    }
  },
};