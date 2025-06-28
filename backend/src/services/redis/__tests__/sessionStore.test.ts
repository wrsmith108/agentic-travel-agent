import { SessionStore, SessionData } from '../sessionStore';
import { RedisClient } from '../redisClient';
import { isOk, isErr } from '../../../utils/result';
import { ok, err } from '../../../utils/result';
import { AppError, ErrorCodes } from '../../../middleware/errorHandler';

// Mock RedisClient
jest.mock('../redisClient');

describe('SessionStore', () => {
  let sessionStore: SessionStore;
  let mockRedisClient: jest.Mocked<RedisClient>;

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockRedisClient = {
      set: jest.fn(),
      get: jest.fn(),
      del: jest.fn(),
      exists: jest.fn(),
      keys: jest.fn(),
      expire: jest.fn(),
      ttl: jest.fn(),
      connect: jest.fn(),
      disconnect: jest.fn(),
      ping: jest.fn(),
      flushall: jest.fn(),
      multiSet: jest.fn(),
      multiGet: jest.fn(),
      isReady: jest.fn(),
      getConnectionInfo: jest.fn()
    } as any;

    sessionStore = new SessionStore(mockRedisClient, {
      ttlSeconds: 3600,
      keyPrefix: 'test:session:',
      maxSessionsPerUser: 3
    });
  });

  describe('Session Creation', () => {
    const mockSessionData = {
      userId: 'user123',
      email: 'user@example.com',
      isAuthenticated: true
    };

    it('should create a new session successfully', async () => {
      mockRedisClient.set.mockResolvedValue(ok(undefined));
      mockRedisClient.get.mockResolvedValue(ok(null)); // No existing user sessions

      const result = await sessionStore.createSession(mockSessionData);
      
      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.data).toMatch(/^[0-9a-f-]{36}$/); // UUID format
      }
      
      expect(mockRedisClient.set).toHaveBeenCalledTimes(2); // Session data + user sessions list
    });

    it('should include login and activity timestamps', async () => {
      mockRedisClient.set.mockResolvedValue(ok(undefined));
      mockRedisClient.get.mockResolvedValue(ok(null));

      const beforeTime = Date.now();
      await sessionStore.createSession(mockSessionData);
      const afterTime = Date.now();

      const setCall = mockRedisClient.set.mock.calls[0];
      const sessionDataString = setCall[1] as string;
      const savedSessionData: SessionData = JSON.parse(sessionDataString);
      
      expect(savedSessionData.loginTime).toBeGreaterThanOrEqual(beforeTime);
      expect(savedSessionData.loginTime).toBeLessThanOrEqual(afterTime);
      expect(savedSessionData.lastActivity).toBe(savedSessionData.loginTime);
    });

    it('should handle Redis errors during creation', async () => {
      mockRedisClient.set.mockResolvedValue(err(new AppError(500, 'Redis error', ErrorCodes.DATABASE_ERROR)));

      const result = await sessionStore.createSession(mockSessionData);
      
      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error.code).toBe(ErrorCodes.DATABASE_ERROR);
      }
    });

    it('should cleanup old sessions when user has too many', async () => {
      // Mock existing user sessions
      const existingSessions = JSON.stringify(['session1', 'session2', 'session3', 'session4']);
      mockRedisClient.get.mockImplementation((key: string) => {
        if (key.includes('users:')) {
          return Promise.resolve(ok(existingSessions));
        }
        return Promise.resolve(ok(null));
      });
      mockRedisClient.set.mockResolvedValue(ok(undefined));

      const result = await sessionStore.createSession(mockSessionData);
      
      expect(isOk(result)).toBe(true);
      // Should attempt to cleanup existing sessions
      expect(mockRedisClient.get).toHaveBeenCalledWith(expect.stringContaining('users:'));
    });
  });

  describe('Session Retrieval', () => {
    const sessionId = 'test-session-id';
    const mockSessionData: SessionData = {
      userId: 'user123',
      email: 'user@example.com',
      isAuthenticated: true,
      loginTime: Date.now() - 1000,
      lastActivity: Date.now() - 500
    };

    it('should retrieve session successfully', async () => {
      mockRedisClient.get.mockResolvedValue(ok(JSON.stringify(mockSessionData)));
      mockRedisClient.set.mockResolvedValue(ok(undefined)); // For activity update

      const result = await sessionStore.getSession(sessionId);
      
      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.data?.userId).toBe(mockSessionData.userId);
        expect(result.data?.email).toBe(mockSessionData.email);
        expect(result.data?.lastActivity).toBeGreaterThan(mockSessionData.lastActivity);
      }
    });

    it('should return null for non-existent session', async () => {
      mockRedisClient.get.mockResolvedValue(ok(null));

      const result = await sessionStore.getSession(sessionId);
      
      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.data).toBeNull();
      }
    });

    it('should validate session ID', async () => {
      const result = await sessionStore.getSession('');
      
      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error.code).toBe(ErrorCodes.VALIDATION_ERROR);
      }
    });

    it('should handle malformed session data', async () => {
      mockRedisClient.get.mockResolvedValue(ok('invalid-json'));

      const result = await sessionStore.getSession(sessionId);
      
      expect(isErr(result)).toBe(true);
    });
  });

  describe('Session Updates', () => {
    const sessionId = 'test-session-id';
    const mockSessionData: SessionData = {
      userId: 'user123',
      email: 'user@example.com',
      isAuthenticated: true,
      loginTime: Date.now() - 1000,
      lastActivity: Date.now() - 500
    };

    it('should update session successfully', async () => {
      mockRedisClient.exists.mockResolvedValue(ok(true));
      mockRedisClient.set.mockResolvedValue(ok(undefined));

      const result = await sessionStore.updateSession(sessionId, mockSessionData);
      
      expect(isOk(result)).toBe(true);
      expect(mockRedisClient.set).toHaveBeenCalled();
    });

    it('should update last activity timestamp', async () => {
      mockRedisClient.exists.mockResolvedValue(ok(true));
      mockRedisClient.set.mockResolvedValue(ok(undefined));

      const beforeTime = Date.now();
      await sessionStore.updateSession(sessionId, mockSessionData);
      
      const setCall = mockRedisClient.set.mock.calls[0];
      const sessionDataString = setCall[1] as string;
      const updatedSessionData: SessionData = JSON.parse(sessionDataString);
      
      expect(updatedSessionData.lastActivity).toBeGreaterThanOrEqual(beforeTime);
    });

    it('should fail for non-existent session', async () => {
      mockRedisClient.exists.mockResolvedValue(ok(false));

      const result = await sessionStore.updateSession(sessionId, mockSessionData);
      
      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error.code).toBe(ErrorCodes.NOT_FOUND);
      }
    });
  });

  describe('Session Deletion', () => {
    const sessionId = 'test-session-id';

    it('should delete session successfully', async () => {
      const mockSessionData: SessionData = {
        userId: 'user123',
        email: 'user@example.com',
        isAuthenticated: true,
        loginTime: Date.now(),
        lastActivity: Date.now()
      };

      mockRedisClient.get.mockResolvedValue(ok(JSON.stringify(mockSessionData)));
      mockRedisClient.set.mockResolvedValue(ok(undefined)); // For user sessions update
      mockRedisClient.del.mockResolvedValue(ok(1));

      const result = await sessionStore.deleteSession(sessionId);
      
      expect(isOk(result)).toBe(true);
      expect(mockRedisClient.del).toHaveBeenCalledWith(`test:session:${sessionId}`);
    });

    it('should handle deletion of non-existent session', async () => {
      mockRedisClient.get.mockResolvedValue(ok(null));
      mockRedisClient.del.mockResolvedValue(ok(0));

      const result = await sessionStore.deleteSession(sessionId);
      
      expect(isOk(result)).toBe(true);
    });

    it('should validate session ID', async () => {
      const result = await sessionStore.deleteSession('');
      
      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error.code).toBe(ErrorCodes.VALIDATION_ERROR);
      }
    });
  });

  describe('User Session Management', () => {
    const userId = 'user123';

    it('should delete all user sessions', async () => {
      const sessionIds = ['session1', 'session2', 'session3'];
      mockRedisClient.get.mockResolvedValue(ok(JSON.stringify(sessionIds)));
      mockRedisClient.del.mockResolvedValue(ok(1));

      const result = await sessionStore.deleteUserSessions(userId);
      
      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.data).toBe(3); // 3 sessions deleted
      }
      expect(mockRedisClient.del).toHaveBeenCalledTimes(4); // 3 sessions + user list
    });

    it('should handle user with no sessions', async () => {
      mockRedisClient.get.mockResolvedValue(ok(null));

      const result = await sessionStore.deleteUserSessions(userId);
      
      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.data).toBe(0);
      }
    });

    it('should get all user sessions', async () => {
      const sessionIds = ['session1', 'session2'];
      const sessionData1: SessionData = {
        userId,
        email: 'user@example.com',
        isAuthenticated: true,
        loginTime: Date.now(),
        lastActivity: Date.now()
      };
      const sessionData2: SessionData = {
        userId,
        email: 'user@example.com',
        isAuthenticated: true,
        loginTime: Date.now() + 1000,
        lastActivity: Date.now() + 1000
      };

      mockRedisClient.get.mockImplementation((key: string) => {
        if (key.includes('users:')) {
          return Promise.resolve(ok(JSON.stringify(sessionIds)));
        }
        if (key.includes('session1')) {
          return Promise.resolve(ok(JSON.stringify(sessionData1)));
        }
        if (key.includes('session2')) {
          return Promise.resolve(ok(JSON.stringify(sessionData2)));
        }
        return Promise.resolve(ok(null));
      });
      mockRedisClient.set.mockResolvedValue(ok(undefined));

      const result = await sessionStore.getUserSessions(userId);
      
      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.data).toHaveLength(2);
        expect(result.data[0].userId).toBe(userId);
        expect(result.data[1].userId).toBe(userId);
      }
    });
  });

  describe('Session Validation', () => {
    const sessionId = 'test-session-id';

    it('should validate active session', async () => {
      const mockSessionData: SessionData = {
        userId: 'user123',
        email: 'user@example.com',
        isAuthenticated: true,
        loginTime: Date.now() - 1000,
        lastActivity: Date.now() - 500
      };

      mockRedisClient.get.mockResolvedValue(ok(JSON.stringify(mockSessionData)));
      mockRedisClient.set.mockResolvedValue(ok(undefined));

      const result = await sessionStore.validateSession(sessionId);
      
      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.data?.isAuthenticated).toBe(true);
      }
    });

    it('should return null for expired session', async () => {
      const expiredSessionData: SessionData = {
        userId: 'user123',
        email: 'user@example.com',
        isAuthenticated: true,
        loginTime: Date.now() - 7200000, // 2 hours ago
        lastActivity: Date.now() - 7200000
      };

      mockRedisClient.get.mockResolvedValue(ok(JSON.stringify(expiredSessionData)));
      mockRedisClient.del.mockResolvedValue(ok(1));

      const result = await sessionStore.validateSession(sessionId);
      
      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.data).toBeNull();
      }
      expect(mockRedisClient.del).toHaveBeenCalled(); // Should delete expired session
    });

    it('should return null for non-existent session', async () => {
      mockRedisClient.get.mockResolvedValue(ok(null));

      const result = await sessionStore.validateSession(sessionId);
      
      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.data).toBeNull();
      }
    });
  });

  describe('Session Statistics', () => {
    it('should get session statistics', async () => {
      const sessionKeys = [
        'test:session:session1',
        'test:session:session2',
        'test:session:users:user1'
      ];
      
      const sessionData1: SessionData = {
        userId: 'user1',
        email: 'user1@example.com',
        isAuthenticated: true,
        loginTime: Date.now() - 1000,
        lastActivity: Date.now() - 500
      };
      
      const sessionData2: SessionData = {
        userId: 'user2',
        email: 'user2@example.com',
        isAuthenticated: true,
        loginTime: Date.now() - 2000,
        lastActivity: Date.now() - 1000
      };

      mockRedisClient.keys.mockResolvedValue(ok(sessionKeys));
      mockRedisClient.get.mockImplementation((key: string) => {
        if (key.includes('session1')) {
          return Promise.resolve(ok(JSON.stringify(sessionData1)));
        }
        if (key.includes('session2')) {
          return Promise.resolve(ok(JSON.stringify(sessionData2)));
        }
        return Promise.resolve(ok(null));
      });

      const result = await sessionStore.getSessionStats();
      
      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.data.totalSessions).toBe(2);
        expect(result.data.activeUsers).toBe(2);
        expect(result.data.averageSessionAge).toBeGreaterThan(0);
      }
    });

    it('should handle empty session store', async () => {
      mockRedisClient.keys.mockResolvedValue(ok([]));

      const result = await sessionStore.getSessionStats();
      
      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.data.totalSessions).toBe(0);
        expect(result.data.activeUsers).toBe(0);
        expect(result.data.averageSessionAge).toBe(0);
      }
    });
  });

  describe('Session Cleanup', () => {
    const userId = 'user123';

    it('should cleanup excess sessions', async () => {
      const sessions: SessionData[] = [
        {
          userId,
          email: 'user@example.com',
          isAuthenticated: true,
          loginTime: Date.now() - 4000,
          lastActivity: Date.now() - 3000
        },
        {
          userId,
          email: 'user@example.com',
          isAuthenticated: true,
          loginTime: Date.now() - 2000,
          lastActivity: Date.now() - 1000
        },
        {
          userId,
          email: 'user@example.com',
          isAuthenticated: true,
          loginTime: Date.now() - 6000,
          lastActivity: Date.now() - 5000
        },
        {
          userId,
          email: 'user@example.com',
          isAuthenticated: true,
          loginTime: Date.now() - 1000,
          lastActivity: Date.now() - 500
        }
      ];

      // Mock getUserSessions to return 4 sessions (exceeds limit of 3)
      jest.spyOn(sessionStore, 'getUserSessions').mockResolvedValue(ok(sessions));
      mockRedisClient.get.mockResolvedValue(ok(JSON.stringify(['s1', 's2', 's3', 's4'])));
      mockRedisClient.del.mockResolvedValue(ok(1));

      const result = await sessionStore.cleanupUserSessions(userId);
      
      expect(isOk(result)).toBe(true);
      // Should attempt to delete the oldest session (index 2 with loginTime - 6000)
    });

    it('should handle cleanup when under session limit', async () => {
      const sessions: SessionData[] = [
        {
          userId,
          email: 'user@example.com',
          isAuthenticated: true,
          loginTime: Date.now() - 1000,
          lastActivity: Date.now() - 500
        }
      ];

      jest.spyOn(sessionStore, 'getUserSessions').mockResolvedValue(ok(sessions));

      const result = await sessionStore.cleanupUserSessions(userId);
      
      expect(isOk(result)).toBe(true);
      expect(mockRedisClient.del).not.toHaveBeenCalled();
    });
  });
});