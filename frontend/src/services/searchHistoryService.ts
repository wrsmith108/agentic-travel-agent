// Search History Service
import { apiService } from './api';
import { API_ENDPOINTS } from '../constants/api';
import type { SearchHistory } from '../types/search';

class SearchHistoryService {
  /**
   * Get search history for the authenticated user
   */
  async getSearchHistory(): Promise<SearchHistory[]> {
    const response = await apiService.get<{ history: SearchHistory[] }>(
      API_ENDPOINTS.SEARCH_HISTORY
    );
    
    if (!response.success) {
      throw new Error(response.error || 'Failed to get search history');
    }

    return response.data?.history || [];
  }

  /**
   * Clear search history for the authenticated user
   */
  async clearSearchHistory(): Promise<void> {
    const response = await apiService.delete(API_ENDPOINTS.SEARCH_HISTORY);
    
    if (!response.success) {
      throw new Error(response.error || 'Failed to clear search history');
    }
  }
}

export const searchHistoryService = new SearchHistoryService();