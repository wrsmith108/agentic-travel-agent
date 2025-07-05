/**
 * Preferences Service
 * Handles API communication for user preferences management
 */

import { apiService, ApiError } from './api';
import { API_ENDPOINTS } from '../constants/api';
import type {
  UserPreferences,
  UserPreferencesUpdate,
  NotificationPreferences,
  SearchPreferences,
  DisplayPreferences
} from '../types/preferences';

/**
 * Get user preferences
 */
export const getUserPreferences = async (): Promise<UserPreferences> => {
  const response = await apiService.get<UserPreferences>(API_ENDPOINTS.USER_PREFERENCES);
  
  if (!response.success) {
    throw new ApiError(response.error || 'Failed to fetch preferences', 0);
  }
  
  return response.data!;
};

/**
 * Update user preferences (partial update)
 */
export const updateUserPreferences = async (
  updates: UserPreferencesUpdate
): Promise<UserPreferences> => {
  const response = await apiService.patch<UserPreferences>(API_ENDPOINTS.USER_PREFERENCES, updates);
  
  if (!response.success) {
    throw new ApiError(response.error || 'Failed to update preferences', 0);
  }
  
  return response.data!;
};

/**
 * Reset user preferences to defaults
 */
export const resetUserPreferences = async (): Promise<UserPreferences> => {
  const response = await apiService.post<UserPreferences>(`${API_ENDPOINTS.USER_PREFERENCES}/reset`, {});
  
  if (!response.success) {
    throw new ApiError(response.error || 'Failed to reset preferences', 0);
  }
  
  return response.data!;
};

/**
 * Update notification preferences only
 */
export const updateNotificationPreferences = async (
  notifications: Partial<NotificationPreferences>
): Promise<UserPreferences> => {
  return updateUserPreferences({ notifications });
};

/**
 * Update search preferences only
 */
export const updateSearchPreferences = async (
  search: Partial<SearchPreferences>
): Promise<UserPreferences> => {
  return updateUserPreferences({ search });
};

/**
 * Update display preferences only
 */
export const updateDisplayPreferences = async (
  display: Partial<DisplayPreferences>
): Promise<UserPreferences> => {
  return updateUserPreferences({ display });
};

/**
 * Get specific section preferences
 */
export const getNotificationPreferences = async (): Promise<NotificationPreferences> => {
  const response = await apiService.get<UserPreferences>(`${API_ENDPOINTS.USER_PREFERENCES}/notifications`);
  
  if (!response.success) {
    throw new ApiError(response.error || 'Failed to fetch notification preferences', 0);
  }
  
  return response.data!.notifications;
};

export const getSearchPreferences = async (): Promise<SearchPreferences> => {
  const response = await apiService.get<UserPreferences>(`${API_ENDPOINTS.USER_PREFERENCES}/search`);
  
  if (!response.success) {
    throw new ApiError(response.error || 'Failed to fetch search preferences', 0);
  }
  
  return response.data!.search;
};

export const getDisplayPreferences = async (): Promise<DisplayPreferences> => {
  const response = await apiService.get<UserPreferences>(`${API_ENDPOINTS.USER_PREFERENCES}/display`);
  
  if (!response.success) {
    throw new ApiError(response.error || 'Failed to fetch display preferences', 0);
  }
  
  return response.data!.display;
};

export class PreferencesService {
  async getPreferences(): Promise<UserPreferences> {
    return getUserPreferences();
  }

  async updatePreferences(updates: UserPreferencesUpdate): Promise<UserPreferences> {
    return updateUserPreferences(updates);
  }

  async resetPreferences(): Promise<UserPreferences> {
    return resetUserPreferences();
  }

  async updateNotifications(notifications: Partial<NotificationPreferences>): Promise<UserPreferences> {
    return updateNotificationPreferences(notifications);
  }

  async updateSearch(search: Partial<SearchPreferences>): Promise<UserPreferences> {
    return updateSearchPreferences(search);
  }

  async updateDisplay(display: Partial<DisplayPreferences>): Promise<UserPreferences> {
    return updateDisplayPreferences(display);
  }
}

export const preferencesService = new PreferencesService();