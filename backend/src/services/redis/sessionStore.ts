/**
 * Redis-based session store for secure session management
 * Handles session creation, retrieval, updates, and cleanup
 */

import { RedisClient } from './redisClient';
import { Result, ok, err } from '../../utils/result';
import { AppError, ErrorCodes } from '../../middleware/errorHandler';
import { v4 as uuidv4 } from 'uuid';

export interface SessionData {
  userId: string;
  email: string;
  isAuthenticated: boolean;
  loginTime: number;
  lastActivity: number;
  ipAddress?: string;
  userAgent?: string;
  metadata?: Record<string, any>;
}

export interface SessionConfig {
  ttlSeconds: number;
  keyPrefix: string;
  maxSessionsPerUser: number;
  extendOnActivity: boolean;
  requireRefresh: boolean;
}

export class SessionStore {
  private redisClient: RedisClient;
  private config: SessionConfig;

  constructor(redisClient: RedisClient, config?: Partial<SessionConfig>) {
    this.redisClient = redisClient;
    this.config = {
      ttlSeconds: 24 * 60 * 60, // 24 hours
      keyPrefix: 'session:',
      maxSessionsPerUser: 5,
      extendOnActivity: true,
      requireRefresh: false,
      ...config
    };
  }

  /**
   * Create a new session
   */
  async createSession(sessionData: Omit<SessionData, 'loginTime' | 'lastActivity'>): Promise<Result<string, AppError>> {
    try {
      const sessionId = uuidv4();
      const sessionKey = this.getSessionKey(sessionId);
      
      const completeSessionData: SessionData = {
        ...sessionData,
        loginTime: Date.now(),
        lastActivity: Date.now()
      };

      // Check if user has too many sessions
      const cleanupResult = await this.cleanupUserSessions(sessionData.userId);
      if (!cleanupResult.success) {
        // Log warning but don't fail session creation
        console.warn('Failed to cleanup user sessions:', cleanupResult.error.message);
      }

      // Store session data
      const setResult = await this.redisClient.set(
        sessionKey,
        JSON.stringify(completeSessionData),
        this.config.ttlSeconds
      );

      if (!setResult.success) {
        return err(setResult.error);
      }

      // Add session to user's session list
      const userSessionsResult = await this.addToUserSessions(sessionData.userId, sessionId);
      if (!userSessionsResult.success) {
        // Clean up the session we just created
        await this.redisClient.del(sessionKey);
        return err(userSessionsResult.error);
      }

      return ok(sessionId);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Session creation failed';
      return err(new AppError(500, `Failed to create session: ${message}`, ErrorCodes.DATABASE_ERROR));
    }
  }

  /**
   * Retrieve session data
   */
  async getSession(sessionId: string): Promise<Result<SessionData | null, AppError>> {
    try {
      if (!sessionId) {
        return err(new AppError(400, 'Session ID is required', ErrorCodes.VALIDATION_ERROR));
      }

      const sessionKey = this.getSessionKey(sessionId);
      const getResult = await this.redisClient.get(sessionKey);

      if (!getResult.success) {
        return err(getResult.error);
      }

      if (!getResult.data) {
        return ok(null);
      }

      const sessionData: SessionData = JSON.parse(getResult.data);

      // Extend session if configured
      if (this.config.extendOnActivity) {
        sessionData.lastActivity = Date.now();
        const updateResult = await this.updateSession(sessionId, sessionData);
        if (!updateResult.success) {
          // Log warning but return session data
          console.warn('Failed to extend session:', updateResult.error.message);
        }
      }

      return ok(sessionData);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Session retrieval failed';
      return err(new AppError(500, `Failed to get session: ${message}`, ErrorCodes.DATABASE_ERROR));
    }
  }

  /**
   * Update session data
   */
  async updateSession(sessionId: string, sessionData: SessionData): Promise<Result<void, AppError>> {
    try {
      if (!sessionId) {
        return err(new AppError(400, 'Session ID is required', ErrorCodes.VALIDATION_ERROR));
      }

      const sessionKey = this.getSessionKey(sessionId);
      
      // Check if session exists
      const existsResult = await this.redisClient.exists(sessionKey);
      if (!existsResult.success) {
        return err(existsResult.error);
      }

      if (!existsResult.data) {
        return err(new AppError(404, 'Session not found', ErrorCodes.NOT_FOUND));
      }

      sessionData.lastActivity = Date.now();

      const setResult = await this.redisClient.set(
        sessionKey,
        JSON.stringify(sessionData),
        this.config.ttlSeconds
      );

      return setResult.success ? ok(undefined) : err(setResult.error);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Session update failed';
      return err(new AppError(500, `Failed to update session: ${message}`, ErrorCodes.DATABASE_ERROR));
    }
  }

