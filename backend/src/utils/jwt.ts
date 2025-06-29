/**
 * JWT utility functions using functional programming and Result pattern
 */

import jwt from 'jsonwebtoken';
import { env } from '@/config/env';
import { Result, ok, err, tryCatch, isErr, isOk } from './result';
import { UserId, AccessToken, RefreshToken } from '@/types/brandedTypes';

// JWT payload types
export interface JWTPayload {
  sub: string; // User ID (subject)
  email: string;
  sessionId: string;
  role: 'user' | 'admin' | 'moderator';
  iat?: number; // Issued at
  exp?: number; // Expiration
}

export interface RefreshTokenPayload {
  sub: string;
  sessionId: string;
  iat?: number;
  exp?: number;
}

// Token types
// Removed - using @/types/brandedTypes: export type AccessToken = string & { readonly brand: unique symbol };
// Removed - using @/types/brandedTypes: export type RefreshToken = string & { readonly brand: unique symbol };

// Constructors
export const asAccessToken = (token: string): AccessToken => token as AccessToken;
export const asRefreshToken = (token: string): RefreshToken => token as RefreshToken;

// Error types
export type JWTError = 
  | { type: 'INVALID_TOKEN'; message: string }
  | { type: 'TOKEN_EXPIRED'; message: string }
  | { type: 'SIGNING_ERROR'; message: string }
  | { type: 'VERIFICATION_ERROR'; message: string };

// Token options
const ACCESS_TOKEN_EXPIRY = '15m'; // 15 minutes
const REFRESH_TOKEN_EXPIRY = '7d'; // 7 days
const REMEMBER_ME_REFRESH_EXPIRY = '30d'; // 30 days

/**
 * Generate access token
 */
export const generateAccessToken = (
  payload: Omit<JWTPayload, 'iat' | 'exp'>
): Result<AccessToken, JWTError> => {
  return tryCatch(
    () => {
      const token = jwt.sign(payload, env.JWT_SECRET, {
        expiresIn: ACCESS_TOKEN_EXPIRY,
        issuer: 'agentic-travel',
        audience: 'agentic-travel-api',
      });
      return asAccessToken(token);
    },
    (error) => ({
      type: 'SIGNING_ERROR',
      message: `Failed to generate access token: ${error instanceof Error ? error.message : 'Unknown error'}`,
    })
  );
};

/**
 * Generate refresh token
 */
export const generateRefreshToken = (
  userId: UserId,
  sessionId: string,
  rememberMe = false
): Result<RefreshToken, JWTError> => {
  return tryCatch(
    () => {
      const payload: RefreshTokenPayload = {
        sub: userId,
        sessionId,
      };
      
      const token = jwt.sign(payload, env.JWT_REFRESH_SECRET, {
        expiresIn: rememberMe ? REMEMBER_ME_REFRESH_EXPIRY : REFRESH_TOKEN_EXPIRY,
        issuer: 'agentic-travel',
        audience: 'agentic-travel-refresh',
      });
      return asRefreshToken(token);
    },
    (error) => ({
      type: 'SIGNING_ERROR',
      message: `Failed to generate refresh token: ${error instanceof Error ? error.message : 'Unknown error'}`,
    })
  );
};

/**
 * Verify access token
 */
export const verifyAccessToken = (token: AccessToken): Result<JWTPayload, JWTError> => {
  return tryCatch(
    () => {
      const decoded = jwt.verify(token, env.JWT_SECRET, {
        issuer: 'agentic-travel',
        audience: 'agentic-travel-api',
      }) as JWTPayload;
      
      return decoded;
    },
    (error) => {
      if (error instanceof jwt.TokenExpiredError) {
        return {
          type: 'TOKEN_EXPIRED',
          message: 'Access token has expired',
        };
      }
      if (error instanceof jwt.JsonWebTokenError) {
        return {
          type: 'INVALID_TOKEN',
          message: 'Invalid access token',
        };
      }
      return {
        type: 'VERIFICATION_ERROR',
        message: `Token verification failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  );
};

/**
 * Verify refresh token
 */
export const verifyRefreshToken = (token: RefreshToken): Result<RefreshTokenPayload, JWTError> => {
  return tryCatch(
    () => {
      const decoded = jwt.verify(token, env.JWT_REFRESH_SECRET, {
        issuer: 'agentic-travel',
        audience: 'agentic-travel-refresh',
      }) as RefreshTokenPayload;
      
      return decoded;
    },
    (error) => {
      if (error instanceof jwt.TokenExpiredError) {
        return {
          type: 'TOKEN_EXPIRED',
          message: 'Refresh token has expired',
        };
      }
      if (error instanceof jwt.JsonWebTokenError) {
        return {
          type: 'INVALID_TOKEN',
          message: 'Invalid refresh token',
        };
      }
      return {
        type: 'VERIFICATION_ERROR',
        message: `Token verification failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  );
};

/**
 * Generate token pair (access + refresh)
 */
export const generateTokenPair = (
  userId: UserId,
  email: string,
  sessionId: string,
  role: 'user' | 'admin' | 'moderator',
  rememberMe = false
): Result<{ accessToken: AccessToken; refreshToken: RefreshToken }, JWTError> => {
  // Generate access token
  const accessResult = generateAccessToken({
    sub: userId,
    email,
    sessionId,
    role,
  });
  
  if (isErr(accessResult)) {
    return err(accessResult.error);
  }
  
  // Generate refresh token
  const refreshResult = generateRefreshToken(userId, sessionId, rememberMe);
  
  if (isErr(refreshResult)) {
    return err(refreshResult.error);
  }
  
  return ok({
    accessToken: (isOk(accessResult) ? accessResult.value : undefined),
    refreshToken: (isOk(refreshResult) ? refreshResult.value : undefined),
  });
};

/**
 * Decode token without verification (for debugging)
 */
export const decodeToken = (token: string): Result<JWTPayload | RefreshTokenPayload, JWTError> => {
  return tryCatch(
    () => {
      const decoded = jwt.decode(token) as JWTPayload | RefreshTokenPayload;
      if (!decoded) {
        throw new Error('Failed to decode token');
      }
      return decoded;
    },
    () => ({
      type: 'INVALID_TOKEN',
      message: 'Failed to decode token',
    })
  );
};

/**
 * Check if token is expired
 */
export const isTokenExpired = (token: string): boolean => {
  const decoded = decodeToken(token);
  if (!decoded.ok || isErr(decoded).exp) {
    return true;
  }
  
  const now = Math.floor(Date.now() / 1000);
  return isOk(decoded) ? decoded.value : null.exp < now;
};

/**
 * Get token expiration time
 */
export const getTokenExpiration = (token: string): Result<Date, JWTError> => {
  const decoded = decodeToken(token);
  if (isErr(decoded)) {
    return err(decoded.error);
  }
  
  if (isErr(decoded).exp) {
    return err({
      type: 'INVALID_TOKEN',
      message: 'Token does not have expiration',
    });
  }
  
  return ok(new Date(decoded.value.exp * 1000));
};
// Re-export branded types from canonical source
export { AccessToken, RefreshToken } from '@/types/brandedTypes';
