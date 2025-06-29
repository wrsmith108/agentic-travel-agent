/**
 * User Preferences Service
 * Manages user preferences for notifications, search defaults, and display settings
 */

import { Result, ok, err, isOk, isErr } from '@/utils/result';
import { createTimestamp } from '@/services/auth/functional/types';
import { AppError, ErrorCodes } from '@/middleware/errorHandler';
import { getRedisClient } from '@/services/redis/redisClient';
import createLogger from '@/utils/logger';
import { UserId } from '@/types/brandedTypes';
import {
  UserPreferences,
  UserPreferencesUpdate,
  createDefaultPreferences,
  validateUserPreferences,
  validateUserPreferencesUpdate,
} from '@/schemas/preferences';

const logger = createLogger('UserPreferencesService');

export class UserPreferencesService {
  private redisClient: ReturnType<typeof getRedisClient>;
  private readonly keyPrefix = 'user-preferences:';
  private readonly ttl = 90 * 24 * 60 * 60; // 90 days

  constructor() {
    this.redisClient = getRedisClient();
  }

  /**
   * Get user preferences
   */
  async getPreferences(userId: UserId): Promise<Result<UserPreferences, AppError>> {
    try {
      const key = `${this.keyPrefix}${userId}`;
      const result = await this.redisClient.get(key);

      if (isErr(result) || isErr(result)) {
        // Return default preferences if none exist
        const defaultPrefs = createDefaultPreferences(userId);
        logger.info('Returning default preferences for user', { userId });
        return ok(defaultPrefs);
      }

      const preferences = validateUserPreferences(JSON.parse(result.value));
      return ok(preferences);
    } catch (error) {
      logger.error('Failed to get user preferences', { 
        error: error instanceof Error ? error.message : 'Unknown error',
        userId 
      });
      return err(new AppError(
        500,
        'Failed to retrieve user preferences',
        ErrorCodes.SERVICE_ERROR
      ));
    }
  }

  /**
   * Create or update user preferences
   */
  async savePreferences(
    userId: UserId,
    preferences: UserPreferences
  ): Promise<Result<UserPreferences, AppError>> {
    try {
      const key = `${this.keyPrefix}${userId}`;
      
      // Ensure userId matches
      if (preferences.userId !== userId) {
        return err(new AppError(
          400,
          'User ID mismatch',
          ErrorCodes.VALIDATION_ERROR
        ));
      }

      // Update timestamp
      preferences.updatedAt = createTimestamp();

      // Validate before saving
      const validated = validateUserPreferences(preferences);

      // Save to Redis
      const result = await this.redisClient.set(
        key,
        JSON.stringify(validated),
        this.ttl
      );

      if (isErr(result)) {
        throw new Error('Failed to save to Redis');
      }

      logger.info('User preferences saved', { userId });
      return ok(validated);
    } catch (error) {
      logger.error('Failed to save user preferences', { 
        error: error instanceof Error ? error.message : 'Unknown error',
        userId 
      });
      return err(new AppError(
        500,
        'Failed to save user preferences',
        ErrorCodes.SERVICE_ERROR
      ));
    }
  }

  /**
   * Update specific preference sections
   */
  async updatePreferences(
    userId: UserId,
    updates: UserPreferencesUpdate
  ): Promise<Result<UserPreferences, AppError>> {
    try {
      // Get existing preferences
      const existingResult = await this.getPreferences(userId);
      if (isErr(existingResult)) {
        return err(existingResult.error);
      }

      const existing = isOk(existingResult) ? existingResult.value : null;
      const validated = validateUserPreferencesUpdate(updates);

      // Deep merge updates
      const updated: UserPreferences = {
        ...existing,
        notifications: {
          ...existing.notifications,
          ...(validated.notifications || {}),
        },
        search: {
          ...existing.search,
          ...(validated.search || {}),
        },
        display: {
          ...existing.display,
          ...(validated.display || {}),
        },
        updatedAt: createTimestamp(),
      };

      // Handle nested objects properly
      if (validated.notifications?.priceAlerts) {
        updated.notifications.priceAlerts = {
          ...existing.notifications.priceAlerts,
          ...validated.notifications.priceAlerts,
        };
      }
      if (validated.notifications?.searchExpiration) {
        updated.notifications.searchExpiration = {
          ...existing.notifications.searchExpiration,
          ...validated.notifications.searchExpiration,
        };
      }
      if (validated.notifications?.marketing) {
        updated.notifications.marketing = {
          ...existing.notifications.marketing,
          ...validated.notifications.marketing,
        };
      }
      if (validated.search?.flexibleDates) {
        updated.search.flexibleDates = {
          ...existing.search.flexibleDates,
          ...validated.search.flexibleDates,
        };
      }

      // Save updated preferences
      return await this.savePreferences(userId, updated);
    } catch (error) {
      logger.error('Failed to update user preferences', { 
        error: error instanceof Error ? error.message : 'Unknown error',
        userId 
      });
      return err(new AppError(
        500,
        'Failed to update user preferences',
        ErrorCodes.SERVICE_ERROR
      ));
    }
  }

