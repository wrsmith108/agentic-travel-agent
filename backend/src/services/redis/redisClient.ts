/**
 * Redis client service for session management and caching
 * Provides connection management, health checks, and error handling
 */

import { createClient } from 'redis';
import { Result, ok, err } from '../../utils/result';
import { AppError, ErrorCodes } from '../../middleware/errorHandler';

export interface RedisConfig {
  url: string;
  maxRetries: number;
  retryDelay: number;
  commandTimeout: number;
  connectTimeout: number;
  lazyConnect: boolean;
}

export interface CacheEntry {
  key: string;
  value: string;
  ttl?: number;
}

export class RedisClient {
  private client: ReturnType<typeof createClient>;
  private isConnected: boolean = false;
  private config: RedisConfig;
  private reconnectAttempts: number = 0;

  constructor(config?: Partial<RedisConfig>) {
    this.config = {
      url: process.env.REDIS_URL || 'redis://localhost:6379',
      maxRetries: 3,
      retryDelay: 1000,
      commandTimeout: 5000,
      connectTimeout: 10000,
      lazyConnect: true,
      ...config
    };

    this.client = createClient({
      url: this.config.url,
      socket: {
        connectTimeout: this.config.connectTimeout,
        commandTimeout: this.config.commandTimeout,
        reconnectStrategy: (retries) => {
          if (retries >= this.config.maxRetries) {
            return false;
          }
          return Math.min(retries * this.config.retryDelay, 3000);
        }
      }
    });

    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    this.client.on('connect', () => {
      console.log('Redis client connected');
      this.isConnected = true;
      this.reconnectAttempts = 0;
    });

    this.client.on('ready', () => {
      console.log('Redis client ready');
    });

    this.client.on('error', (error) => {
      console.error('Redis client error:', error);
      this.isConnected = false;
    });

    this.client.on('end', () => {
      console.log('Redis client connection ended');
      this.isConnected = false;
    });

    this.client.on('reconnecting', () => {
      this.reconnectAttempts++;
      console.log(`Redis client reconnecting... (attempt ${this.reconnectAttempts})`);
    });
  }

  async connect(): Promise<Result<void, AppError>> {
    try {
      if (this.isConnected) {
        return ok(undefined);
      }

      await this.client.connect();
      this.isConnected = true;
      return ok(undefined);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown Redis connection error';
      return err(new AppError(500, `Failed to connect to Redis: ${message}`, ErrorCodes.DATABASE_ERROR));
    }
  }

  async disconnect(): Promise<Result<void, AppError>> {
    try {
      if (!this.isConnected) {
        return ok(undefined);
      }

      await this.client.quit();
      this.isConnected = false;
      return ok(undefined);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown Redis disconnection error';
      return err(new AppError(500, `Failed to disconnect from Redis: ${message}`, ErrorCodes.DATABASE_ERROR));
    }
  }