  /**
   * Delete a session
   */
  async deleteSession(sessionId: string): Promise<Result<void, AppError>> {
    try {
      if (!sessionId) {
        return err(new AppError(400, 'Session ID is required', ErrorCodes.VALIDATION_ERROR));
      }

      const sessionKey = this.getSessionKey(sessionId);
      
      // Get session data to find user ID for cleanup
      const sessionResult = await this.getSession(sessionId);
      if (sessionResult.success && sessionResult.data) {
        await this.removeFromUserSessions(sessionResult.data.userId, sessionId);
      }

      const delResult = await this.redisClient.del(sessionKey);
      return delResult.success ? ok(undefined) : err(delResult.error);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Session deletion failed';
      return err(new AppError(500, `Failed to delete session: ${message}`, ErrorCodes.DATABASE_ERROR));
    }
  }

  /**
   * Delete all sessions for a user
   */
  async deleteUserSessions(userId: string): Promise<Result<number, AppError>> {
    try {
      if (!userId) {
        return err(new AppError(400, 'User ID is required', ErrorCodes.VALIDATION_ERROR));
      }

      const userSessionsKey = this.getUserSessionsKey(userId);
      const sessionIdsResult = await this.redisClient.get(userSessionsKey);

      if (!sessionIdsResult.success) {
        return err(sessionIdsResult.error);
      }

      if (!sessionIdsResult.data) {
        return ok(0);
      }

      const sessionIds: string[] = JSON.parse(sessionIdsResult.data);
      let deletedCount = 0;

      // Delete each session
      for (const sessionId of sessionIds) {
        const sessionKey = this.getSessionKey(sessionId);
        const delResult = await this.redisClient.del(sessionKey);
        if (delResult.success && delResult.data > 0) {
          deletedCount++;
        }
      }

      // Delete user sessions list
      await this.redisClient.del(userSessionsKey);

      return ok(deletedCount);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'User sessions deletion failed';
      return err(new AppError(500, `Failed to delete user sessions: ${message}`, ErrorCodes.DATABASE_ERROR));
    }
  }

  /**
   * Get all active sessions for a user
   */
  async getUserSessions(userId: string): Promise<Result<SessionData[], AppError>> {
    try {
      if (!userId) {
        return err(new AppError(400, 'User ID is required', ErrorCodes.VALIDATION_ERROR));
      }

      const userSessionsKey = this.getUserSessionsKey(userId);
      const sessionIdsResult = await this.redisClient.get(userSessionsKey);

      if (!sessionIdsResult.success) {
        return err(sessionIdsResult.error);
      }

      if (!sessionIdsResult.data) {
        return ok([]);
      }

      const sessionIds: string[] = JSON.parse(sessionIdsResult.data);
      const sessions: SessionData[] = [];

      // Get each session's data
      for (const sessionId of sessionIds) {
        const sessionResult = await this.getSession(sessionId);
        if (sessionResult.success && sessionResult.data) {
          sessions.push(sessionResult.data);
        }
      }

      return ok(sessions);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'User sessions retrieval failed';
      return err(new AppError(500, `Failed to get user sessions: ${message}`, ErrorCodes.DATABASE_ERROR));
    }
  }

  /**
   * Validate session and return user info
   */
  async validateSession(sessionId: string): Promise<Result<SessionData | null, AppError>> {
    try {
      const sessionResult = await this.getSession(sessionId);
      
      if (!sessionResult.success) {
        return err(sessionResult.error);
      }

      if (!sessionResult.data) {
        return ok(null);
      }

      const session = sessionResult.data;

      // Check if session is expired (additional check beyond Redis TTL)
      const now = Date.now();
      const sessionAge = now - session.loginTime;
      const maxAge = this.config.ttlSeconds * 1000;

      if (sessionAge > maxAge) {
        await this.deleteSession(sessionId);
        return ok(null);
      }

      // Check if session requires refresh
      if (this.config.requireRefresh) {
        const lastActivityAge = now - session.lastActivity;
        const refreshThreshold = maxAge * 0.8; // Refresh at 80% of max age

        if (lastActivityAge > refreshThreshold) {
          return err(new AppError(401, 'Session requires refresh', ErrorCodes.UNAUTHORIZED));
        }
      }

      return ok(session);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Session validation failed';
      return err(new AppError(500, `Failed to validate session: ${message}`, ErrorCodes.DATABASE_ERROR));
    }
  }

