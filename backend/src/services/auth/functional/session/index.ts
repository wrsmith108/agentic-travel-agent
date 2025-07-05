/**
 * Functional Auth Service - Session Management Module
 *
 * Manages user sessions and JWT token generation/validation
 */

import jwt from 'jsonwebtoken';
import { createTimestamp } from '@/services/auth/functional/types';
import { v4 as uuidv4 } from 'uuid';
import { env } from '@/config/env';
import { logInfo, logWarn, logError } from '@/utils/logger';
import { AUTH_CONSTANTS } from '@/schemas/auth';
import { storage } from '../storage';
import type {
  SessionId,
  UserId,
  JWTToken,
  SessionStorage,
  SessionCreationOptions,
  SessionCreationResult,
  JWTConfig,
  SessionUser,
  SessionData,
  JWTPayload,
} from '../types';

// ===== Session Storage =====

const sessions: SessionStorage = {};

// ===== JWT Configuration =====

const getJWTConfig = (): JWTConfig => ({
  secret: env.JWT_SECRET || storage.generateFallbackSecret(),
  refreshSecret: env.JWT_REFRESH_SECRET || storage.generateFallbackSecret(),
  issuer: 'agentic-travel-agent',
  audience: 'agentic-travel-agent-users',
});

// ===== Session Management Functions =====

export const createSession = async (
  options: SessionCreationOptions
): Promise<SessionCreationResult> => {
  const { user, duration = AUTH_CONSTANTS.SESSION_DURATION.DEFAULT, deviceInfo } = options;

  const sessionId = uuidv4() as SessionId;
  const now = new Date();
  const expiresAt = new Date(now.getTime() + duration * 1000);
  const config = getJWTConfig();

  // Create session data
  const sessionData: SessionData = {
    sessionId,
    userId: user.id,
    user,
    createdAt: createTimestamp(),
    expiresAt: createTimestamp(expiresAt),
    lastAccessedAt: createTimestamp(),
    ipAddress: deviceInfo?.ipAddress,
    userAgent: deviceInfo?.userAgent,
    deviceFingerprint: deviceInfo?.fingerprint,
    isActive: true,
    loginMethod: 'email',
  };

  // Store session
  sessions[sessionId] = sessionData;

  // Create JWT payload
  const jwtPayload: JWTPayload = {
    sub: user.id,
    email: user.email,
    role: user.role,
    sessionId,
    iat: Math.floor(now.getTime() / 1000),
    exp: Math.floor(expiresAt.getTime() / 1000),
    iss: config.issuer,
    aud: config.audience,
  };

  // Sign JWT token
  const accessToken = jwt.sign(jwtPayload, config.secret) as JWTToken;

  // Create refresh token for longer sessions
  let refreshToken: JWTToken | undefined;
  if (duration > AUTH_CONSTANTS.SESSION_DURATION.DEFAULT) {
    // Remove expiresIn option since payload already contains exp property
    refreshToken = jwt.sign({ ...jwtPayload, type: 'refresh' }, config.refreshSecret) as JWTToken;
  }

  logInfo('Session created', {
    sessionId,
    userId: user.id,
    email: user.email,
    hasRefreshToken: !!refreshToken,
  });

  return {
    sessionId,
    accessToken,
    refreshToken,
    expiresAt: expiresAt.toISOString(),
  };
};

export const validateSession = (sessionId: string): SessionUser | null => {
  const sessionData = sessions[sessionId];
  if (!sessionData) {
    return null;
  }

  // Check if session is expired
  if (new Date(sessionData.expiresAt) < new Date()) {
    delete sessions[sessionId];
    return null;
  }

  // Check if session is active
  if (!sessionData.isActive) {
    return null;
  }

  // Update last accessed time
  const updatedSessionData = {
    ...sessionData,
    lastAccessedAt: createTimestamp(),
  };
  sessions[sessionId] = updatedSessionData;

  return sessionData.user;
};

export const validateJWTToken = async (token: string): Promise<JWTPayload | null> => {
  try {
    const config = getJWTConfig();
    const payload = jwt.verify(token, config.secret) as JWTPayload;

    // Validate session still exists
    const sessionUser = validateSession(payload.sessionId);
    if (!sessionUser) {
      return null;
    }

    return payload;
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      logWarn('Invalid JWT token', { error: error.message });
    } else {
      logError('JWT token validation failed', error);
    }
    return null;
  }
};

export const invalidateSession = (sessionId: string): boolean => {
  const sessionData = sessions[sessionId];
  if (sessionData) {
    delete sessions[sessionId];

    logInfo('Session invalidated', {
      userId: sessionData.userId,
      sessionId,
    });

    return true;
  }

  return false;
};

export const invalidateAllUserSessions = (userId: string): void => {
  const sessionIds = Object.keys(sessions).filter(
    (sessionId) => sessions[sessionId]?.userId === userId
  );

  for (const sessionId of sessionIds) {
    delete sessions[sessionId];
  }

  logInfo('All user sessions invalidated', { userId, sessionCount: sessionIds.length });
};

export const invalidateOtherUserSessions = (userId: string, keepSessionId?: string): void => {
  const sessionIds = Object.keys(sessions).filter(
    (sessionId) => sessions[sessionId]?.userId === userId && sessionId !== keepSessionId
  );

  for (const sessionId of sessionIds) {
    delete sessions[sessionId];
  }

  logInfo('Other user sessions invalidated', { userId, sessionCount: sessionIds.length });
};

export const getActiveSessionCount = (userId: string): number => {
  return Object.values(sessions).filter((session) => session.userId === userId && session.isActive)
    .length;
};

export const getSessionInfo = (sessionId: string): SessionData | null => {
  return sessions[sessionId] || null;
};

export const updateSessionActivity = (sessionId: string): void => {
  const session = sessions[sessionId];
  if (session) {
    const updatedSession = {
      ...session,
      lastAccessedAt: createTimestamp(),
    };
    sessions[sessionId] = updatedSession;
  }
};

// ===== Cleanup Functions =====

export const cleanupExpiredSessions = (): void => {
  const now = new Date();
  let cleanedCount = 0;

  for (const [sessionId, sessionData] of Object.entries(sessions)) {
    if (new Date(sessionData.expiresAt) < now) {
      delete sessions[sessionId];
      cleanedCount++;
    }
  }

  if (cleanedCount > 0) {
    logInfo('Expired sessions cleaned up', { count: cleanedCount });
  }
};

// ===== Export Session Functions =====

export const session = {
  create: createSession,
  validate: validateSession,
  validateJWT: validateJWTToken,
  invalidate: invalidateSession,
  invalidateAllForUser: invalidateAllUserSessions,
  invalidateOthersForUser: invalidateOtherUserSessions,
  getActiveCount: getActiveSessionCount,
  getInfo: getSessionInfo,
  updateActivity: updateSessionActivity,
  cleanupExpired: cleanupExpiredSessions,
} as const;
