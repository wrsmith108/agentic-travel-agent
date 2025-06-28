import {
  UserProfile,
  UserDataFile,
  CreateUserProfile,
  UpdateUserProfile,
  FlightSearch,
} from '@/schemas/user';
import { UserId, FilePath, Email } from '@/types/brandedTypes';

// Branded types for type safety
// Now imported from @/types/brandedTypes

// Type guards and constructors
export const asUserId = (id: string): UserId => id as UserId;
export const asFilePath = (path: string): FilePath => path as FilePath;
export const asEmail = (email: string): Email => email as Email;

// File operations interface
export interface FileOps {
  readonly dataDir: string;
  ensureDirectory: () => Promise<void>;
  exists: (filePath: FilePath) => Promise<boolean>;
  read: (filePath: FilePath) => Promise<string | null>;
  write: (filePath: FilePath, data: UserDataFile) => Promise<void>;
  writeAtomic: (filePath: FilePath, data: UserDataFile) => Promise<void>;
  delete: (filePath: FilePath) => Promise<void>;
  listFiles: () => Promise<string[]>;
  stat: (filePath: FilePath) => Promise<{ size: number } | null>;
}

// Lock operations interface
export interface LockOps {
  withLock: <T>(filePath: FilePath, operation: () => Promise<T>) => Promise<T>;
}

// Storage statistics
export interface StorageStats {
  totalUsers: number;
  totalSearches: number;
  diskUsage: number;
}

// User data manager operations interface
export interface UserDataManagerOps {
  createUser: (profileData: CreateUserProfile) => Promise<UserProfile>;
  readUserData: (userId: UserId) => Promise<UserProfile | null>;
  readUserDataFile: (userId: UserId) => Promise<UserDataFile | null>;
  updateUserData: (userId: UserId, updates: UpdateUserProfile) => Promise<UserProfile>;
  deleteUser: (userId: UserId) => Promise<void>;
  listUsers: () => Promise<UserId[]>;
  userExists: (userId: UserId) => Promise<boolean>;
  updateUserFlightSearch: (userId: UserId, search: FlightSearch) => Promise<void>;
  getUserFlightSearches: (userId: UserId) => Promise<FlightSearch[]>;
  findUserByEmail: (email: Email) => Promise<UserProfile | null>;
  getStorageStats: () => Promise<StorageStats>;
}

// Errors
export class UserNotFoundError extends Error {
  constructor(userId: UserId) {
    super(`User ${userId} not found`);
    this.name = 'UserNotFoundError';
  }
}

export class UserAlreadyExistsError extends Error {
  constructor(userId: UserId) {
    super(`User with ID ${userId} already exists`);
    this.name = 'UserAlreadyExistsError';
  }
}

// Re-export branded types from canonical source
export { UserId, Email, FilePath } from '@/types/brandedTypes';