  /**
   * Reset preferences to defaults
   */
  async resetPreferences(userId: UserId): Promise<Result<UserPreferences, AppError>> {
    try {
      const defaultPrefs = createDefaultPreferences(userId);
      return await this.savePreferences(userId, defaultPrefs);
    } catch (error) {
      logger.error('Failed to reset user preferences', { 
        error: error instanceof Error ? error.message : 'Unknown error',
        userId 
      });
      return err(new AppError(
        500,
        'Failed to reset user preferences',
        ErrorCodes.SERVICE_ERROR
      ));
    }
  }

  /**
   * Delete user preferences
   */
  async deletePreferences(userId: UserId): Promise<Result<void, AppError>> {
    try {
      const key = `${this.keyPrefix}${userId}`;
      const result = await this.redisClient.del(key);

      if (isErr(result)) {
        throw new Error('Failed to delete from Redis');
      }

      logger.info('User preferences deleted', { userId });
      return ok(undefined);
    } catch (error) {
      logger.error('Failed to delete user preferences', { 
        error: error instanceof Error ? error.message : 'Unknown error',
        userId 
      });
      return err(new AppError(
        500,
        'Failed to delete user preferences',
        ErrorCodes.SERVICE_ERROR
      ));
    }
  }

  /**
   * Get preferences for multiple users (batch operation)
   */
  async getBatchPreferences(
    userIds: UserId[]
  ): Promise<Result<Map<UserId, UserPreferences>, AppError>> {
    try {
      const preferencesMap = new Map<UserId, UserPreferences>();

      // Fetch all preferences in parallel
      const promises = userIds.map(userId => this.getPreferences(userId));
      const results = await Promise.all(promises);

      results.forEach((result, index) => {
        if (isOk(result)) {
          preferencesMap.set(userIds[index], result.value);
        }
      });

      return ok(preferencesMap);
    } catch (error) {
      logger.error('Failed to get batch preferences', { 
        error: error instanceof Error ? error.message : 'Unknown error',
        userCount: userIds.length 
      });
      return err(new AppError(
        500,
        'Failed to retrieve batch preferences',
        ErrorCodes.SERVICE_ERROR
      ));
    }
  }

  /**
   * Check if user has specific notification enabled
   */
  async isNotificationEnabled(
    userId: UserId,
    notificationType: 'priceAlerts' | 'searchExpiration' | 'marketing'
  ): Promise<boolean> {
    const result = await this.getPreferences(userId);
    if (isErr(result) || isErr(result)) {
      return false;
    }

    const prefs = isOk(result) ? result.value : null;
    
    switch (notificationType) {
      case 'priceAlerts':
        return prefs.notifications.emailEnabled && prefs.notifications.priceAlerts.enabled;
      case 'searchExpiration':
        return prefs.notifications.emailEnabled && prefs.notifications.searchExpiration.enabled;
      case 'marketing':
        return prefs.notifications.emailEnabled && prefs.notifications.marketing.enabled;
      default:
        return false;
    }
  }

  /**
   * Get notification frequency for user
   */
  async getNotificationFrequency(userId: UserId): Promise<string> {
    const result = await this.getPreferences(userId);
    if (isErr(result)) {
      return 'INSTANT'; // Default
    }
    return result.value.notifications?.frequency || 'INSTANT';
  }
}

// Export singleton instance
export const userPreferencesService = new UserPreferencesService();