import * as lockfile from 'proper-lockfile';
import { LockOps, FilePath } from './types';
import createLogger from '@/utils/logger';
const logger = createLogger('UlockOperations');
/**
 * Create lock operations with proper-lockfile
 */
export const createLockOps = (): LockOps => {
  const lockOptions = {
    retries: {
      retries: 5,
      factor: 1.5,
      minTimeout: 100,
      maxTimeout: 2000,
    },
    stale: 10000, // 10 seconds
    onCompromised: (err: Error) => {
      logger.warn('Lock compromised', { error: err.message });
    },
  };

  return {
    withLock: async <T>(filePath: FilePath, operation: () => Promise<T>): Promise<T> => {
      let release: (() => Promise<void>) | null = null;
      const startTime = Date.now();

      try {
        // Acquire lock with retry mechanism
        release = await lockfile.lock(filePath, lockOptions);

        // Perform the operation
        const result = await operation();

        // Log successful operation timing for debugging
        const duration = Date.now() - startTime;
        if (duration > 1000) {
          logger.info('Slow locked operation completed', { filePath, duration });
        }

        return result;
      } catch (error) {
        const duration = Date.now() - startTime;

        // Provide different error handling based on error type
        if (error instanceof Error && error.message.includes('Lock file is already being held')) {
          logger.warn('Lock contention detected', {
            filePath,
            duration,
            error: error.message,
          });
        } else {
          logger.error('Error during locked operation', {
            filePath,
            duration,
            error: error instanceof Error ? error.message : String(error),
          });
        }
        throw error;
      } finally {
        // Always attempt to release the lock
        if (release) {
          try {
            await release();
          } catch (releaseError) {
            logger.warn('Error releasing lock', {
              filePath,
              error: releaseError instanceof Error ? releaseError.message : String(releaseError),
            });
            // Don't throw here - we don't want to mask the original error
          }
        }
      }
    },
  };
};
