import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import { FileOps, LockOps, UserId, Email, FilePath, UserNotFoundError, UserAlreadyExistsError, asUserId, asFilePath } from './types';
import { createTimestamp } from '@/services/auth/functional/types';
import {
  UserProfile,
  UserDataFile,
  CreateUserProfile,
  UpdateUserProfile,
  FlightSearch,
  validateUserProfile,
  validateUserDataFile,
} from '@/schemas/user';
import createLogger from '@/utils/logger';
const logger = createLogger('UuserDataOperations');
/**
 * Get the file path for a user's data
 */
const getUserFilePath = (dataDir: string, userId: UserId): FilePath =>
  asFilePath(path.join(dataDir, `user-${userId}.json`));

/**
 * Create a new user
 */
export const createUser =
  (fileOps: FileOps) =>
  async (profileData: CreateUserProfile): Promise<UserProfile> => {
    const profile: UserProfile = {
      ...profileData,
      id: uuidv4(),
      activeSearches: [],
      searchHistory: [],
      createdAt: createTimestamp(),
      updatedAt: createTimestamp(),
    };

    // Validate before writing
    const validatedProfile = validateUserProfile(profile);

    const userData: UserDataFile = {
      profile: validatedProfile,
      searches: {},
      version: '1.0.0',
    };

    const userId = asUserId(validatedProfile.id);
    const filePath = getUserFilePath(fileOps.dataDir, userId);

    // Check if user already exists
    if (await fileOps.exists(filePath)) {
      throw new UserAlreadyExistsError(userId);
    }

    await fileOps.writeAtomic(filePath, userData);

    logger.info('User created successfully', {
      userId: validatedProfile.id,
      email: validatedProfile.email,
    });

    return validatedProfile;
  };

/**
 * Read user profile data
 */
export const readUserData =
  (fileOps: FileOps) =>
  async (userId: UserId): Promise<UserProfile | null> => {
    const filePath = getUserFilePath(fileOps.dataDir, userId);

    const rawData = await fileOps.read(filePath);
    if (!rawData) return null;

    try {
      const userData = validateUserDataFile(JSON.parse(rawData));
      return userData.profile;
    } catch (error) {
      logger.error('Error reading user data', { userId, error });
      throw error;
    }
  };

/**
 * Read complete user data file (profile + searches)
 */
export const readUserDataFile =
  (fileOps: FileOps) =>
  async (userId: UserId): Promise<UserDataFile | null> => {
    const filePath = getUserFilePath(fileOps.dataDir, userId);

    const rawData = await fileOps.read(filePath);
    if (!rawData) return null;

    try {
      return validateUserDataFile(JSON.parse(rawData));
    } catch (error) {
      logger.error('Error reading user data file', { userId, error });
      throw error;
    }
  };

/**
 * Update user profile with atomic operations
 */
export const updateUserData =
  (fileOps: FileOps, lockOps: LockOps) =>
  async (userId: UserId, updates: UpdateUserProfile): Promise<UserProfile> => {
    const filePath = getUserFilePath(fileOps.dataDir, userId);

    // Check existence first - fail fast if user doesn't exist
    if (!(await fileOps.exists(filePath))) {
      throw new UserNotFoundError(userId);
    }

    return lockOps.withLock(filePath, async () => {
      // Read current data
      const rawData = await fileOps.read(filePath);
      if (!rawData) {
        throw new UserNotFoundError(userId);
      }

      const currentData = validateUserDataFile(JSON.parse(rawData));

      // Merge updates
      const updatedProfile: UserProfile = {
        ...currentData.profile,
        ...updates,
        id: currentData.profile.id, // Prevent ID changes
        createdAt: currentData.profile.createdAt, // Preserve creation date
        updatedAt: createTimestamp(),
      };

      // Validate updated profile
      const validatedProfile = validateUserProfile(updatedProfile);

      // Update data file
      const updatedData: UserDataFile = {
        ...currentData,
        profile: validatedProfile,
      };

      // Write atomically
      await fileOps.writeAtomic(filePath, updatedData);

      logger.info('User updated successfully', { userId });
      return validatedProfile;
    });
  };

/**
 * Delete user completely
 */
export const deleteUser =
  (fileOps: FileOps) =>
  async (userId: UserId): Promise<void> => {
    const filePath = getUserFilePath(fileOps.dataDir, userId);
    await fileOps.delete(filePath);
    logger.info('User deleted successfully', { userId });
  };

/**
 * List all user IDs
 */
export const listUsers = (fileOps: FileOps) => async (): Promise<UserId[]> => {
  const files = await fileOps.listFiles();
  return files
    .map((f) => f.replace('user-', '').replace('.json', ''))
    .filter((id) => id.length === 36) // UUID v4 length check
    .map(asUserId);
};

/**
 * Check if user exists
 */
export const userExists =
  (fileOps: FileOps) =>
  async (userId: UserId): Promise<boolean> => {
    const filePath = getUserFilePath(fileOps.dataDir, userId);
    return fileOps.exists(filePath);
  };

/**
 * Add or update a flight search for a user
 */
export const updateUserFlightSearch =
  (fileOps: FileOps, lockOps: LockOps) =>
  async (userId: UserId, search: FlightSearch): Promise<void> => {
    const filePath = getUserFilePath(fileOps.dataDir, userId);

    // Check existence first - fail fast if user doesn't exist
    if (!(await fileOps.exists(filePath))) {
      throw new UserNotFoundError(userId);
    }

    await lockOps.withLock(filePath, async () => {
      const rawData = await fileOps.read(filePath);
      if (!rawData) {
        throw new UserNotFoundError(userId);
      }

      const userData = validateUserDataFile(JSON.parse(rawData));

      // Update searches
      userData.searches[search.id] = search;

      // Update active searches list in profile
      const activeSearchIds = Object.values(userData.searches)
        .filter((s) => s.status === 'active')
        .map((s) => s.id);

      userData.profile.activeSearches = activeSearchIds;
      userData.profile.updatedAt = createTimestamp();

      await fileOps.writeAtomic(filePath, userData);

      logger.info('Flight search updated', { userId, searchId: search.id });
    });
  };

/**
 * Get user's flight searches
 */
export const getUserFlightSearches =
  (fileOps: FileOps) =>
  async (userId: UserId): Promise<FlightSearch[]> => {
    const userData = await readUserDataFile(fileOps)(userId);
    if (!userData) {
      throw new UserNotFoundError(userId);
    }

    return Object.values(userData.searches);
  };

/**
 * Search users by email
 */
export const findUserByEmail =
  (fileOps: FileOps) =>
  async (email: Email): Promise<UserProfile | null> => {
    const userIds = await listUsers(fileOps)();

    for (const userId of userIds) {
      const profile = await readUserData(fileOps)(userId);
      if (profile && profile.email.toLowerCase() === email.toLowerCase()) {
        return profile;
      }
    }

    return null;
  };

/**
 * Get storage statistics
 */
export const getStorageStats = (fileOps: FileOps) => async () => {
  const userIds = await listUsers(fileOps)();
  let totalSearches = 0;
  let diskUsage = 0;

  for (const userId of userIds) {
    const filePath = getUserFilePath(fileOps.dataDir, userId);
    try {
      const stats = await fileOps.stat(filePath);
      if (stats) {
        diskUsage += stats.size;
      }

      const userData = await readUserDataFile(fileOps)(userId);
      if (userData) {
        totalSearches += Object.keys(userData.searches).length;
      }
    } catch (error) {
      logger.warn('Error getting stats for user', { userId, error });
    }
  }

  return {
    totalUsers: userIds.length,
    totalSearches,
    diskUsage,
  };
};
