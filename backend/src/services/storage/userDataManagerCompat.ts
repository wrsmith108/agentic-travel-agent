import {
  UserDataManagerOps,
  getUserDataManagerOps,
  createUserDataManagerOps,
  asUserId,
  asEmail,
} from './functional';
import {
  UserProfile,
  UserDataFile,
  CreateUserProfile,
  UpdateUserProfile,
  FlightSearch,
} from '@/schemas/user';

/**
 * Backward compatibility wrapper for UserDataManager
 * Wraps the functional interface with a class-based API
 */
class UserDataManager {
  private ops: UserDataManagerOps;

  constructor(customDataDir?: string) {
    if (customDataDir) {
      this.ops = createUserDataManagerOps(customDataDir);
    } else {
      this.ops = getUserDataManagerOps();
    }
  }

  async createUser(profileData: CreateUserProfile): Promise<UserProfile> {
    return this.ops.createUser(profileData);
  }

  async readUserData(userId: string): Promise<UserProfile | null> {
    return this.ops.readUserData(asUserId(userId));
  }

  async readUserDataFile(userId: string): Promise<UserDataFile | null> {
    return this.ops.readUserDataFile(asUserId(userId));
  }

  async updateUserData(userId: string, updates: UpdateUserProfile): Promise<UserProfile> {
    return this.ops.updateUserData(asUserId(userId), updates);
  }

  async deleteUser(userId: string): Promise<void> {
    return this.ops.deleteUser(asUserId(userId));
  }

  async listUsers(): Promise<string[]> {
    const userIds = await this.ops.listUsers();
    return userIds.map((id) => id as string);
  }

  async userExists(userId: string): Promise<boolean> {
    return this.ops.userExists(asUserId(userId));
  }

  async updateUserFlightSearch(userId: string, search: FlightSearch): Promise<void> {
    return this.ops.updateUserFlightSearch(asUserId(userId), search);
  }

  async getUserFlightSearches(userId: string): Promise<FlightSearch[]> {
    return this.ops.getUserFlightSearches(asUserId(userId));
  }

  async findUserByEmail(email: string): Promise<UserProfile | null> {
    return this.ops.findUserByEmail(asEmail(email));
  }

  async getStorageStats(): Promise<{
    totalUsers: number;
    totalSearches: number;
    diskUsage: number;
  }> {
    return this.ops.getStorageStats();
  }
}

// Export singleton instance for backward compatibility
export const userDataManager = new UserDataManager();

// Export class for testing with custom paths
export { UserDataManager };
