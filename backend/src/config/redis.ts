import { createClient } from 'redis';
import { env } from './env';
import logger from '@/utils/logger';

/**
 * Redis configuration and connection management
 */

export interface RedisConfig {
  host: string;
  port: number;
  password?: string;
  db: number;
  maxRetriesPerRequest: number;
  retryDelayOnFailover: number;
  enableAutoPipelining: boolean;
  lazyConnect: boolean;
}

/**
 * Get Redis configuration from environment variables
 */
export const getRedisConfig = (): RedisConfig => ({
  host: env.REDIS_HOST || 'localhost',
  port: parseInt(env.REDIS_PORT || '6379', 10),
  password: env.REDIS_PASSWORD,
  db: parseInt(env.REDIS_DB || '0', 10),
  maxRetriesPerRequest: parseInt(env.REDIS_MAX_RETRIES || '3', 10),
  retryDelayOnFailover: parseInt(env.REDIS_RETRY_DELAY || '100', 10),
  enableAutoPipelining: true,
  lazyConnect: true,
});

/**
 * Global Redis client instance
 */
let redisClient: ReturnType<typeof createClient> | null = null;

/**
 * Create Redis client
 */
export const createRedisClient = (config: RedisConfig): ReturnType<typeof createClient> => {
  const client = createClient({
    socket: {
      host: config.host,
      port: config.port,
    },
    password: config.password,
    database: config.db,
  });

  // Handle connection events
  client.on('connect', () => {
    logger.info('Redis client connecting', {
      host: config.host,
      port: config.port,
      database: config.db,
    });
  });

  client.on('ready', () => {
    logger.info('Redis client ready', {
      host: config.host,
      port: config.port,
      database: config.db,
    });
  });

  client.on('error', (error) => {
    logger.error('Redis client error', {
      error: error.message,
      host: config.host,
      port: config.port,
    });
  });

  client.on('end', () => {
    logger.info('Redis client connection ended', {
      host: config.host,
      port: config.port,
    });
  });

  client.on('reconnecting', () => {
    logger.info('Redis client reconnecting', {
      host: config.host,
      port: config.port,
    });
  });

  return client;
};

/**
 * Initialize Redis connection
 */
export const initializeRedis = async (): Promise<ReturnType<typeof createClient>> => {
  if (redisClient) {
    return redisClient;
  }

  const config = getRedisConfig();
  redisClient = createRedisClient(config);

  try {
    await redisClient.connect();
    
    // Test the connection
    await redisClient.ping();
    
    logger.info('Redis connected successfully', {
      host: config.host,
      port: config.port,
      database: config.db,
    });

    return redisClient;
  } catch (error) {
    logger.error('Failed to connect to Redis', {
      error: error instanceof Error ? error.message : 'Unknown error',
      config: {
        host: config.host,
        port: config.port,
        database: config.db,
      },
    });
    throw error;
  }
};

/**
 * Get Redis client instance
 */
export const getRedis = (): Redis.RedisClientType => {
  if (!redisClient) {
    throw new Error('Redis not initialized. Call initializeRedis() first.');
  }
  return redisClient;
};

/**
 * Close Redis connection
 */
export const closeRedis = async (): Promise<void> => {
  if (redisClient) {
    try {
      await redisClient.quit();
      logger.info('Redis connection closed');
    } catch (error) {
      logger.error('Error closing Redis connection', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      redisClient = null;
    }
  }
};

/**
 * Test Redis connectivity
 */
export const testRedisConnection = async (config: RedisConfig): Promise<boolean> => {
  try {
    const testClient = createRedisClient(config);
    await testClient.connect();
    await testClient.ping();
    await testClient.quit();
    
    logger.info('Redis connection test successful', {
      host: config.host,
      port: config.port,
      database: config.db,
    });
    
    return true;
  } catch (error) {
    logger.warn('Redis connection test failed', {
      host: config.host,
      port: config.port,
      database: config.db,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    
    return false;
  }
};

/**
 * Get Redis connection status
 */
export const getRedisStatus = () => {
  if (!redisClient) {
    return { connected: false, status: 'not initialized' };
  }

  return {
    connected: redisClient.isReady,
    status: redisClient.isReady ? 'ready' : 'connecting',
  };
};