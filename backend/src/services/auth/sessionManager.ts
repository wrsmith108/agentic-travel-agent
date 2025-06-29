/**
 * Session management using functional programming and Result pattern
 */

import { v4 as uuidv4 } from 'uuid';
import { Result, ok, err, isOk } from '@/utils/result';
import { UserId } from '@/types/brandedTypes';

// Session types
export type SessionId = string & { readonly brand: unique symbol };
export const asSessionId = (id: string): SessionId => id as SessionId;
export const createSessionId = (): SessionId => asSessionId(uuidv4());

export interface Session {
  id: SessionId;
  userId: UserId;
  createdAt: Date;
  expiresAt: Date;
  lastAccessedAt: Date;
  ipAddress?: string;
  userAgent?: string;
  refreshToken?: string;
}

export interface SessionData {
  userId: UserId;
  email: string;
  role: 'user' | 'admin' | 'moderator';
  permissions: string[];
}

// Error types
export type SessionError = 
  | { type: 'SESSION_NOT_FOUND'; message: string }
  | { type: 'SESSION_EXPIRED'; message: string }
  | { type: 'STORAGE_ERROR'; message: string }
  | { type: 'INVALID_SESSION'; message: string };

// In-memory session storage (replace with Redis in production)
const sessions = new Map<SessionId, Session>();
const userSessions = new Map<UserId, Set<SessionId>>();

// Session configuration
const SESSION_DURATION = 60 * 60 * 1000; // 1 hour
const REMEMBER_ME_DURATION = 30 * 24 * 60 * 60 * 1000; // 30 days

/**
 * Create a new session
 */
export const createSession = (
  userId: UserId,
  options?: {
    rememberMe?: boolean;
    ipAddress?: string;
    userAgent?: string;
    refreshToken?: string;
  }
): Result<Session, SessionError> => {
  try {
    const sessionId = createSessionId();
    const now = new Date();
    const duration = options?.rememberMe ? REMEMBER_ME_DURATION : SESSION_DURATION;
    
    const expiresAt = new Date(now.getTime() + duration);
    
    const session: Session = {
      id: sessionId,
      userId,
      createdAt: now,
      expiresAt,
      lastAccessedAt: now,
    };
    
    if (options?.ipAddress) {
      session.ipAddress = options.ipAddress;
    }
    
    if (options?.userAgent) {
      session.userAgent = options.userAgent;
    }
    
    if (options?.refreshToken) {
      session.refreshToken = options.refreshToken;
    }
    
    // Store session
    sessions.set(sessionId, session);
    
    // Track user sessions
    if (!userSessions.has(userId)) {
      userSessions.set(userId, new Set());
    }
    userSessions.get(userId)!.add(sessionId);
    
    // Clean up expired sessions for this user
    cleanupUserSessions(userId);
    
    return ok(session);
  } catch (error) {
    return err({
      type: 'STORAGE_ERROR',
      message: `Failed to create session: ${error instanceof Error ? error.message : 'Unknown error'}`,
    });
  }
};

/**
 * Get session by ID
 */
export const getSession = (sessionId: SessionId): Result<Session, SessionError> => {
  const session = sessions.get(sessionId);
  
  if (!session) {
    return err({
      type: 'SESSION_NOT_FOUND',
      message: 'Session not found',
    });
  }
  
  // Check if expired
  if (isSessionExpired(session)) {
    // Clean up expired session
    deleteSession(sessionId);
    return err({
      type: 'SESSION_EXPIRED',
      message: 'Session has expired',
    });
  }
  
  return ok(session);
};

/**
 * Update session last accessed time
 */
export const touchSession = (sessionId: SessionId): Result<Session, SessionError> => {
  const sessionResult = getSession(sessionId);
  
  if (isErr(sessionResult)) {
    return err(sessionResult.error);
  }
  
  const session = isOk(sessionResult) ? sessionResult.value : null;
  session.lastAccessedAt = new Date();
  
  sessions.set(sessionId, session);
  return ok(session);
};

/**
 * Delete a session
 */
export const deleteSession = (sessionId: SessionId): Result<void, SessionError> => {
  const session = sessions.get(sessionId);
  
  if (session) {
    // Remove from user sessions
    const userSessionSet = userSessions.get(session.userId);
    if (userSessionSet) {
      userSessionSet.delete(sessionId);
      if (userSessionSet.size === 0) {
        userSessions.delete(session.userId);
      }
    }
  }
  
  sessions.delete(sessionId);
  return ok(undefined);
};