  async ping(): Promise<Result<string, AppError>> {
    try {
      if (!this.isConnected) {
        const connectResult = await this.connect();
        if (!connectResult.success) {
          return err(connectResult.error);
        }
      }

      const response = await this.client.ping();
      return ok(response);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Redis ping failed';
      return err(new AppError(500, `Redis ping failed: ${message}`, ErrorCodes.DATABASE_ERROR));
    }
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<Result<void, AppError>> {
    try {
      if (!key) {
        return err(new AppError(400, 'Redis key cannot be empty', ErrorCodes.VALIDATION_ERROR));
      }

      if (!this.isConnected) {
        const connectResult = await this.connect();
        if (!connectResult.success) {
          return err(connectResult.error);
        }
      }

      if (ttlSeconds) {
        await this.client.setEx(key, ttlSeconds, value);
      } else {
        await this.client.set(key, value);
      }

      return ok(undefined);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Redis set operation failed';
      return err(new AppError(500, `Redis set failed: ${message}`, ErrorCodes.DATABASE_ERROR));
    }
  }

  async get(key: string): Promise<Result<string | null, AppError>> {
    try {
      if (!key) {
        return err(new AppError(400, 'Redis key cannot be empty', ErrorCodes.VALIDATION_ERROR));
      }

      if (!this.isConnected) {
        const connectResult = await this.connect();
        if (!connectResult.success) {
          return err(connectResult.error);
        }
      }

      const value = await this.client.get(key);
      return ok(value);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Redis get operation failed';
      return err(new AppError(500, `Redis get failed: ${message}`, ErrorCodes.DATABASE_ERROR));
    }
  }

  async del(key: string): Promise<Result<number, AppError>> {
    try {
      if (!key) {
        return err(new AppError(400, 'Redis key cannot be empty', ErrorCodes.VALIDATION_ERROR));
      }

      if (!this.isConnected) {
        const connectResult = await this.connect();
        if (!connectResult.success) {
          return err(connectResult.error);
        }
      }

      const deletedCount = await this.client.del(key);
      return ok(deletedCount);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Redis delete operation failed';
      return err(new AppError(500, `Redis delete failed: ${message}`, ErrorCodes.DATABASE_ERROR));
    }
  }

  async exists(key: string): Promise<Result<boolean, AppError>> {
    try {
      if (!key) {
        return err(new AppError(400, 'Redis key cannot be empty', ErrorCodes.VALIDATION_ERROR));
      }

      if (!this.isConnected) {
        const connectResult = await this.connect();
        if (!connectResult.success) {
          return err(connectResult.error);
        }
      }

      const exists = await this.client.exists(key);
      return ok(exists === 1);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Redis exists operation failed';
      return err(new AppError(500, `Redis exists failed: ${message}`, ErrorCodes.DATABASE_ERROR));
    }
  }

  async expire(key: string, ttlSeconds: number): Promise<Result<boolean, AppError>> {
    try {
      if (!key) {
        return err(new AppError(400, 'Redis key cannot be empty', ErrorCodes.VALIDATION_ERROR));
      }

      if (ttlSeconds <= 0) {
        return err(new AppError(400, 'TTL must be positive', ErrorCodes.VALIDATION_ERROR));
      }

      if (!this.isConnected) {
        const connectResult = await this.connect();
        if (!connectResult.success) {
          return err(connectResult.error);
        }
      }

      const result = await this.client.expire(key, ttlSeconds);
      return ok(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Redis expire operation failed';
      return err(new AppError(500, `Redis expire failed: ${message}`, ErrorCodes.DATABASE_ERROR));
    }
  }

  async ttl(key: string): Promise<Result<number, AppError>> {
    try {
      if (!key) {
        return err(new AppError(400, 'Redis key cannot be empty', ErrorCodes.VALIDATION_ERROR));
      }

      if (!this.isConnected) {
        const connectResult = await this.connect();
        if (!connectResult.success) {
          return err(connectResult.error);
        }
      }

      const ttl = await this.client.ttl(key);
      return ok(ttl);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Redis TTL operation failed';
      return err(new AppError(500, `Redis TTL failed: ${message}`, ErrorCodes.DATABASE_ERROR));
    }
  }

  async keys(pattern: string): Promise<Result<string[], AppError>> {
    try {
      if (!pattern) {
        return err(new AppError(400, 'Redis pattern cannot be empty', ErrorCodes.VALIDATION_ERROR));
      }

      if (!this.isConnected) {
        const connectResult = await this.connect();
        if (!connectResult.success) {
          return err(connectResult.error);
        }
      }

      const keys = await this.client.keys(pattern);
      return ok(keys);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Redis keys operation failed';
      return err(new AppError(500, `Redis keys failed: ${message}`, ErrorCodes.DATABASE_ERROR));
    }
  }

  async flushall(): Promise<Result<void, AppError>> {
    try {
      if (!this.isConnected) {
        const connectResult = await this.connect();
        if (!connectResult.success) {
          return err(connectResult.error);
        }
      }

      await this.client.flushAll();
      return ok(undefined);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Redis flushall operation failed';
      return err(new AppError(500, `Redis flushall failed: ${message}`, ErrorCodes.DATABASE_ERROR));
    }
  }

  async multiSet(entries: CacheEntry[]): Promise<Result<void, AppError>> {
    try {
      if (!entries || entries.length === 0) {
        return ok(undefined);
      }

      if (!this.isConnected) {
        const connectResult = await this.connect();
        if (!connectResult.success) {
          return err(connectResult.error);
        }
      }

      const multi = this.client.multi();

      for (const entry of entries) {
        if (!entry.key) {
          return err(new AppError(400, 'All cache entries must have keys', ErrorCodes.VALIDATION_ERROR));
        }

        if (entry.ttl) {
          multi.setEx(entry.key, entry.ttl, entry.value);
        } else {
          multi.set(entry.key, entry.value);
        }
      }

      await multi.exec();
      return ok(undefined);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Redis multiSet operation failed';
      return err(new AppError(500, `Redis multiSet failed: ${message}`, ErrorCodes.DATABASE_ERROR));
    }
  }

  async multiGet(keys: string[]): Promise<Result<Array<string | null>, AppError>> {
    try {
      if (!keys || keys.length === 0) {
        return ok([]);
      }

      if (!this.isConnected) {
        const connectResult = await this.connect();
        if (!connectResult.success) {
          return err(connectResult.error);
        }
      }

      const values = await this.client.mGet(keys);
      return ok(values);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Redis multiGet operation failed';
      return err(new AppError(500, `Redis multiGet failed: ${message}`, ErrorCodes.DATABASE_ERROR));
    }
  }

  isReady(): boolean {
    return this.isConnected;
  }

  getConnectionInfo(): { 
    isConnected: boolean; 
    reconnectAttempts: number; 
    config: Omit<RedisConfig, 'url'> & { url: string };
  } {
    return {
      isConnected: this.isConnected,
      reconnectAttempts: this.reconnectAttempts,
      config: {
        ...this.config,
        url: this.config.url.replace(/\/\/.*@/, '//***@') // Hide credentials
      }
    };
  }
}

// Singleton instance
let redisClient: RedisClient | null = null;

export const getRedisClient = (): RedisClient => {
  if (!redisClient) {
    redisClient = new RedisClient();
  }
  return redisClient;
};

export const closeRedisConnection = async (): Promise<void> => {
  if (redisClient) {
    await redisClient.disconnect();
    redisClient = null;
  }
};