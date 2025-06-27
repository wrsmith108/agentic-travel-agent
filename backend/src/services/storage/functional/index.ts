import path from 'path';
import { env } from '@/config/env';
import { UserDataManagerOps, UserId, Email } from './types';
import { createFileOps } from './fileOperations';
import { createLockOps } from './lockOperations';
import {
  createUser,
  readUserData,
  readUserDataFile,
  updateUserData,
  deleteUser,
  listUsers,
  userExists,
  updateUserFlightSearch,
  getUserFlightSearches,
  findUserByEmail,
  getStorageStats,
} from './userDataOperations';

/**
 * Factory function to create UserDataManager operations
 */
export const createUserDataManagerOps = (dataDir: string): UserDataManagerOps => {
  // Create dependencies
  const fileOps = createFileOps(dataDir);
  const lockOps = createLockOps();

  // Ensure data directory exists on initialization
  fileOps.ensureDirectory().catch((error) => {
    console.error('Failed to create data directory:', error);
  });

  // Return the operations interface
  return {
    createUser: createUser(fileOps),
    readUserData: (userId: UserId) => readUserData(fileOps)(userId),
    readUserDataFile: (userId: UserId) => readUserDataFile(fileOps)(userId),
    updateUserData: (userId: UserId, updates) => updateUserData(fileOps, lockOps)(userId, updates),
    deleteUser: (userId: UserId) => deleteUser(fileOps)(userId),
    listUsers: listUsers(fileOps),
    userExists: (userId: UserId) => userExists(fileOps)(userId),
    updateUserFlightSearch: (userId: UserId, search) =>
      updateUserFlightSearch(fileOps, lockOps)(userId, search),
    getUserFlightSearches: (userId: UserId) => getUserFlightSearches(fileOps)(userId),
    findUserByEmail: (email: Email) => findUserByEmail(fileOps)(email),
    getStorageStats: getStorageStats(fileOps),
  };
};

/**
 * Get the default UserDataManager operations instance
 */
export const getUserDataManagerOps = (): UserDataManagerOps => {
  const dataDir = path.join(env.DATA_DIRECTORY, 'users');
  return createUserDataManagerOps(dataDir);
};

// Re-export types and constructors for convenience
export type { UserDataManagerOps, UserId, Email, StorageStats } from './types';
export { asUserId, asEmail } from './types';
