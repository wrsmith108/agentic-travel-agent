/**
 * Database-based user service using PostgreSQL
 * Implements the same interface as the functional file storage system
 */

import { v4 as uuidv4 } from 'uuid';
import {
  UserProfile,
  CreateUserProfile,
  UpdateUserProfile,
  validateUserProfile,
} from '@/schemas/user';
import { executeQuery, executeTransaction } from '@/config/database';
import logger from '@/utils/logger';

// Re-export branded types for compatibility
export type UserId = string & { readonly brand: unique symbol };
export type Email = string & { readonly brand: unique symbol };

export const asUserId = (id: string): UserId => id as UserId;
export const asEmail = (email: string): Email => email as Email;

/**
 * Error types for database operations
 */
export class DatabaseUserError extends Error {
  constructor(message: string, public code: string) {
    super(message);
    this.name = 'DatabaseUserError';
  }
}

export class UserNotFoundError extends DatabaseUserError {
  constructor(userId: UserId) {
    super(`User not found: ${userId}`, 'USER_NOT_FOUND');
  }
}

export class UserAlreadyExistsError extends DatabaseUserError {
  constructor(email: Email) {
    super(`User already exists: ${email}`, 'USER_ALREADY_EXISTS');
  }
}

/**
 * Database row to UserProfile conversion
 */
function rowToUserProfile(row: any): UserProfile {
  return validateUserProfile({
    id: row.id,
    firstName: row.first_name,
    lastName: row.last_name,
    email: row.email,
    passwordHash: row.password_hash,
    preferences: row.preferences,
    activeSearches: row.active_searches || [],
    searchHistory: row.search_history || [],
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  });
}

/**
 * UserProfile to database row conversion
 */
function userProfileToRow(profile: UserProfile) {
  return {
    id: profile.id,
    first_name: profile.firstName,
    last_name: profile.lastName,
    email: profile.email,
    password_hash: profile.passwordHash,
    preferences: JSON.stringify(profile.preferences),
    created_at: profile.createdAt,
    updated_at: profile.updatedAt,
  };
}

/**
 * Database-based user operations
 */
export interface DatabaseUserService {
  createUser(profileData: CreateUserProfile): Promise<UserProfile>;
  readUserData(userId: UserId): Promise<UserProfile | null>;
  updateUserData(userId: UserId, updates: UpdateUserProfile): Promise<UserProfile>;
  findUserByEmail(email: Email): Promise<UserProfile | null>;
  deleteUser(userId: UserId): Promise<boolean>;
  getUserCount(): Promise<number>;
  listUsers(limit?: number, offset?: number): Promise<UserProfile[]>;
}

/**
 * Create a new user in the database
 */
