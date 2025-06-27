import { Pool, PoolConfig } from 'pg';
import { env } from './env';
import logger from '@/utils/logger';

/**
 * PostgreSQL database configuration and connection management
 */

export interface DatabaseConfig {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
  ssl: boolean;
  maxConnections: number;
  idleTimeoutMillis: number;
  connectionTimeoutMillis: number;
}

/**
 * Get database configuration from environment variables
 */
export const getDatabaseConfig = (): DatabaseConfig => ({
  host: env.DB_HOST || 'localhost',
  port: parseInt(env.DB_PORT || '5432', 10),
  database: env.DB_NAME || 'travel_agent',
  user: env.DB_USER || 'travel_user',
  password: env.DB_PASSWORD || 'dev_password',
  ssl: env.NODE_ENV === 'production',
  maxConnections: parseInt(env.DB_MAX_CONNECTIONS || '10', 10),
  idleTimeoutMillis: parseInt(env.DB_IDLE_TIMEOUT || '30000', 10),
  connectionTimeoutMillis: parseInt(env.DB_CONNECTION_TIMEOUT || '10000', 10),
});

/**
 * Create PostgreSQL connection pool
 */
export const createDatabasePool = (config: DatabaseConfig): Pool => {
  const poolConfig: PoolConfig = {
    host: config.host,
    port: config.port,
    database: config.database,
    user: config.user,
    password: config.password,
    ssl: config.ssl ? { rejectUnauthorized: false } : false,
    max: config.maxConnections,
    idleTimeoutMillis: config.idleTimeoutMillis,
    connectionTimeoutMillis: config.connectionTimeoutMillis,
  };

  const pool = new Pool(poolConfig);

  // Handle pool errors
  pool.on('error', (err) => {
    logger.error('Database pool error', { error: err.message, stack: err.stack });
  });

  // Handle client connections
  pool.on('connect', () => {
    logger.debug('Database client connected', { 
      totalCount: pool.totalCount,
      idleCount: pool.idleCount,
      waitingCount: pool.waitingCount 
    });
  });

  // Handle client disconnections
  pool.on('remove', () => {
    logger.debug('Database client removed', { 
      totalCount: pool.totalCount,
      idleCount: pool.idleCount,
      waitingCount: pool.waitingCount 
    });
  });

  return pool;
};

/**
 * Global database pool instance
 */
let dbPool: Pool | null = null;

/**
 * Initialize database connection
 */
export const initializeDatabase = async (): Promise<Pool> => {
  if (dbPool) {
    return dbPool;
  }

  const config = getDatabaseConfig();
  dbPool = createDatabasePool(config);

  try {
    // Test the connection
    const client = await dbPool.connect();
    const result = await client.query('SELECT NOW() as connected_at');
    client.release();

    logger.info('Database connected successfully', {
      host: config.host,
      port: config.port,
      database: config.database,
      connectedAt: result.rows[0].connected_at,
    });

    return dbPool;
  } catch (error) {
    logger.error('Failed to connect to database', {
      error: error instanceof Error ? error.message : 'Unknown error',
      config: {
        host: config.host,
        port: config.port,
        database: config.database,
        user: config.user,
      },
    });
    throw error;
  }
};

/**
 * Get database pool instance
 */
export const getDatabase = (): Pool => {
  if (!dbPool) {
    throw new Error('Database not initialized. Call initializeDatabase() first.');
  }
  return dbPool;
};

/**
 * Close database connection
 */
export const closeDatabase = async (): Promise<void> => {
  if (dbPool) {
    try {
      await dbPool.end();
      logger.info('Database connection closed');
    } catch (error) {
      logger.error('Error closing database connection', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      dbPool = null;
    }
  }
};

/**
 * Execute a query with error handling and logging
 */
export const executeQuery = async <T = any>(
  text: string,
  params?: any[]
): Promise<T[]> => {
  const pool = getDatabase();
  const start = Date.now();

  try {
    const result = await pool.query(text, params);
    const duration = Date.now() - start;

    logger.debug('Database query executed', {
      query: text.substring(0, 100),
      duration,
      rowCount: result.rowCount,
    });

    return result.rows;
  } catch (error) {
    const duration = Date.now() - start;
    
    logger.error('Database query failed', {
      query: text.substring(0, 100),
      params: params?.length ? '[PARAMS_HIDDEN]' : undefined,
      duration,
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    throw error;
  }
};

/**
 * Execute a transaction
 */
export const executeTransaction = async <T>(
  callback: (client: any) => Promise<T>
): Promise<T> => {
  const pool = getDatabase();
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('Database transaction failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    throw error;
  } finally {
    client.release();
  }
};