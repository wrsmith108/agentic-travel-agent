import { promises as fs } from 'fs';
import path from 'path';
import * as lockfile from 'proper-lockfile';
import { v4 as uuidv4 } from 'uuid';
import {
  UserProfile,
  UserDataFile,
  CreateUserProfile,
  UpdateUserProfile,
  FlightSearch,
  validateUserDataFile,
  validateUserProfile,
} from '@/schemas/user';
import { env } from '@/config/env';
import logger from '@/utils/logger';

/**
 * Manages user data with atomic file operations and proper locking
 * Implements the repository pattern for file-based user storage
 */
class UserDataManager {
  private readonly dataDir: string;
  private readonly lockOptions = {
    retries: {
      retries: 5, // Increased for better concurrent handling
      factor: 1.5, // Smaller backoff factor
      minTimeout: 100, // Reasonable initial timeout
      maxTimeout: 2000, // Allow more time for concurrent operations
    },
    stale: 10000, // 10 seconds should be plenty for our operations
    onCompromised: (err: Error) => {
      // Log when locks are compromised to help debug issues
      logger.warn('Lock compromised', { error: err.message });
    },
  };

  constructor(customDataDir?: string) {
    this.dataDir = customDataDir || path.join(env.DATA_DIRECTORY, 'users');
    this.ensureDataDirectory();
  }

  /**
   * Create a new user with atomic file operations
   */
  async createUser(profileData: CreateUserProfile): Promise<UserProfile> {
    const profile: UserProfile = {
      ...profileData,
      id: uuidv4(),
      activeSearches: [],
      searchHistory: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Validate before writing
    const validatedProfile = validateUserProfile(profile);
    
    const userData: UserDataFile = {
      profile: validatedProfile,
      searches: {},
      version: '1.0.0',
    };

    const filePath = this.getUserFilePath(validatedProfile.id);
    
    // Check if user already exists
    if (await this.userExists(validatedProfile.id)) {
      throw new Error(`User with ID ${validatedProfile.id} already exists`);
    }

    await this.writeAtomically(filePath, userData);
    
    logger.info('User created successfully', { 
      userId: validatedProfile.id,
      email: validatedProfile.email 
    });
    
    return validatedProfile;
  }

  /**
   * Read user data with proper locking
   */
  async readUserData(userId: string): Promise<UserProfile | null> {
    const filePath = this.getUserFilePath(userId);
    
    // Check existence first - no locking needed for this
    if (!(await this.fileExists(filePath))) {
      return null;
    }
    
    try {
      const rawData = await this.readWithLock(filePath);
      if (!rawData) return null;
      
      const userData = validateUserDataFile(JSON.parse(rawData));
      return userData.profile;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return null;
      }
      logger.error('Error reading user data', { userId, error });
      throw error;
    }
  }

