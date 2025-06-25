/**
 * Authentication types for Result pattern
 */

import { UserId } from './brandedTypes';

// Error types
export type AuthError = 
  | { type: 'INVALID_CREDENTIALS'; message: string }
  | { type: 'USER_NOT_FOUND'; message: string }
  | { type: 'USER_ALREADY_EXISTS'; message: string }
  | { type: 'VALIDATION_ERROR'; message: string; details?: unknown }
  | { type: 'SYSTEM_ERROR'; message: string; code?: string };

// Success types
export interface AuthSuccess {
  user: SessionUser;
  accessToken: string;
  refreshToken?: string;
  expiresAt: string;
}

export interface SessionUser {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  createdAt: string;
  emailVerified: boolean;
  role: 'user' | 'admin' | 'moderator';
  lastLoginAt?: string;
}

// Request types
export interface RegisterRequest {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

// Validation types
export interface ValidationError {
  field: string;
  message: string;
  code?: string;
}

// Helper functions for error creation
export const invalidCredentials = (message = 'Invalid credentials'): AuthError => ({
  type: 'INVALID_CREDENTIALS',
  message,
});

export const userNotFound = (message = 'User not found'): AuthError => ({
  type: 'USER_NOT_FOUND',
  message,
});

export const userAlreadyExists = (message = 'User already exists'): AuthError => ({
  type: 'USER_ALREADY_EXISTS',
  message,
});

export const validationError = (message: string, details?: unknown): AuthError => ({
  type: 'VALIDATION_ERROR',
  message,
  details,
});

export const systemError = (message: string, code?: string): AuthError => ({
  type: 'SYSTEM_ERROR',
  message,
  code,
});

// Map error types to HTTP status codes
export const getStatusCodeFromError = (error: AuthError): number => {
  switch (error.type) {
    case 'INVALID_CREDENTIALS':
    case 'USER_NOT_FOUND':
      return 401;
    case 'USER_ALREADY_EXISTS':
      return 409;
    case 'VALIDATION_ERROR':
      return 400;
    case 'SYSTEM_ERROR':
    default:
      return 500;
  }
};