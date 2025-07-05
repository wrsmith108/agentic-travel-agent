/**
 * Session store configuration with Redis fallback to memory store
 */

import session from 'express-session';
import { RedisStore } from 'connect-redis';
import { initializeRedis, getRedisConfig, testRedisConnection } from './redis';
import createLogger from '@/utils/logger';
const logger = createLogger('UsessionStore');
export type SessionStoreMode = 'redis' | 'memory';

export interface SessionStoreAdapter {
  mode: SessionStoreMode;
  store: session.Store;
  isRedis: boolean;
  isMemory: boolean;
}

let sessionStoreAdapter: SessionStoreAdapter | null = null;

/**
 * Create memory session store (fallback)
 */
function createMemoryStore(): session.MemoryStore {
  const store = new session.MemoryStore();
  
  logger.warn('Using memory session store - sessions will not persist across server restarts', {
    mode: 'memory',
    persistence: false,
    scalability: 'single-instance-only',
  });
  
  return store;
}

/**
 * Create Redis session store
 */
async function createRedisStore(): Promise<RedisStore> {
  try {
    const redisClient = await initializeRedis();
    
    const store = new RedisStore({
      client: redisClient,
      prefix: 'travel-agent:sess:',
      ttl: 60 * 60 * 24 * 7, // 7 days in seconds
    });

    logger.info('Redis session store created successfully', {
      mode: 'redis',
      persistence: true,
      scalability: 'multi-instance',
      ttl: '7 days',
    });

    return store;
  } catch (error) {
    logger.error('Failed to create Redis session store', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    throw error;
  }
}

/**
 * Initialize session store with automatic fallback
 */
export async function initializeSessionStore(): Promise<SessionStoreAdapter> {
  if (sessionStoreAdapter) {
    return sessionStoreAdapter;
  }

  const config = getRedisConfig();
  
  // Try to connect to Redis first
  const redisAvailable = await testRedisConnection(config);
  
  if (redisAvailable) {
    try {
      // Use Redis session store
      const redisStore = await createRedisStore();
      
      sessionStoreAdapter = {
        mode: 'redis',
        store: redisStore,
        isRedis: true,
        isMemory: false,
      };
      
      logger.info('Session store initialized with Redis mode');
    } catch (error) {
      logger.warn('Redis session store creation failed, falling back to memory store', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      
      // Fall back to memory store
      sessionStoreAdapter = {
        mode: 'memory',
        store: createMemoryStore(),
        isRedis: false,
        isMemory: true,
      };
    }
  } else {
    // Fall back to memory store
    sessionStoreAdapter = {
      mode: 'memory',
      store: createMemoryStore(),
      isRedis: false,
      isMemory: true,
    };
    
    logger.info('Session store initialized with memory mode (fallback)');
  }

  return sessionStoreAdapter;
}

/**
 * Get current session store adapter
 */
export function getSessionStore(): SessionStoreAdapter {
  if (!sessionStoreAdapter) {
    throw new Error('Session store not initialized. Call initializeSessionStore() first.');
  }
  return sessionStoreAdapter;
}

/**
 * Get session store configuration for Express
 */
export function getSessionStoreConfig() {
  const adapter = getSessionStore();
  return adapter.store;
}

/**
 * Check if Redis mode is active
 */
export function isRedisMode(): boolean {
  return sessionStoreAdapter?.isRedis ?? false;
}

/**
 * Check if memory mode is active
 */
export function isMemoryMode(): boolean {
  return sessionStoreAdapter?.isMemory ?? true; // Default to memory mode
}

/**
 * Get session store information
 */
export function getSessionStoreInfo() {
  const adapter = sessionStoreAdapter || { mode: 'unknown', isRedis: false, isMemory: false };
  
  return {
    mode: adapter.mode,
    isRedis: adapter.isRedis,
    isMemory: adapter.isMemory,
    features: {
      persistence: adapter.isRedis,
      scalability: adapter.isRedis ? 'multi-instance' : 'single-instance',
      clustering: adapter.isRedis,
      ttl: adapter.isRedis ? '7 days' : 'session-lifetime',
    },
  };
}

/**
 * Log session store capabilities for debugging
 */
export function logSessionStoreCapabilities(): void {
  const info = getSessionStoreInfo();
  
  logger.info('Session store capabilities', {
    mode: info.mode,
    features: info.features,
  });
  
  if (info.mode === 'memory') {
    logger.info('Running in memory session mode - sessions will not persist across restarts');
    logger.info('To enable persistent sessions, set up Redis');
    logger.info('See DATABASE_SETUP.md for Redis installation instructions');
  }
}

/**
 * Force refresh session store adapter (for testing or reconfiguration)
 */
export async function refreshSessionStore(): Promise<SessionStoreAdapter> {
  sessionStoreAdapter = null;
  return await initializeSessionStore();
}