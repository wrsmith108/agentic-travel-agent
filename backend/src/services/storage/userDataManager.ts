/**
 * UserDataManager - File-based user storage with atomic operations
 *
 * This module has been refactored to use a functional programming approach.
 * The original class-based implementation has been moved to a separate file
 * and wrapped for backward compatibility.
 */

// Export from compatibility wrapper for gradual migration
export { userDataManager, UserDataManager } from './userDataManagerCompat';

// Export functional interface for new code
export { getUserDataManagerOps, createUserDataManagerOps } from './functional';
export type { UserDataManagerOps } from './functional';