export const createUser = async (
  profileData: CreateUserProfile
): Promise<UserProfile> => {
  try {
    // Check if user already exists
    const existingUser = await findUserByEmail(asEmail(profileData.email));
    if (existingUser) {
      throw new UserAlreadyExistsError(asEmail(profileData.email));
    }

    const profile: UserProfile = {
      ...profileData,
      id: uuidv4(),
      activeSearches: [],
      searchHistory: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const validatedProfile = validateUserProfile(profile);
    const row = userProfileToRow(validatedProfile);

    const sql = `
      INSERT INTO users (
        id, first_name, last_name, email, password_hash, preferences, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `;

    const result = await executeQuery(sql, [
      row.id,
      row.first_name,
      row.last_name,
      row.email,
      row.password_hash,
      row.preferences,
      row.created_at,
      row.updated_at,
    ]);

    if (result.length === 0) {
      throw new DatabaseUserError('Failed to create user', 'CREATE_FAILED');
    }

    const createdUser = rowToUserProfile(result[0]);

    logger.info('User created successfully', {
      userId: createdUser.id,
      email: createdUser.email,
    });

    return createdUser;
  } catch (error) {
    if (error instanceof DatabaseUserError) {
      throw error;
    }

    logger.error('Failed to create user', {
      email: profileData.email,
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    throw new DatabaseUserError(
      'Failed to create user',
      'DATABASE_ERROR'
    );
  }
};

/**
 * Read user data by ID
 */
export const readUserData = async (userId: UserId): Promise<UserProfile | null> => {
  try {
    const sql = 'SELECT * FROM users WHERE id = $1';
    const result = await executeQuery(sql, [userId]);

    if (result.length === 0) {
      return null;
    }

    return rowToUserProfile(result[0]);
  } catch (error) {
    logger.error('Failed to read user data', {
      userId,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    throw new DatabaseUserError('Failed to read user data', 'READ_FAILED');
  }
};

/**
 * Update user data
 */
export const updateUserData = async (
  userId: UserId,
  updates: UpdateUserProfile
): Promise<UserProfile> => {
  try {
    return await executeTransaction(async (client) => {
      // First, get current user data
      const currentResult = await client.query('SELECT * FROM users WHERE id = $1', [userId]);
      
      if (currentResult.rows.length === 0) {
        throw new UserNotFoundError(userId);
      }

      const currentUser = rowToUserProfile(currentResult.rows[0]);

      // Merge updates
      const updatedProfile: UserProfile = {
        ...currentUser,
        ...updates,
        id: currentUser.id, // Prevent ID changes
        createdAt: currentUser.createdAt, // Preserve creation date
        updatedAt: new Date().toISOString(),
      };

      const validatedProfile = validateUserProfile(updatedProfile);
      const row = userProfileToRow(validatedProfile);

      // Update the user
      const updateSQL = `
        UPDATE users 
        SET first_name = $2, last_name = $3, email = $4, password_hash = $5, 
            preferences = $6, updated_at = $7
        WHERE id = $1
        RETURNING *
      `;

      const updateResult = await client.query(updateSQL, [
        row.id,
        row.first_name,
        row.last_name,
        row.email,
        row.password_hash,
        row.preferences,
        row.updated_at,
      ]);

      if (updateResult.rows.length === 0) {
        throw new DatabaseUserError('Failed to update user', 'UPDATE_FAILED');
      }

      const updatedUser = rowToUserProfile(updateResult.rows[0]);

      logger.info('User updated successfully', { userId });

      return updatedUser;
    });
  } catch (error) {
    if (error instanceof DatabaseUserError) {
      throw error;
    }

    logger.error('Failed to update user data', {
      userId,
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    throw new DatabaseUserError('Failed to update user data', 'UPDATE_FAILED');
  }
};

/**
 * Find user by email
 */
export const findUserByEmail = async (email: Email): Promise<UserProfile | null> => {
  try {
    const sql = 'SELECT * FROM users WHERE email = $1';
    const result = await executeQuery(sql, [email]);

    if (result.length === 0) {
      return null;
    }

    return rowToUserProfile(result[0]);
  } catch (error) {
    logger.error('Failed to find user by email', {
      email,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    throw new DatabaseUserError('Failed to find user by email', 'FIND_FAILED');
  }
};

/**
 * Delete user (soft delete or hard delete)
 */
export const deleteUser = async (userId: UserId): Promise<boolean> => {
  try {
    const sql = 'DELETE FROM users WHERE id = $1';
    const result = await executeQuery(sql, [userId]);

    const deleted = (result as any).rowCount > 0;
    
    if (deleted) {
      logger.info('User deleted successfully', { userId });
    }

    return deleted;
  } catch (error) {
    logger.error('Failed to delete user', {
      userId,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    throw new DatabaseUserError('Failed to delete user', 'DELETE_FAILED');
  }
};

/**
 * Get total user count
 */
export const getUserCount = async (): Promise<number> => {
  try {
    const sql = 'SELECT COUNT(*) as count FROM users';
    const result = await executeQuery(sql);
    return parseInt(result[0].count, 10);
  } catch (error) {
    logger.error('Failed to get user count', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    throw new DatabaseUserError('Failed to get user count', 'COUNT_FAILED');
  }
};

/**
 * List users with pagination
 */
export const listUsers = async (
  limit: number = 50,
  offset: number = 0
): Promise<UserProfile[]> => {
  try {
    const sql = `
      SELECT * FROM users 
      ORDER BY created_at DESC 
      LIMIT $1 OFFSET $2
    `;
    const result = await executeQuery(sql, [limit, offset]);

    return result.map(rowToUserProfile);
  } catch (error) {
    logger.error('Failed to list users', {
      limit,
      offset,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    throw new DatabaseUserError('Failed to list users', 'LIST_FAILED');
  }
};

/**
 * Create database user service instance
 * This maintains compatibility with the functional interface
 */
export const createDatabaseUserService = (): DatabaseUserService => ({
  createUser,
  readUserData,
  updateUserData,
  findUserByEmail,
  deleteUser,
  getUserCount,
  listUsers,
});

/**
 * Get database user service operations (compatible with existing interface)
 */
export const getDatabaseUserOps = () => ({
  createUser,
  readUserData,
  updateUserData,
  findUserByEmail,
  deleteUser,
  getUserCount,
  listUsers,
});