/**
 * Storage adapter that automatically chooses between database and file storage
 * Provides seamless fallback when database is not available
 */

import { initializeDatabase, DatabaseConfig, getDatabaseConfig } from '@/config/database';
import { getUserDataManagerOps } from './functional';
import { getDatabaseUserOps } from './database/userService';
import logger from '@/utils/logger';

export type StorageMode = 'database' | 'file';

export interface StorageAdapter {
  mode: StorageMode;
  isDatabase: boolean;
  isFile: boolean;
  userOps: any; // Will be either file or database ops
}

let storageAdapter: StorageAdapter | null = null;

/**
 * Test database connectivity
 */
async function testDatabaseConnection(config: DatabaseConfig): Promise<boolean> {
  try {
    const pool = await initializeDatabase();
    await pool.query('SELECT 1');
    logger.info('Database connection successful', {
      host: config.host,
      port: config.port,
      database: config.database,
    });
    return true;
  } catch (error) {
    logger.warn('Database connection failed, will use file storage', {
      host: config.host,
      port: config.port,
      database: config.database,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return false;
  }
}

/**
 * Initialize storage adapter with automatic fallback
 */
export async function initializeStorage(): Promise<StorageAdapter> {
  if (storageAdapter) {
    return storageAdapter;
  }

  const config = getDatabaseConfig();
  
  // Try to connect to database first
  const databaseAvailable = await testDatabaseConnection(config);
  
  if (databaseAvailable) {
    // Use database storage
    storageAdapter = {
      mode: 'database',
      isDatabase: true,
      isFile: false,
      userOps: getDatabaseUserOps(),
    };
    
    logger.info('Storage adapter initialized with database mode');
  } else {
    // Fall back to file storage
    storageAdapter = {
      mode: 'file',
      isDatabase: false,
      isFile: true,
      userOps: getUserDataManagerOps(),
    };
    
    logger.info('Storage adapter initialized with file mode (fallback)');
  }

  return storageAdapter;
}

/**
 * Get current storage adapter
 */
export function getStorageAdapter(): StorageAdapter {
  if (!storageAdapter) {
    throw new Error('Storage adapter not initialized. Call initializeStorage() first.');
  }
  return storageAdapter;
}

/**
 * Get user operations (database or file-based)
 */
export function getUserOps() {
  const adapter = getStorageAdapter();
  return adapter.userOps;
}

/**
 * Check if database mode is active
 */
export function isDatabaseMode(): boolean {
  return storageAdapter?.isDatabase ?? false;
}

/**
 * Check if file mode is active
 */
export function isFileMode(): boolean {
  return storageAdapter?.isFile ?? true; // Default to file mode
}

/**
 * Force refresh storage adapter (for testing or reconfiguration)
 */
export async function refreshStorageAdapter(): Promise<StorageAdapter> {
  storageAdapter = null;
  return await initializeStorage();
}

/**
 * Get storage mode information
 */
export function getStorageInfo() {
  const adapter = storageAdapter || { mode: 'unknown', isDatabase: false, isFile: false };
  
  return {
    mode: adapter.mode,
    isDatabase: adapter.isDatabase,
    isFile: adapter.isFile,
    features: {
      basicUserManagement: true,
      advancedQueries: adapter.isDatabase,
      priceHistory: adapter.isDatabase,
      searchAnalytics: adapter.isDatabase,
      bulkOperations: adapter.isDatabase,
      transactions: adapter.isDatabase,
    },
  };
}

/**
 * Log storage capabilities for debugging
 */
export function logStorageCapabilities(): void {
  const info = getStorageInfo();
  
  logger.info('Storage capabilities', {
    mode: info.mode,
    features: info.features,
  });
  
  if (info.mode === 'file') {
    logger.info('Running in file storage mode - some features may be limited');
    logger.info('To enable full features, set up PostgreSQL database');
    logger.info('See DATABASE_SETUP.md for installation instructions');
  }
}