  /**
   * Read complete user data file (profile + searches)
   */
  async readUserDataFile(userId: string): Promise<UserDataFile | null> {
    const filePath = this.getUserFilePath(userId);
    
    // Check existence first - no locking needed for this
    if (!(await this.fileExists(filePath))) {
      return null;
    }
    
    try {
      const rawData = await this.readWithLock(filePath);
      if (!rawData) return null;
      
      return validateUserDataFile(JSON.parse(rawData));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return null;
      }
      logger.error('Error reading user data file', { userId, error });
      throw error;
    }
  }

  /**
   * Update user profile with atomic operations
   */
  async updateUserData(userId: string, updates: UpdateUserProfile): Promise<UserProfile> {
    const filePath = this.getUserFilePath(userId);
    
    // Check existence first - fail fast if user doesn't exist
    if (!(await this.fileExists(filePath))) {
      throw new Error(`User ${userId} not found`);
    }
    
    return this.performLockedOperation(filePath, async () => {
      // Read current data without locking (we're already in a locked operation)
      const currentData = await this.readUserDataFileWithoutLock(filePath);
      if (!currentData) {
        throw new Error(`User ${userId} not found`);
      }

      // Merge updates
      const updatedProfile: UserProfile = {
        ...currentData.profile,
        ...updates,
        id: currentData.profile.id, // Prevent ID changes
        createdAt: currentData.profile.createdAt, // Preserve creation date
        updatedAt: new Date().toISOString(),
      };

      // Validate updated profile
      const validatedProfile = validateUserProfile(updatedProfile);

      // Update data file
      const updatedData: UserDataFile = {
        ...currentData,
        profile: validatedProfile,
      };

      // Write atomically
      await this.writeToTempAndRename(filePath, updatedData);
      
      logger.info('User updated successfully', { userId });
      return validatedProfile;
    });
  }

  /**
   * Delete user completely
   */
  async deleteUser(userId: string): Promise<void> {
    const filePath = this.getUserFilePath(userId);
    
    try {
      await fs.unlink(filePath);
      logger.info('User deleted successfully', { userId });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        logger.error('Error deleting user', { userId, error });
        throw error;
      }
      // User doesn't exist - consider it successfully deleted
    }
  }

  /**
   * List all user IDs
   */
  async listUsers(): Promise<string[]> {
    try {
      const files = await fs.readdir(this.dataDir);
      return files
        .filter(f => f.startsWith('user-') && f.endsWith('.json'))
        .map(f => f.replace('user-', '').replace('.json', ''))
        .filter(id => id.length === 36); // UUID v4 length check
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return [];
      }
      throw error;
    }
  }

  /**
   * Check if user exists
   */
  async userExists(userId: string): Promise<boolean> {
    const filePath = this.getUserFilePath(userId);
    try {
      await fs.access(filePath, fs.constants.F_OK);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Add or update a flight search for a user
   */
  async updateUserFlightSearch(userId: string, search: FlightSearch): Promise<void> {
    const filePath = this.getUserFilePath(userId);
    
    // Check existence first - fail fast if user doesn't exist
    if (!(await this.fileExists(filePath))) {
      throw new Error(`User ${userId} not found`);
    }
    
    await this.performLockedOperation(filePath, async () => {
      const userData = await this.readUserDataFileWithoutLock(filePath);
      if (!userData) {
        throw new Error(`User ${userId} not found`);
      }

      // Update searches
      userData.searches[search.id] = search;
      
      // Update active searches list in profile
      const activeSearchIds = Object.values(userData.searches)
        .filter(s => s.status === 'active')
        .map(s => s.id);
      
      userData.profile.activeSearches = activeSearchIds;
      userData.profile.updatedAt = new Date().toISOString();

      await this.writeToTempAndRename(filePath, userData);
      
      logger.info('Flight search updated', { userId, searchId: search.id });
    });
  }

  /**
   * Get user's flight searches
   */
  async getUserFlightSearches(userId: string): Promise<FlightSearch[]> {
    const userData = await this.readUserDataFile(userId);
    if (!userData) {
      throw new Error(`User ${userId} not found`);
    }
    
    return Object.values(userData.searches);
  }

  /**
   * Search users by email
   */
  async findUserByEmail(email: string): Promise<UserProfile | null> {
    const userIds = await this.listUsers();
    
    for (const userId of userIds) {
      const profile = await this.readUserData(userId);
      if (profile && profile.email.toLowerCase() === email.toLowerCase()) {
        return profile;
      }
    }
    
    return null;
  }

  /**
   * Get storage statistics
   */
  async getStorageStats(): Promise<{
    totalUsers: number;
    totalSearches: number;
    diskUsage: number;
  }> {
    const userIds = await this.listUsers();
    let totalSearches = 0;
    let diskUsage = 0;

    for (const userId of userIds) {
      const filePath = this.getUserFilePath(userId);
      try {
        const stats = await fs.stat(filePath);
        diskUsage += stats.size;
        
        const userData = await this.readUserDataFile(userId);
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
  }

  // Private helper methods

  private getUserFilePath(userId: string): string {
    return path.join(this.dataDir, `user-${userId}.json`);
  }

  private async ensureDataDirectory(): Promise<void> {
    try {
      await fs.mkdir(this.dataDir, { recursive: true });
    } catch (error) {
      logger.error('Error creating data directory', { dataDir: this.dataDir, error });
      throw error;
    }
  }

  private async readWithLock(filePath: string): Promise<string | null> {
    // Only attempt to lock files that exist
    if (!(await this.fileExists(filePath))) {
      return null;
    }
    
    return this.performLockedOperation(filePath, async () => {
      try {
        const data = await fs.readFile(filePath, 'utf-8');
        return data;
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
          return null;
        }
        throw error;
      }
    });
  }

  /**
   * Check if a file exists without attempting to lock it
   */
  private async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath, fs.constants.F_OK);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Read user data file without locking - for use within already locked operations
   */
  private async readUserDataFileWithoutLock(filePath: string): Promise<UserDataFile | null> {
    try {
      const rawData = await fs.readFile(filePath, 'utf-8');
      return validateUserDataFile(JSON.parse(rawData));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return null;
      }
      throw error;
    }
  }

  /**
   * Perform an operation with proper file locking and cleanup
   */
  private async performLockedOperation<T>(
    filePath: string, 
    operation: () => Promise<T>
  ): Promise<T> {
    let release: (() => Promise<void>) | null = null;
    const startTime = Date.now();
    
    try {
      // Acquire lock with retry mechanism
      release = await lockfile.lock(filePath, this.lockOptions);
      
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
          error: error.message 
        });
      } else {
        logger.error('Error during locked operation', { 
          filePath, 
          duration,
          error: error instanceof Error ? error.message : String(error) 
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
            error: releaseError instanceof Error ? releaseError.message : String(releaseError)
          });
          // Don't throw here - we don't want to mask the original error
        }
      }
    }
  }

  private async writeAtomically(filePath: string, data: UserDataFile): Promise<void> {
    // Ensure directory exists first
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    
    // Validate data before writing to catch errors early
    validateUserDataFile(data);
    
    // Write atomically without locking (atomic rename handles concurrency)
    // This is safe for new file creation because the temp file has a unique name
    await this.writeToTempAndRename(filePath, data);
  }

  private async writeToTempAndRename(filePath: string, data: UserDataFile): Promise<void> {
    // Create unique temp file name with process ID and timestamp to avoid collisions
    const tempPath = `${filePath}.tmp.${process.pid}.${Date.now()}.${Math.random().toString(36).substr(2, 9)}`;
    
    try {
      // Write to temp file with pretty formatting for better readability
      const jsonData = JSON.stringify(data, null, 2);
      await fs.writeFile(tempPath, jsonData, { encoding: 'utf-8', mode: 0o644 });
      
      // Atomic rename - this is the critical atomic operation
      // On POSIX systems, rename is atomic within the same filesystem
      await fs.rename(tempPath, filePath);
      
    } catch (error) {
      // Always attempt cleanup on error, but don't let cleanup errors mask the original error
      await this.cleanupTempFile(tempPath);
      
      logger.error('Error in atomic write operation', { 
        filePath, 
        tempPath, 
        error: error instanceof Error ? error.message : String(error) 
      });
      throw error;
    }
  }

  /**
   * Safely cleanup temporary files
   */
  private async cleanupTempFile(tempPath: string): Promise<void> {
    try {
      await fs.unlink(tempPath);
    } catch (cleanupError) {
      // Only log if the file actually existed (ignore ENOENT)
      if ((cleanupError as NodeJS.ErrnoException).code !== 'ENOENT') {
        logger.warn('Error cleaning up temp file', { 
          tempPath, 
          error: cleanupError instanceof Error ? cleanupError.message : String(cleanupError) 
        });
      }
    }
  }
}

// Export singleton instance
export const userDataManager = new UserDataManager();

// Export class for testing with custom paths
export { UserDataManager };