  /**
   * Clean up expired sessions and enforce user session limits
   */
  async cleanupUserSessions(userId: string): Promise<Result<void, AppError>> {
    try {
      const sessionsResult = await this.getUserSessions(userId);
      if (!sessionsResult.success) {
        return err(sessionsResult.error);
      }

      const sessions = sessionsResult.data;
      
      // Sort by lastActivity (oldest first)
      sessions.sort((a, b) => a.lastActivity - b.lastActivity);

      // Remove excess sessions
      const excessCount = sessions.length - this.config.maxSessionsPerUser;
      if (excessCount > 0) {
        const sessionsToRemove = sessions.slice(0, excessCount);
        
        for (const session of sessionsToRemove) {
          // Find session ID by checking each session
          const userSessionsKey = this.getUserSessionsKey(userId);
          const sessionIdsResult = await this.redisClient.get(userSessionsKey);
          
          if (sessionIdsResult.success && sessionIdsResult.data) {
            const sessionIds: string[] = JSON.parse(sessionIdsResult.data);
            
            // Find matching session ID (this is inefficient but works for the constraint)
            for (const sessionId of sessionIds) {
              const sessionDataResult = await this.getSession(sessionId);
              if (sessionDataResult.success && 
                  sessionDataResult.data && 
                  sessionDataResult.data.loginTime === session.loginTime) {
                await this.deleteSession(sessionId);
                break;
              }
            }
          }
        }
      }

      return ok(undefined);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Session cleanup failed';
      return err(new AppError(500, `Failed to cleanup sessions: ${message}`, ErrorCodes.DATABASE_ERROR));
    }
  }

  /**
   * Get session statistics
   */
  async getSessionStats(): Promise<Result<{
    totalSessions: number;
    activeUsers: number;
    averageSessionAge: number;
  }, AppError>> {
    try {
      const pattern = `${this.config.keyPrefix}*`;
      const keysResult = await this.redisClient.keys(pattern);
      
      if (!keysResult.success) {
        return err(keysResult.error);
      }

      const sessionKeys = keysResult.data.filter(key => 
        key.startsWith(this.config.keyPrefix) && 
        !key.includes(':users:')
      );

      const totalSessions = sessionKeys.length;
      const activeUsers = new Set<string>();
      let totalAge = 0;
      let validSessions = 0;

      for (const key of sessionKeys) {
        const sessionResult = await this.redisClient.get(key);
        if (sessionResult.success && sessionResult.data) {
          try {
            const session: SessionData = JSON.parse(sessionResult.data);
            activeUsers.add(session.userId);
            totalAge += Date.now() - session.loginTime;
            validSessions++;
          } catch {
            // Skip invalid session data
          }
        }
      }

      const averageSessionAge = validSessions > 0 ? totalAge / validSessions : 0;

      return ok({
        totalSessions,
        activeUsers: activeUsers.size,
        averageSessionAge
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Session stats retrieval failed';
      return err(new AppError(500, `Failed to get session stats: ${message}`, ErrorCodes.DATABASE_ERROR));
    }
  }

  private getSessionKey(sessionId: string): string {
    return `${this.config.keyPrefix}${sessionId}`;
  }

  private getUserSessionsKey(userId: string): string {
    return `${this.config.keyPrefix}users:${userId}`;
  }

  private async addToUserSessions(userId: string, sessionId: string): Promise<Result<void, AppError>> {
    try {
      const userSessionsKey = this.getUserSessionsKey(userId);
      const existingResult = await this.redisClient.get(userSessionsKey);
      
      if (!existingResult.success) {
        return err(existingResult.error);
      }

      const sessionIds: string[] = existingResult.data ? JSON.parse(existingResult.data) : [];
      
      if (!sessionIds.includes(sessionId)) {
        sessionIds.push(sessionId);
        
        const setResult = await this.redisClient.set(
          userSessionsKey,
          JSON.stringify(sessionIds),
          this.config.ttlSeconds
        );
        
        if (!setResult.success) {
          return err(setResult.error);
        }
      }

      return ok(undefined);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to add session to user list';
      return err(new AppError(500, message, ErrorCodes.DATABASE_ERROR));
    }
  }

  private async removeFromUserSessions(userId: string, sessionId: string): Promise<Result<void, AppError>> {
    try {
      const userSessionsKey = this.getUserSessionsKey(userId);
      const existingResult = await this.redisClient.get(userSessionsKey);
      
      if (!existingResult.success) {
        return err(existingResult.error);
      }

      if (!existingResult.data) {
        return ok(undefined);
      }

      const sessionIds: string[] = JSON.parse(existingResult.data);
      const filteredIds = sessionIds.filter(id => id !== sessionId);
      
      if (filteredIds.length === 0) {
        await this.redisClient.del(userSessionsKey);
      } else {
        const setResult = await this.redisClient.set(
          userSessionsKey,
          JSON.stringify(filteredIds),
          this.config.ttlSeconds
        );
        
        if (!setResult.success) {
          return err(setResult.error);
        }
      }

      return ok(undefined);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to remove session from user list';
      return err(new AppError(500, message, ErrorCodes.DATABASE_ERROR));
    }
  }
}