import { RedisClient } from '../redisClient';
import { isOk, isErr } from '../../../utils/result';

// Mock Redis client
jest.mock('redis', () => ({
  createClient: jest.fn(() => ({
    connect: jest.fn(),
    quit: jest.fn(),
    ping: jest.fn(),
    set: jest.fn(),
    setEx: jest.fn(),
    get: jest.fn(),
    del: jest.fn(),
    exists: jest.fn(),
    expire: jest.fn(),
    ttl: jest.fn(),
    keys: jest.fn(),
    flushAll: jest.fn(),
    mGet: jest.fn(),
    multi: jest.fn(() => ({
      set: jest.fn(),
      setEx: jest.fn(),
      exec: jest.fn()
    })),
    on: jest.fn()
  }))
}));

describe('RedisClient', () => {
  let redisClient: RedisClient;
  let mockClient: any;

  beforeEach(() => {
    jest.clearAllMocks();
    redisClient = new RedisClient({
      url: 'redis://localhost:6379',
      maxRetries: 3,
      retryDelay: 100,
      commandTimeout: 1000,
      connectTimeout: 2000
    });
    
    // Get the mock client instance
    const { createClient } = require('redis');
    mockClient = createClient();
  });

  describe('Connection Management', () => {
    it('should connect successfully', async () => {
      mockClient.connect.mockResolvedValue(undefined);

      const result = await redisClient.connect();
      
      expect(isOk(result)).toBe(true);
      expect(mockClient.connect).toHaveBeenCalled();
    });

    it('should handle connection errors', async () => {
      mockClient.connect.mockRejectedValue(new Error('Connection failed'));

      const result = await redisClient.connect();
      
      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error.message).toContain('Failed to connect to Redis');
      }
    });

    it('should disconnect successfully', async () => {
      mockClient.quit.mockResolvedValue(undefined);
      // Simulate connection
      redisClient['isConnected'] = true;

      const result = await redisClient.disconnect();
      
      expect(isOk(result)).toBe(true);
      expect(mockClient.quit).toHaveBeenCalled();
    });

    it('should handle disconnect errors', async () => {
      mockClient.quit.mockRejectedValue(new Error('Disconnect failed'));
      redisClient['isConnected'] = true;

      const result = await redisClient.disconnect();
      
      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error.message).toContain('Failed to disconnect from Redis');
      }
    });

    it('should ping Redis successfully', async () => {
      mockClient.ping.mockResolvedValue('PONG');
      mockClient.connect.mockResolvedValue(undefined);

      const result = await redisClient.ping();
      
      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.data).toBe('PONG');
      }
    });
  });

  describe('Basic Operations', () => {
    beforeEach(() => {
      redisClient['isConnected'] = true;
    });

    it('should set a value', async () => {
      mockClient.set.mockResolvedValue('OK');

      const result = await redisClient.set('test-key', 'test-value');
      
      expect(isOk(result)).toBe(true);
      expect(mockClient.set).toHaveBeenCalledWith('test-key', 'test-value');
    });

    it('should set a value with TTL', async () => {
      mockClient.setEx.mockResolvedValue('OK');

      const result = await redisClient.set('test-key', 'test-value', 3600);
      
      expect(isOk(result)).toBe(true);
      expect(mockClient.setEx).toHaveBeenCalledWith('test-key', 3600, 'test-value');
    });

    it('should get a value', async () => {
      mockClient.get.mockResolvedValue('test-value');

      const result = await redisClient.get('test-key');
      
      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.data).toBe('test-value');
      }
      expect(mockClient.get).toHaveBeenCalledWith('test-key');
    });

    it('should return null for non-existent key', async () => {
      mockClient.get.mockResolvedValue(null);

      const result = await redisClient.get('non-existent');
      
      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.data).toBe(null);
      }
    });

    it('should delete a key', async () => {
      mockClient.del.mockResolvedValue(1);

      const result = await redisClient.del('test-key');
      
      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.data).toBe(1);
      }
      expect(mockClient.del).toHaveBeenCalledWith('test-key');
    });

    it('should check if key exists', async () => {
      mockClient.exists.mockResolvedValue(1);

      const result = await redisClient.exists('test-key');
      
      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.data).toBe(true);
      }
    });

    it('should return false for non-existent key', async () => {
      mockClient.exists.mockResolvedValue(0);

      const result = await redisClient.exists('non-existent');
      
      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.data).toBe(false);
      }
    });
  });

  describe('TTL Operations', () => {
    beforeEach(() => {
      redisClient['isConnected'] = true;
    });

    it('should set expiration time', async () => {
      mockClient.expire.mockResolvedValue(true);

      const result = await redisClient.expire('test-key', 3600);
      
      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.data).toBe(true);
      }
      expect(mockClient.expire).toHaveBeenCalledWith('test-key', 3600);
    });

    it('should get TTL', async () => {
      mockClient.ttl.mockResolvedValue(3600);

      const result = await redisClient.ttl('test-key');
      
      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.data).toBe(3600);
      }
    });

    it('should return -1 for keys without expiration', async () => {
      mockClient.ttl.mockResolvedValue(-1);

      const result = await redisClient.ttl('persistent-key');
      
      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.data).toBe(-1);
      }
    });
  });

  describe('Advanced Operations', () => {
    beforeEach(() => {
      redisClient['isConnected'] = true;
    });

    it('should get keys by pattern', async () => {
      mockClient.keys.mockResolvedValue(['key1', 'key2', 'key3']);

      const result = await redisClient.keys('key*');
      
      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.data).toEqual(['key1', 'key2', 'key3']);
      }
    });

    it('should flush all keys', async () => {
      mockClient.flushAll.mockResolvedValue('OK');

      const result = await redisClient.flushall();
      
      expect(isOk(result)).toBe(true);
      expect(mockClient.flushAll).toHaveBeenCalled();
    });

    it('should set multiple values', async () => {
      const mockMulti = {
        set: jest.fn(),
        setEx: jest.fn(),
        exec: jest.fn().mockResolvedValue(['OK', 'OK'])
      };
      mockClient.multi.mockReturnValue(mockMulti);

      const entries = [
        { key: 'key1', value: 'value1' },
        { key: 'key2', value: 'value2', ttl: 3600 }
      ];

      const result = await redisClient.multiSet(entries);
      
      expect(isOk(result)).toBe(true);
      expect(mockMulti.set).toHaveBeenCalledWith('key1', 'value1');
      expect(mockMulti.setEx).toHaveBeenCalledWith('key2', 3600, 'value2');
      expect(mockMulti.exec).toHaveBeenCalled();
    });

    it('should get multiple values', async () => {
      mockClient.mGet.mockResolvedValue(['value1', 'value2', null]);

      const result = await redisClient.multiGet(['key1', 'key2', 'key3']);
      
      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.data).toEqual(['value1', 'value2', null]);
      }
    });
  });

  describe('Validation', () => {
    beforeEach(() => {
      redisClient['isConnected'] = true;
    });

    it('should reject empty keys', async () => {
      const result = await redisClient.set('', 'value');
      
      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error.message).toContain('key cannot be empty');
      }
    });

    it('should reject invalid TTL', async () => {
      const result = await redisClient.expire('key', -1);
      
      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error.message).toContain('TTL must be positive');
      }
    });

    it('should handle empty multi-set', async () => {
      const result = await redisClient.multiSet([]);
      
      expect(isOk(result)).toBe(true);
    });

    it('should reject multi-set with empty key', async () => {
      const entries = [{ key: '', value: 'value' }];
      
      const result = await redisClient.multiSet(entries);
      
      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error.message).toContain('must have keys');
      }
    });
  });

  describe('Connection Info', () => {
    it('should return connection information', () => {
      const info = redisClient.getConnectionInfo();
      
      expect(info).toHaveProperty('isConnected');
      expect(info).toHaveProperty('reconnectAttempts');
      expect(info).toHaveProperty('config');
      expect(info.config.url).toContain('***'); // Credentials should be hidden
    });

    it('should report ready status', () => {
      redisClient['isConnected'] = true;
      expect(redisClient.isReady()).toBe(true);
      
      redisClient['isConnected'] = false;
      expect(redisClient.isReady()).toBe(false);
    });
  });

  describe('Error Handling', () => {
    beforeEach(() => {
      redisClient['isConnected'] = true;
    });

    it('should handle Redis operation errors', async () => {
      mockClient.get.mockRejectedValue(new Error('Redis error'));

      const result = await redisClient.get('test-key');
      
      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error.message).toContain('Redis get failed');
      }
    });

    it('should auto-connect when disconnected', async () => {
      redisClient['isConnected'] = false;
      mockClient.connect.mockResolvedValue(undefined);
      mockClient.get.mockResolvedValue('value');

      const result = await redisClient.get('test-key');
      
      expect(mockClient.connect).toHaveBeenCalled();
      expect(isOk(result)).toBe(true);
    });
  });
});