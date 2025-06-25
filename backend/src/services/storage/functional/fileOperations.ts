import { promises as fs } from 'fs';
import path from 'path';
import { FileOps, FilePath, asFilePath } from './types';
import { UserDataFile, validateUserDataFile } from '@/schemas/user';
import logger from '@/utils/logger';

/**
 * Create file operations for a given data directory
 */
export const createFileOps = (dataDir: string): FileOps => {
  return {
    dataDir,

    ensureDirectory: async () => {
      try {
        await fs.mkdir(dataDir, { recursive: true });
      } catch (error) {
        logger.error('Error creating data directory', { dataDir, error });
        throw error;
      }
    },

    exists: async (filePath: FilePath) => {
      try {
        await fs.access(filePath, fs.constants.F_OK);
        return true;
      } catch {
        return false;
      }
    },

    read: async (filePath: FilePath) => {
      try {
        const data = await fs.readFile(filePath, 'utf-8');
        return data;
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
          return null;
        }
        logger.error('Error reading file', { filePath, error });
        throw error;
      }
    },

    write: async (filePath: FilePath, data: UserDataFile) => {
      // Validate data before writing
      validateUserDataFile(data);
      const jsonData = JSON.stringify(data, null, 2);
      await fs.writeFile(filePath, jsonData, { encoding: 'utf-8', mode: 0o644 });
    },

    writeAtomic: async (filePath: FilePath, data: UserDataFile) => {
      // Ensure directory exists first
      await fs.mkdir(path.dirname(filePath), { recursive: true });

      // Validate data before writing
      validateUserDataFile(data);

      // Create unique temp file name
      const tempPath = asFilePath(
        `${filePath}.tmp.${process.pid}.${Date.now()}.${Math.random().toString(36).substr(2, 9)}`
      );

      try {
        // Write to temp file
        const jsonData = JSON.stringify(data, null, 2);
        await fs.writeFile(tempPath, jsonData, { encoding: 'utf-8', mode: 0o644 });

        // Atomic rename
        await fs.rename(tempPath, filePath);
      } catch (error) {
        // Cleanup temp file on error
        try {
          await fs.unlink(tempPath);
        } catch (cleanupError) {
          if ((cleanupError as NodeJS.ErrnoException).code !== 'ENOENT') {
            logger.warn('Error cleaning up temp file', { tempPath, error: cleanupError });
          }
        }

        logger.error('Error in atomic write operation', { filePath, tempPath, error });
        throw error;
      }
    },

    delete: async (filePath: FilePath) => {
      try {
        await fs.unlink(filePath);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
          logger.error('Error deleting file', { filePath, error });
          throw error;
        }
        // File doesn't exist - consider it successfully deleted
      }
    },

    listFiles: async () => {
      try {
        const files = await fs.readdir(dataDir);
        return files.filter((f) => f.startsWith('user-') && f.endsWith('.json'));
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
          return [];
        }
        throw error;
      }
    },

    stat: async (filePath: FilePath) => {
      try {
        const stats = await fs.stat(filePath);
        return { size: stats.size };
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
          return null;
        }
        throw error;
      }
    },
  };
};
