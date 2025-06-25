import { UserDataManager } from '../userDataManager';
import { UserProfile, CreateUserProfile, FlightSearch } from '@/schemas/user';
import { promises as fs } from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

describe('UserDataManager', () => {
  let testDataDir: string;
  let userDataManager: UserDataManager;

  const createTestUser = (): CreateUserProfile => ({
    firstName: 'John',
    lastName: 'Doe',
    email: `john.doe.${Date.now()}@example.com`,
    preferences: {
      currency: 'CAD',
      timezone: 'America/Toronto',
      preferredDepartureAirport: 'YYZ',
      communicationFrequency: 'daily',
      subscriptionTier: 'free',
    },
  });

  const createTestFlightSearch = (): FlightSearch => ({
    id: uuidv4(),
    criteria: {
      origin: 'YYZ',
      destination: 'NRT',
      departureDate: '2025-04-20T00:00:00.000Z',
      passengers: { adults: 1, children: 0, infants: 0 },
      travelClass: 'economy',
      maxPrice: 1200,
      currency: 'CAD',
      nonStop: false,
    },
    status: 'active',
    priceHistory: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  beforeEach(async () => {
    // Create unique test directory for each test
    testDataDir = path.join(__dirname, '..', '..', '..', '..', 'test-data', `test-${Date.now()}`);
    userDataManager = new UserDataManager(testDataDir);

    // Ensure clean state
    try {
      await fs.rm(testDataDir, { recursive: true, force: true });
    } catch (error) {
      // Directory might not exist, that's OK
    }
  });

  afterEach(async () => {
    // Clean up test data
    try {
      await fs.rm(testDataDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('User CRUD Operations', () => {
    it('should create a new user with valid data', async () => {
      const testUser = createTestUser();
      const user = await userDataManager.createUser(testUser);

      expect(user.id).toBeDefined();
      expect(user.id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
      );
      expect(user.firstName).toBe(testUser.firstName);
      expect(user.lastName).toBe(testUser.lastName);
      expect(user.email).toBe(testUser.email);
      expect(user.preferences).toEqual(testUser.preferences);
      expect(user.activeSearches).toEqual([]);
      expect(user.searchHistory).toEqual([]);
      expect(user.createdAt).toBeDefined();
      expect(user.updatedAt).toBeDefined();
      expect(new Date(user.createdAt)).toBeInstanceOf(Date);
    });

    it('should read user data correctly', async () => {
      const testUser = createTestUser();
      const createdUser = await userDataManager.createUser(testUser);

      const retrievedUser = await userDataManager.readUserData(createdUser.id);

      expect(retrievedUser).toEqual(createdUser);
    });

    it('should return null for non-existent user', async () => {
      const nonExistentId = uuidv4();
      const user = await userDataManager.readUserData(nonExistentId);

      expect(user).toBeNull();
    });

    it('should update user data correctly', async () => {
      const testUser = createTestUser();
      const createdUser = await userDataManager.createUser(testUser);

      const updates = {
        firstName: 'Jane',
        preferences: {
          ...createdUser.preferences,
          currency: 'USD' as const,
        },
      };

      const updatedUser = await userDataManager.updateUserData(createdUser.id, updates);

      expect(updatedUser.firstName).toBe('Jane');
      expect(updatedUser.preferences.currency).toBe('USD');
      expect(updatedUser.lastName).toBe(createdUser.lastName); // Unchanged
      expect(updatedUser.id).toBe(createdUser.id); // ID preserved
      expect(updatedUser.createdAt).toBe(createdUser.createdAt); // Creation time preserved
      expect(updatedUser.updatedAt).not.toBe(createdUser.updatedAt); // Updated time changed
    });

    it('should throw error when updating non-existent user', async () => {
      const nonExistentId = uuidv4();

      await expect(
        userDataManager.updateUserData(nonExistentId, { firstName: 'Jane' })
      ).rejects.toThrow(`User ${nonExistentId} not found`);
    });

    it('should delete user successfully', async () => {
      const testUser = createTestUser();
      const createdUser = await userDataManager.createUser(testUser);

      // Verify user exists
      expect(await userDataManager.userExists(createdUser.id)).toBe(true);

      // Delete user
      await userDataManager.deleteUser(createdUser.id);

      // Verify user no longer exists
      expect(await userDataManager.userExists(createdUser.id)).toBe(false);
      expect(await userDataManager.readUserData(createdUser.id)).toBeNull();
    });

    it('should not throw when deleting non-existent user', async () => {
      const nonExistentId = uuidv4();

      await expect(userDataManager.deleteUser(nonExistentId)).resolves.not.toThrow();
    });
  });

  describe('User Listing and Search', () => {
    it('should list all users', async () => {
      const users = await Promise.all([
        userDataManager.createUser(createTestUser()),
        userDataManager.createUser(createTestUser()),
        userDataManager.createUser(createTestUser()),
      ]);

      const userIds = await userDataManager.listUsers();

      expect(userIds).toHaveLength(3);
      expect(userIds).toEqual(expect.arrayContaining(users.map((u) => u.id)));
    });

    it('should return empty array when no users exist', async () => {
      const userIds = await userDataManager.listUsers();
      expect(userIds).toEqual([]);
    });

    it('should find user by email', async () => {
      const testUser = createTestUser();
      const createdUser = await userDataManager.createUser(testUser);

      const foundUser = await userDataManager.findUserByEmail(testUser.email);

      expect(foundUser).toEqual(createdUser);
    });

    it('should find user by email case-insensitively', async () => {
      const testUser = createTestUser();
      const createdUser = await userDataManager.createUser(testUser);

      const foundUser = await userDataManager.findUserByEmail(testUser.email.toUpperCase());

      expect(foundUser).toEqual(createdUser);
    });

    it('should return null when user not found by email', async () => {
      const foundUser = await userDataManager.findUserByEmail('nonexistent@example.com');
      expect(foundUser).toBeNull();
    });
  });

  describe('Flight Search Management', () => {
    let testUser: UserProfile;
    let testSearch: FlightSearch;

    beforeEach(async () => {
      testUser = await userDataManager.createUser(createTestUser());
      testSearch = createTestFlightSearch();
    });

    it('should add flight search to user', async () => {
      await userDataManager.updateUserFlightSearch(testUser.id, testSearch);

      const searches = await userDataManager.getUserFlightSearches(testUser.id);
      expect(searches).toHaveLength(1);
      expect(searches[0]).toEqual(testSearch);

      // Check that active searches are updated in profile
      const updatedProfile = await userDataManager.readUserData(testUser.id);
      expect(updatedProfile?.activeSearches).toContain(testSearch.id);
    });

    it('should update existing flight search', async () => {
      await userDataManager.updateUserFlightSearch(testUser.id, testSearch);

      const updatedSearch = {
        ...testSearch,
        status: 'paused' as const,
        updatedAt: new Date().toISOString(),
      };

      await userDataManager.updateUserFlightSearch(testUser.id, updatedSearch);

      const searches = await userDataManager.getUserFlightSearches(testUser.id);
      expect(searches[0].status).toBe('paused');

      // Active searches should be updated (paused searches not included)
      const updatedProfile = await userDataManager.readUserData(testUser.id);
      expect(updatedProfile?.activeSearches).not.toContain(testSearch.id);
    });

    it('should handle multiple flight searches', async () => {
      const search1 = createTestFlightSearch();
      const search2 = createTestFlightSearch();
      const search3 = { ...createTestFlightSearch(), status: 'paused' as const };

      await userDataManager.updateUserFlightSearch(testUser.id, search1);
      await userDataManager.updateUserFlightSearch(testUser.id, search2);
      await userDataManager.updateUserFlightSearch(testUser.id, search3);

      const searches = await userDataManager.getUserFlightSearches(testUser.id);
      expect(searches).toHaveLength(3);

      // Only active searches should be in profile
      const updatedProfile = await userDataManager.readUserData(testUser.id);
      expect(updatedProfile?.activeSearches).toHaveLength(2);
      expect(updatedProfile?.activeSearches).toContain(search1.id);
      expect(updatedProfile?.activeSearches).toContain(search2.id);
      expect(updatedProfile?.activeSearches).not.toContain(search3.id);
    });
  });

  describe('Concurrent Access', () => {
    it('should handle concurrent user creation', async () => {
      const promises = Array.from({ length: 10 }, () =>
        userDataManager.createUser(createTestUser())
      );

      const users = await Promise.all(promises);

      expect(users).toHaveLength(10);

      // All users should have unique IDs
      const userIds = users.map((u) => u.id);
      const uniqueIds = new Set(userIds);
      expect(uniqueIds.size).toBe(10);

      // All users should be persisted
      const listedUsers = await userDataManager.listUsers();
      expect(listedUsers).toHaveLength(10);
    });

    it('should handle concurrent updates to same user', async () => {
      const testUser = await userDataManager.createUser(createTestUser());

      const updatePromises = Array.from({ length: 5 }, (_, i) =>
        userDataManager.updateUserData(testUser.id, {
          firstName: `UpdatedName${i}`,
        })
      );

      const results = await Promise.all(updatePromises);

      // All updates should succeed
      expect(results).toHaveLength(5);

      // Final state should be consistent
      const finalUser = await userDataManager.readUserData(testUser.id);
      expect(finalUser).toBeDefined();
      expect(finalUser!.firstName).toMatch(/^UpdatedName\d$/);
    });

    it('should handle concurrent flight search updates', async () => {
      const testUser = await userDataManager.createUser(createTestUser());

      const searches = Array.from({ length: 5 }, () => createTestFlightSearch());

      const updatePromises = searches.map((search) =>
        userDataManager.updateUserFlightSearch(testUser.id, search)
      );

      await Promise.all(updatePromises);

      const userSearches = await userDataManager.getUserFlightSearches(testUser.id);
      expect(userSearches).toHaveLength(5);

      // Active searches should be properly tracked
      const updatedProfile = await userDataManager.readUserData(testUser.id);
      expect(updatedProfile?.activeSearches).toHaveLength(5);
    });
  });

  describe('Data Validation', () => {
    it('should validate user data on creation', async () => {
      const invalidUser = {
        firstName: '', // Invalid: empty string
        lastName: 'Doe',
        email: 'invalid-email', // Invalid: not an email
        preferences: {
          currency: 'INVALID' as any, // Invalid: not a valid currency
          timezone: 'America/Toronto',
          preferredDepartureAirport: 'INVALID', // Invalid: not IATA code
          communicationFrequency: 'daily',
        },
      };

      await expect(userDataManager.createUser(invalidUser as any)).rejects.toThrow();
    });

    it('should validate user data on update', async () => {
      const testUser = await userDataManager.createUser(createTestUser());

      await expect(
        userDataManager.updateUserData(testUser.id, {
          email: 'invalid-email', // Invalid email format
        })
      ).rejects.toThrow();
    });
  });

  describe('Storage Statistics', () => {
    it('should calculate storage statistics correctly', async () => {
      // Create some test data
      const user1 = await userDataManager.createUser(createTestUser());
      const user2 = await userDataManager.createUser(createTestUser());

      const search1 = createTestFlightSearch();
      const search2 = createTestFlightSearch();

      await userDataManager.updateUserFlightSearch(user1.id, search1);
      await userDataManager.updateUserFlightSearch(user2.id, search2);

      const stats = await userDataManager.getStorageStats();

      expect(stats.totalUsers).toBe(2);
      expect(stats.totalSearches).toBe(2);
      expect(stats.diskUsage).toBeGreaterThan(0);
    });

    it('should handle empty storage correctly', async () => {
      const stats = await userDataManager.getStorageStats();

      expect(stats.totalUsers).toBe(0);
      expect(stats.totalSearches).toBe(0);
      expect(stats.diskUsage).toBe(0);
    });
  });

  describe('Error Handling', () => {
    it('should handle corrupted user data gracefully', async () => {
      const testUser = await userDataManager.createUser(createTestUser());
      const filePath = path.join(testDataDir, `user-${testUser.id}.json`);

      // Corrupt the file
      await fs.writeFile(filePath, 'invalid json content');

      await expect(userDataManager.readUserData(testUser.id)).rejects.toThrow();
    });

    it('should handle missing data directory', async () => {
      // Remove the data directory
      await fs.rm(testDataDir, { recursive: true, force: true });

      // Should recreate directory and work normally
      const testUser = createTestUser();
      const user = await userDataManager.createUser(testUser);

      expect(user).toBeDefined();
      expect(await userDataManager.userExists(user.id)).toBe(true);
    });
  });

  describe('Atomic Operations', () => {
    it('should ensure atomic writes', async () => {
      const testUser = await userDataManager.createUser(createTestUser());

      // Simulate a failure during write by creating a temp file
      const filePath = path.join(testDataDir, `user-${testUser.id}.json`);
      const tempPath = `${filePath}.tmp.${Date.now()}`;
      await fs.writeFile(tempPath, 'incomplete data');

      // Normal update should still work
      const updatedUser = await userDataManager.updateUserData(testUser.id, {
        firstName: 'Updated',
      });

      expect(updatedUser.firstName).toBe('Updated');

      // Temp file should be cleaned up eventually or ignored
      const finalUser = await userDataManager.readUserData(testUser.id);
      expect(finalUser?.firstName).toBe('Updated');
    });
  });
});