/**
 * Delete all sessions for a user
 */
export const deleteUserSessions = (userId: UserId): Result<number, SessionError> => {
  const sessionIds = userSessions.get(userId);
  
  if (!sessionIds) {
    return ok(0);
  }
  
  let count = 0;
  for (const sessionId of sessionIds) {
    sessions.delete(sessionId);
    count++;
  }
  
  userSessions.delete(userId);
  return ok(count);
};

/**
 * Get all active sessions for a user
 */
export const getUserSessions = (userId: UserId): Result<Session[], SessionError> => {
  const sessionIds = userSessions.get(userId);
  
  if (!sessionIds) {
    return ok([]);
  }
  
  const activeSessions: Session[] = [];
  
  for (const sessionId of sessionIds) {
    const session = sessions.get(sessionId);
    if (session && !isSessionExpired(session)) {
      activeSessions.push(session);
    }
  }
  
  return ok(activeSessions);
};

/**
 * Update session with refresh token
 */
export const updateSessionRefreshToken = (
  sessionId: SessionId,
  refreshToken: string
): Result<Session, SessionError> => {
  const sessionResult = getSession(sessionId);
  
  if (isErr(sessionResult)) {
    return err(sessionResult.error);
  }
  
  const session = isOk(sessionResult) ? sessionResult.value : null;
  session.refreshToken = refreshToken;
  
  sessions.set(sessionId, session);
  return ok(session);
};

/**
 * Find session by refresh token
 */
export const findSessionByRefreshToken = (refreshToken: string): Result<Session, SessionError> => {
  for (const session of sessions.values()) {
    if (session.refreshToken === refreshToken && !isSessionExpired(session)) {
      return ok(session);
    }
  }
  
  return err({
    type: 'SESSION_NOT_FOUND',
    message: 'No session found with this refresh token',
  });
};

/**
 * Extend session expiration
 */
export const extendSession = (
  sessionId: SessionId,
  additionalTime?: number
): Result<Session, SessionError> => {
  const sessionResult = getSession(sessionId);
  
  if (isErr(sessionResult)) {
    return err(sessionResult.error);
  }
  
  const session = isOk(sessionResult) ? sessionResult.value : null;
  const extension = additionalTime || SESSION_DURATION;
  session.expiresAt = new Date(session.expiresAt.getTime() + extension);
  
  sessions.set(sessionId, session);
  return ok(session);
};

/**
 * Check if session is expired
 */
const isSessionExpired = (session: Session): boolean => {
  return session.expiresAt.getTime() < Date.now();
};

/**
 * Clean up expired sessions for a user
 */
const cleanupUserSessions = (userId: UserId): void => {
  const sessionIds = userSessions.get(userId);
  
  if (!sessionIds) {
    return;
  }
  
  const expiredIds: SessionId[] = [];
  
  for (const sessionId of sessionIds) {
    const session = sessions.get(sessionId);
    if (!session || isSessionExpired(session)) {
      expiredIds.push(sessionId);
    }
  }
  
  for (const sessionId of expiredIds) {
    deleteSession(sessionId);
  }
};

/**
 * Clean up all expired sessions (run periodically)
 */
export const cleanupExpiredSessions = (): number => {
  let count = 0;
  
  for (const [sessionId, session] of sessions.entries()) {
    if (isSessionExpired(session)) {
      deleteSession(sessionId);
      count++;
    }
  }
  
  return count;
};

/**
 * Get session statistics
 */
export const getSessionStats = (): {
  totalSessions: number;
  totalUsers: number;
  avgSessionsPerUser: number;
} => {
  const totalSessions = sessions.size;
  const totalUsers = userSessions.size;
  const avgSessionsPerUser = totalUsers > 0 ? totalSessions / totalUsers : 0;
  
  return {
    totalSessions,
    totalUsers,
    avgSessionsPerUser,
  };
};

// Schedule cleanup every 5 minutes
if (process.env.NODE_ENV !== 'test') {
  setInterval(() => {
    const cleaned = cleanupExpiredSessions();
    if (cleaned > 0) {
      console.log(`Cleaned up ${cleaned} expired sessions`);
    }
  }, 5 * 60 * 1000);
}